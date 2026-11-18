import atexit
import io
import json
import logging
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional
from databricks import sql
from databricks.sql.experimental.oauth_persistence import OAuthPersistence, OAuthToken
from app.config.settings import settings, BACKEND_DIR

logger = logging.getLogger("salespulse.databricks")

OAUTH_TOKEN_CACHE_PATH = BACKEND_DIR / ".databricks_oauth_token.json"


class DatabricksError(Exception):
    """Base error for Databricks integration failures."""


class DatabricksConfigError(DatabricksError):
    """Raised when required Databricks configuration or credentials are missing."""


class ThreadSafeOAuthPersistence(OAuthPersistence):
    """
    Thread-safe OAuth token store implementing databricks-sql-connector's OAuthPersistence.
    Keeps tokens in memory and caches them to a git-ignored local dev file so:
      1. Multiple concurrent FastAPI requests reuse one OAuth token without race conditions.
      2. Uvicorn reloads reuse the cached/refreshable token without forcing repeated logins.
      3. Access/refresh token strings are NEVER logged or printed.
    """

    def __init__(self, file_path: Path):
        self._lock = threading.RLock()
        self._file_path = file_path
        self._memory_tokens: Dict[str, OAuthToken] = {}

    @staticmethod
    def _normalize_key(hostname: str) -> str:
        return (hostname or "").strip().rstrip("/").lower()

    def persist(self, hostname: str, oauth_token: OAuthToken) -> None:
        key = self._normalize_key(hostname)
        with self._lock:
            self._memory_tokens[key] = oauth_token
            try:
                payload = {
                    "hostname": key,
                    "access_token": oauth_token.access_token,
                    "refresh_token": oauth_token.refresh_token,
                }
                with open(self._file_path, "w", encoding="utf-8") as f:
                    json.dump(payload, f)
                logger.info("Cached Databricks OAuth session for workspace host '%s'.", key)
            except Exception as e:
                # Memory cache still works even if disk persistence is unavailable
                logger.warning("Could not write local OAuth cache file: %s", str(e))

    def read(self, hostname: str) -> Optional[OAuthToken]:
        key = self._normalize_key(hostname)
        with self._lock:
            if key in self._memory_tokens:
                return self._memory_tokens[key]
            if not self._file_path.exists():
                return None
            try:
                with open(self._file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                saved_host = self._normalize_key(data.get("hostname", ""))
                access = data.get("access_token")
                refresh = data.get("refresh_token")
                if saved_host == key and access and refresh:
                    token = OAuthToken(access, refresh)
                    self._memory_tokens[key] = token
                    return token
            except Exception as e:
                logger.warning("Ignoring unreadable local OAuth cache file: %s", str(e))
            return None

    def clear(self) -> None:
        with self._lock:
            self._memory_tokens.clear()
            try:
                if self._file_path.exists():
                    self._file_path.unlink()
            except Exception:
                pass


# Module-level singletons shared safely across all FastAPI worker threads
_oauth_persistence = ThreadSafeOAuthPersistence(OAUTH_TOKEN_CACHE_PATH)
_sql_lock = threading.RLock()
_shared_connection = None
_shared_connection_key: Optional[tuple] = None


def close_shared_connection() -> None:
    """Safely closes the shared Databricks SQL Warehouse connection."""
    global _shared_connection, _shared_connection_key
    with _sql_lock:
        if _shared_connection is not None:
            try:
                _shared_connection.close()
            except Exception:
                pass
            _shared_connection = None
            _shared_connection_key = None


atexit.register(close_shared_connection)


def _get_or_create_sql_connection():
    """
    Returns an active shared SQL Warehouse connection.
    Must be called while holding `_sql_lock` so parallel FastAPI requests NEVER launch
    competing OAuth browser flows or trigger CSRF state collisions on localhost:8020.
    """
    global _shared_connection, _shared_connection_key

    if not settings.has_sql_config:
        raise DatabricksConfigError(
            "Databricks SQL Warehouse is not configured. Set DATABRICKS_SERVER_HOSTNAME "
            "and DATABRICKS_HTTP_PATH in backend/.env."
        )

    conn_key = (settings.server_hostname, settings.http_path, settings.auth_mode)
    if _shared_connection is not None and _shared_connection_key == conn_key:
        if getattr(_shared_connection, "open", True):
            return _shared_connection
        close_shared_connection()

    connect_args: Dict[str, Any] = {
        "server_hostname": settings.server_hostname,
        "http_path": settings.http_path,
    }

    if settings.has_pat_token:
        connect_args["access_token"] = settings.DATABRICKS_TOKEN.strip()
        logger.info("Opening Databricks SQL Warehouse connection using PAT authentication.")
    else:
        connect_args["auth_type"] = "databricks-oauth"
        connect_args["experimental_oauth_persistence"] = _oauth_persistence
        logger.info("Opening Databricks SQL Warehouse connection using persistent OAuth authentication.")

    _shared_connection = sql.connect(**connect_args)
    _shared_connection_key = conn_key
    return _shared_connection


def _sanitize_filename(filename: str) -> str:
    """Strips directory paths and unsafe characters from uploaded filenames."""
    base = os.path.basename(filename or "uploaded_sales.csv")
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", base)
    return safe or "uploaded_sales.csv"


def _format_epoch_ms(ms: Optional[int]) -> Optional[str]:
    if not ms:
        return None
    return datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _format_duration_ms(start_ms: Optional[int], end_ms: Optional[int]) -> Optional[str]:
    if not start_ms or not end_ms or end_ms < start_ms:
        return None
    total_sec = int((end_ms - start_ms) / 1000)
    mins, secs = divmod(total_sec, 60)
    return f"{mins}m {secs}s" if mins else f"{secs}s"


def _map_run_status(life_cycle_state: Optional[str], result_state: Optional[str]) -> str:
    """Maps Databricks job life_cycle_state + result_state into a clear UI status."""
    lc = (life_cycle_state or "").upper()
    rs = (result_state or "").upper()

    if lc in ("PENDING", "QUEUED", "WAITING_FOR_RETRY", "BLOCKED"):
        return "PENDING"
    if lc in ("RUNNING", "TERMINATING"):
        return "RUNNING"
    if lc == "TERMINATED":
        if rs == "SUCCESS":
            return "COMPLETED"
        if rs in ("FAILED", "TIMEDOUT"):
            return "FAILED"
        if rs == "CANCELED":
            return "CANCELED"
        return rs or "COMPLETED"
    if lc in ("INTERNAL_ERROR", "SKIPPED"):
        return "FAILED"
    return lc or "UNKNOWN"


def execute_query(query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Executes a SQL query against Databricks SQL Warehouse safely across concurrent requests.
    - Serializes initial auth + connection reuse under `_sql_lock` so only ONE OAuth handshake
      can ever occur, eliminating `(mismatching_state) CSRF Warning` race conditions.
    - Reuses cached/refreshable OAuth tokens via `ThreadSafeOAuthPersistence`.
    - Automatically reconnects once if the SQL Warehouse closes an idle session.
    """
    if not settings.has_sql_config:
        raise DatabricksConfigError(
            "Databricks SQL Warehouse is not configured. Set DATABRICKS_SERVER_HOSTNAME "
            "and DATABRICKS_HTTP_PATH in backend/.env."
        )

    with _sql_lock:
        for attempt in range(2):
            try:
                connection = _get_or_create_sql_connection()
                with connection.cursor() as cursor:
                    if parameters:
                        cursor.execute(query, parameters)
                    else:
                        cursor.execute(query)
                    if not cursor.description:
                        return []
                    columns = [desc[0] for desc in cursor.description]
                    return [dict(zip(columns, row)) for row in cursor.fetchall()]
            except DatabricksError:
                raise
            except Exception as e:
                err_text = str(e).lower()
                is_retryable = attempt == 0 and any(
                    marker in err_text
                    for marker in (
                        "session",
                        "closed",
                        "expired",
                        "invalid_grant",
                        "401",
                        "unauthorized",
                        "connection",
                        "broken pipe",
                        "reset by peer",
                    )
                )
                if is_retryable:
                    logger.warning(
                        "Databricks SQL session interrupted (%s); closing stale session and retrying once.",
                        type(e).__name__,
                    )
                    close_shared_connection()
                    if "invalid_grant" in err_text or "401" in err_text or "unauthorized" in err_text:
                        _oauth_persistence.clear()
                    continue
                logger.error("Databricks SQL Warehouse query failed: %s", str(e))
                raise DatabricksError(f"Databricks SQL query failed: {str(e)}") from e

    raise DatabricksError("Databricks SQL query failed after retry.")


class DatabricksService:
    """Handles SQL Warehouse queries, Unity Catalog Volume uploads, and Jobs API calls."""

    def _get_workspace_client(self, action_name: str):
        if not settings.workspace_url:
            raise DatabricksConfigError(
                f"{action_name} requires DATABRICKS_SERVER_HOSTNAME in backend/.env."
            )
        if not settings.has_pat_token:
            raise DatabricksConfigError(
                f"{action_name} requires a Databricks Personal Access Token (DATABRICKS_TOKEN) "
                "in backend/.env. SQL Warehouse queries support browser OAuth, whereas automated "
                "Volume uploads and Jobs API calls require a PAT."
            )
        from databricks.sdk import WorkspaceClient
        return WorkspaceClient(
            host=settings.workspace_url,
            token=settings.DATABRICKS_TOKEN.strip(),
        )

    def test_connection(self) -> Dict[str, Any]:
        """Tests live Databricks SQL Warehouse connectivity with SELECT 1."""
        if not settings.has_sql_config:
            return {
                "connected": False,
                "workspace": settings.server_hostname or None,
                "reason": "DATABRICKS_SERVER_HOSTNAME or DATABRICKS_HTTP_PATH not configured.",
            }
        try:
            execute_query("SELECT 1 AS ping")
            return {
                "connected": True,
                "workspace": settings.server_hostname,
                "catalog": settings.DATABRICKS_CATALOG,
                "schema": settings.DATABRICKS_SCHEMA,
            }
        except Exception as e:
            return {
                "connected": False,
                "workspace": settings.server_hostname,
                "reason": str(e),
            }

    def upload_to_volume(self, file_bytes: bytes, filename: str) -> str:
        """Uploads a validated CSV file into the configured Unity Catalog Volume."""
        safe_name = _sanitize_filename(filename)
        volume_path = (
            f"/Volumes/{settings.DATABRICKS_CATALOG}/"
            f"{settings.DATABRICKS_SCHEMA}/"
            f"{settings.DATABRICKS_VOLUME}/{safe_name}"
        )
        client = self._get_workspace_client("Unity Catalog Volume upload")
        try:
            client.files.upload(volume_path, io.BytesIO(file_bytes), overwrite=True)
            logger.info("Uploaded file to Unity Catalog Volume: %s", volume_path)
            return volume_path
        except Exception as e:
            logger.error("Unity Catalog Volume upload failed: %s", str(e))
            raise DatabricksError(f"Failed to upload file to Unity Catalog Volume: {str(e)}") from e

    def trigger_etl_job(
        self,
        volume_path: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Triggers the configured Databricks PySpark ETL Job via Jobs API."""
        if not settings.has_job_id:
            raise DatabricksConfigError(
                "DATABRICKS_JOB_ID is not configured in backend/.env. "
                "Create a Databricks Job for sales_etl_pipeline.py and paste its numeric Job ID."
            )

        client = self._get_workspace_client("Databricks Jobs API")
        job_id_int = int(settings.DATABRICKS_JOB_ID.strip())
        resolved_file = _sanitize_filename(
            file_name or (os.path.basename(volume_path) if volume_path else "sample_sales.csv")
        )

        try:
            waiter = client.jobs.run_now(
                job_id=job_id_int,
                job_parameters={
                    "catalog_name": settings.DATABRICKS_CATALOG,
                    "schema_name": settings.DATABRICKS_SCHEMA,
                    "volume_name": settings.DATABRICKS_VOLUME,
                    "file_name": resolved_file,
                },
            )
            run_id = str(waiter.run_id)
            run_url = f"{settings.workspace_url}/#job/{job_id_int}/run/{run_id}"
            return {
                "success": True,
                "runId": run_id,
                "jobId": str(job_id_int),
                "jobName": "sales_etl_pipeline",
                "status": "PENDING",
                "message": f"Databricks Job {job_id_int} triggered successfully (Run ID: {run_id}).",
                "runPageUrl": run_url,
            }
        except Exception as e:
            logger.error("Failed to trigger Databricks Job %s: %s", job_id_int, str(e))
            raise DatabricksError(f"Failed to trigger Databricks Job: {str(e)}") from e

    def get_job_status(self, run_id: str) -> Dict[str, Any]:
        """Fetches genuine run status, timing, and logs from Databricks Jobs API."""
        if not str(run_id).strip().isdigit():
            raise DatabricksConfigError(
                f"Invalid Databricks run_id '{run_id}'. Expected a numeric Databricks run ID."
            )

        client = self._get_workspace_client("Databricks Job Status check")
        run_id_int = int(str(run_id).strip())

        try:
            run = client.jobs.get_run(run_id=run_id_int)
            state = run.state
            lc_state = state.life_cycle_state.value if (state and state.life_cycle_state) else None
            res_state = state.result_state.value if (state and state.result_state) else None
            state_msg = state.state_message if state else None
            mapped_status = _map_run_status(lc_state, res_state)

            logs: List[str] = [
                f"[DATABRICKS] Run ID: {run_id_int}",
                f"[STATE] Life Cycle: {lc_state or 'UNKNOWN'} | Result: {res_state or 'IN_PROGRESS'}",
            ]
            if state_msg:
                logs.append(f"[MESSAGE] {state_msg}")

            if run.tasks:
                for t in run.tasks:
                    t_lc = t.state.life_cycle_state.value if (t.state and t.state.life_cycle_state) else "UNKNOWN"
                    t_rs = t.state.result_state.value if (t.state and t.state.result_state) else "-"
                    logs.append(f"[TASK] {t.task_key}: {t_lc} ({t_rs})")
                    if t.run_id and t_lc == "TERMINATED":
                        try:
                            out = client.jobs.get_run_output(run_id=t.run_id)
                            if out.notebook_output and out.notebook_output.result:
                                logs.append(f"[OUTPUT] {out.notebook_output.result}")
                            if out.error:
                                logs.append(f"[ERROR] {out.error}")
                        except Exception:
                            pass

            return {
                "runId": str(run_id_int),
                "jobId": str(run.job_id) if run.job_id else None,
                "jobName": run.run_name or "sales_etl_pipeline",
                "status": mapped_status,
                "lifeCycleState": lc_state,
                "resultState": res_state,
                "stateMessage": state_msg,
                "startTime": _format_epoch_ms(run.start_time),
                "endTime": _format_epoch_ms(run.end_time),
                "duration": _format_duration_ms(run.start_time, run.end_time),
                "runPageUrl": run.run_page_url,
                "targetTables": [
                    f"{settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA}.sales_cleaned",
                    f"{settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA}.monthly_sales_summary",
                    f"{settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA}.category_sales_summary",
                    f"{settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA}.regional_sales_summary",
                    f"{settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA}.top_products_summary",
                ],
                "logs": logs,
                "dataSource": "databricks",
            }
        except DatabricksError:
            raise
        except Exception as e:
            logger.error("Failed to fetch Databricks job run %s: %s", run_id_int, str(e))
            raise DatabricksError(f"Failed to retrieve Databricks job status: {str(e)}") from e

    def list_recent_runs(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Lists recent genuine runs for the configured Databricks Job ID."""
        if not settings.has_job_id:
            raise DatabricksConfigError("DATABRICKS_JOB_ID is not configured in backend/.env.")

        client = self._get_workspace_client("Databricks Jobs History")
        job_id_int = int(settings.DATABRICKS_JOB_ID.strip())

        try:
            runs = list(client.jobs.list_runs(job_id=job_id_int, limit=limit))
            results: List[Dict[str, Any]] = []
            for r in runs:
                lc = r.state.life_cycle_state.value if (r.state and r.state.life_cycle_state) else None
                rs = r.state.result_state.value if (r.state and r.state.result_state) else None
                results.append(
                    {
                        "runId": str(r.run_id),
                        "jobId": str(r.job_id) if r.job_id else str(job_id_int),
                        "jobName": r.run_name or "sales_etl_pipeline",
                        "status": _map_run_status(lc, rs),
                        "lifeCycleState": lc,
                        "resultState": rs,
                        "stateMessage": r.state.state_message if r.state else None,
                        "startTime": _format_epoch_ms(r.start_time),
                        "endTime": _format_epoch_ms(r.end_time),
                        "duration": _format_duration_ms(r.start_time, r.end_time),
                        "runPageUrl": r.run_page_url,
                        "targetTables": [],
                        "logs": [f"[DATABRICKS] {lc or 'UNKNOWN'} ({rs or 'IN_PROGRESS'})"],
                        "dataSource": "databricks",
                    }
                )
            return results
        except Exception as e:
            logger.error("Failed to list Databricks job runs: %s", str(e))
            raise DatabricksError(f"Failed to list Databricks runs: {str(e)}") from e


databricks_service = DatabricksService()
