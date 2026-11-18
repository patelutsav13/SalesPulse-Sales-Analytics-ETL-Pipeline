import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import settings
from app.services.databricks_service import databricks_service, close_shared_connection
from app.schemas.sales import HealthResponse, ConfigStatusResponse
from app.routes.upload import router as upload_router
from app.routes.jobs import router as jobs_router
from app.routes.analytics import router as analytics_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("salespulse")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    close_shared_connection()


app = FastAPI(
    title="SalesPulse – Sales Analytics & Forecasting Platform API",
    description="FastAPI backend connecting React.js with Databricks SQL Warehouse, Unity Catalog Volumes, and Jobs API.",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware for React Vite Local Dev (Port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(upload_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")


@app.get("/", tags=["Root"])
def read_root():
    return {
        "platform": "SalesPulse – Sales Analytics & Forecasting API",
        "version": "1.1.0",
        "status": "online",
        "catalog": f"{settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA}",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/config/status", response_model=ConfigStatusResponse, tags=["System"])
def get_config_status():
    """Returns non-secret Databricks configuration for the Settings page."""
    return ConfigStatusResponse(**settings.safe_public_config())


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
def health_check(check_databricks: bool = Query(default=True)):
    """
    Health check endpoint.
    When check_databricks=true (default), tests live Databricks SQL Warehouse connectivity.
    """
    is_connected = False
    reason = "Databricks connectivity check skipped."

    if check_databricks:
        db_status = databricks_service.test_connection()
        is_connected = bool(db_status.get("connected", False))
        reason = db_status.get("reason", "")

    if is_connected:
        msg = f"Connected to Databricks SQL Warehouse ({settings.DATABRICKS_CATALOG}.{settings.DATABRICKS_SCHEMA})."
        status_label = "healthy"
    else:
        msg = f"FastAPI backend is online. Databricks SQL Warehouse not connected: {reason}"
        status_label = "degraded"

    return HealthResponse(
        status=status_label,
        backend_connected=True,
        databricks_connected=is_connected,
        sql_warehouse_connected=is_connected,
        auth_mode=settings.auth_mode,
        sql_auth_mode=settings.auth_mode,
        jobs_api_auth_mode=settings.jobs_auth_mode,
        jobs_api_ready=bool(settings.workspace_url and settings.has_job_id),
        workspace=settings.server_hostname or None,
        catalog=settings.DATABRICKS_CATALOG,
        schema_name=settings.DATABRICKS_SCHEMA,
        volume=settings.DATABRICKS_VOLUME,
        pat_configured=settings.has_pat_token,
        job_id_configured=settings.has_job_id,
        job_id=settings.DATABRICKS_JOB_ID.strip() if settings.has_job_id else None,
        message=msg,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
