from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.etl_validator import validate_sales_csv
from app.services.databricks_service import (
    databricks_service,
    DatabricksConfigError,
    DatabricksError,
)
from app.schemas.sales import UploadResponse, ValidationReport

router = APIRouter(tags=["Dataset Upload"])


@router.post("/upload/validate", response_model=ValidationReport)
async def validate_dataset_only(file: UploadFile = File(...)):
    """Validates a CSV file locally without uploading to Databricks."""
    content = await file.read()
    is_valid, message, report = validate_sales_csv(content, file.filename or "")
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    return ValidationReport(**report)


@router.post("/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    """
    Validates the CSV file and uploads it to the configured Databricks Unity Catalog Volume.
    Returns an honest error if Databricks PAT or Volume permissions are missing.
    """
    content = await file.read()
    filename = file.filename or ""
    is_valid, message, report = validate_sales_csv(content, filename)

    if not is_valid:
        raise HTTPException(status_code=400, detail=message)

    try:
        staged_path = databricks_service.upload_to_volume(content, filename)
    except DatabricksConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except DatabricksError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return UploadResponse(
        success=True,
        message=f"Uploaded to Unity Catalog Volume. {message}",
        filename=filename,
        fileSize=len(content),
        recordCount=report["totalRows"],
        stagedPath=staged_path,
        validation=ValidationReport(**report),
        dataSource="databricks",
    )
