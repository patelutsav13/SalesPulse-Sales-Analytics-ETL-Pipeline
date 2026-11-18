from pathlib import Path
from typing import Dict, Any, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always resolve backend/.env regardless of where uvicorn is launched from
BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # Databricks Workspace & SQL Warehouse
    DATABRICKS_SERVER_HOSTNAME: str = ""
    DATABRICKS_HOST: str = ""
    DATABRICKS_HTTP_PATH: str = ""
    DATABRICKS_WAREHOUSE_ID: str = ""

    # Authentication (PAT optional; if empty, SQL Warehouse uses Databricks OAuth)
    DATABRICKS_TOKEN: Optional[str] = ""

    # Databricks Jobs API
    DATABRICKS_JOB_ID: Optional[str] = ""

    # Unity Catalog Hierarchy
    DATABRICKS_CATALOG: str = "mypyspark"
    DATABRICKS_SCHEMA: str = "sales_schema"
    DATABRICKS_VOLUME: str = "sales_volume"

    # Local Server Config
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def server_hostname(self) -> str:
        """Returns clean hostname without https:// prefix."""
        raw = (self.DATABRICKS_SERVER_HOSTNAME or self.DATABRICKS_HOST or "").strip()
        return raw.replace("https://", "").replace("http://", "").rstrip("/")

    @property
    def workspace_url(self) -> str:
        """Returns full https:// workspace URL."""
        host = self.server_hostname
        return f"https://{host}" if host else ""

    @property
    def http_path(self) -> str:
        """Returns SQL Warehouse HTTP path."""
        if self.DATABRICKS_HTTP_PATH and self.DATABRICKS_HTTP_PATH.strip():
            return self.DATABRICKS_HTTP_PATH.strip()
        if self.DATABRICKS_WAREHOUSE_ID and self.DATABRICKS_WAREHOUSE_ID.strip():
            return f"/sql/1.0/warehouses/{self.DATABRICKS_WAREHOUSE_ID.strip()}"
        return ""

    @property
    def has_sql_config(self) -> bool:
        host = self.server_hostname
        path = self.http_path
        return bool(
            host
            and path
            and "your-workspace" not in host.lower()
            and "your_sql_warehouse" not in path.lower()
        )

    @property
    def has_pat_token(self) -> bool:
        token = (self.DATABRICKS_TOKEN or "").strip()
        return bool(token and not token.startswith("dapi_your_"))

    @property
    def has_job_id(self) -> bool:
        job_id = (self.DATABRICKS_JOB_ID or "").strip()
        return job_id.isdigit()

    @property
    def auth_mode(self) -> str:
        return "pat" if self.has_pat_token else "databricks-oauth"

    def safe_public_config(self) -> Dict[str, Any]:
        """Returns non-secret configuration values safe to show in the UI."""
        return {
            "server_hostname": self.server_hostname or "Not configured",
            "warehouse_id": self.DATABRICKS_WAREHOUSE_ID or "Not configured",
            "http_path_configured": bool(self.http_path),
            "catalog": self.DATABRICKS_CATALOG,
            "schema_name": self.DATABRICKS_SCHEMA,
            "volume": self.DATABRICKS_VOLUME,
            "volume_path": f"/Volumes/{self.DATABRICKS_CATALOG}/{self.DATABRICKS_SCHEMA}/{self.DATABRICKS_VOLUME}/",
            "auth_mode": self.auth_mode,
            "pat_configured": self.has_pat_token,
            "job_id_configured": self.has_job_id,
            "job_id": self.DATABRICKS_JOB_ID if self.has_job_id else None,
            "sql_configured": self.has_sql_config,
        }


settings = Settings()
