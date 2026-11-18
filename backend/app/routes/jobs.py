from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.services.databricks_service import (
    databricks_service,
    DatabricksConfigError,
    DatabricksError,
)
from app.schemas.sales import ProcessRequest, ProcessResponse, JobRunStatus

router = APIRouter(tags=["Databricks Jobs"])


@router.post("/process", response_model=ProcessResponse)
def trigger_processing(request: Optional[ProcessRequest] = None):
    """Triggers the configured Databricks PySpark ETL Job via Jobs API."""
    try:
        vol_path = request.volume_path if request else None
        file_name = request.file_name if request else None
        result = databricks_service.trigger_etl_job(volume_path=vol_path, file_name=file_name)
        return ProcessResponse(**result)
    except DatabricksConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except DatabricksError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/jobs", response_model=List[JobRunStatus])
def list_recent_jobs(limit: int = Query(5, ge=1, le=20)):
    """Lists recent real Databricks Job runs for the configured DATABRICKS_JOB_ID."""
    try:
        return databricks_service.list_recent_runs(limit=limit)
    except DatabricksConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except DatabricksError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/jobs/{run_id}", response_model=JobRunStatus)
def get_job_status(run_id: str):
    """Fetches real-time status, timing, and logs for a Databricks Job run ID."""
    try:
        return databricks_service.get_job_status(run_id)
    except DatabricksConfigError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except DatabricksError as e:
        raise HTTPException(status_code=502, detail=str(e))
