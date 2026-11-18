from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class HealthResponse(BaseModel):
    status: str
    backend_connected: bool
    databricks_connected: bool
    sql_warehouse_connected: bool
    auth_mode: str
    sql_auth_mode: str
    jobs_api_auth_mode: str
    jobs_api_ready: bool
    workspace: Optional[str] = None
    catalog: str
    schema_name: str
    volume: str
    pat_configured: bool
    job_id_configured: bool
    job_id: Optional[str] = None
    message: str
    timestamp: str


class ConfigStatusResponse(BaseModel):
    server_hostname: str
    warehouse_id: str
    http_path_configured: bool
    catalog: str
    schema_name: str
    volume: str
    volume_path: str
    auth_mode: str
    jobs_auth_mode: str
    pat_configured: bool
    job_id_configured: bool
    job_id: Optional[str] = None
    sql_configured: bool


class KPISummary(BaseModel):
    totalRevenue: float
    totalOrders: int
    totalProducts: int
    averageOrderValue: float
    totalCustomers: int
    revenueGrowth: Optional[float] = None
    dataSource: str = "databricks"


class MonthlySalesItem(BaseModel):
    year: int
    month: int
    monthKey: str
    monthName: str
    revenue: float
    orders: int
    avgOrderValue: float


class CategorySalesItem(BaseModel):
    category: str
    revenue: float
    orders: int
    percentage: float
    fill: Optional[str] = None


class RegionalSalesItem(BaseModel):
    region: str
    revenue: float
    orders: int
    avgOrderValue: float


class TopProductItem(BaseModel):
    rank: int
    productId: str
    productName: str
    category: str
    quantitySold: int
    unitPrice: float
    totalRevenue: float


class ForecastHistoricalItem(BaseModel):
    period: str
    monthKey: str
    actual: float
    predicted: Optional[float] = None
    isForecast: bool = False


class ForecastItem(BaseModel):
    period: str
    monthKey: str
    actual: Optional[float] = None
    predicted: float
    lowerBound: float
    upperBound: float
    isForecast: bool = True


class ForecastResponse(BaseModel):
    methodology: str
    assumptions: str
    limitations: List[str]
    dataPointsUsed: int
    movingAverage3m: float
    monthlyTrendSlope: float
    historical: List[ForecastHistoricalItem]
    forecast: List[ForecastItem]
    insights: List[str]
    dataSource: str = "databricks"


class ValidationReport(BaseModel):
    totalRows: int
    validRows: int
    duplicateOrderIds: int
    nullValueCount: int
    invalidDateRows: int
    invalidNumericRows: int
    missingColumns: List[str] = []
    foundColumns: List[str] = []
    previewRows: List[Dict[str, Any]] = []


class UploadResponse(BaseModel):
    success: bool
    message: str
    filename: str
    fileSize: int
    recordCount: int
    stagedPath: str
    validation: ValidationReport
    dataSource: str = "databricks"


class ProcessRequest(BaseModel):
    volume_path: Optional[str] = None
    file_name: Optional[str] = None


class ProcessResponse(BaseModel):
    success: bool
    runId: str
    jobId: str
    jobName: str
    status: str
    message: str
    runPageUrl: Optional[str] = None


class JobRunStatus(BaseModel):
    runId: str
    jobId: Optional[str] = None
    jobName: str
    status: str
    lifeCycleState: Optional[str] = None
    resultState: Optional[str] = None
    stateMessage: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    duration: Optional[str] = None
    runPageUrl: Optional[str] = None
    targetTables: List[str] = []
    logs: List[str] = []
    dataSource: str = "databricks"


class SalesRecord(BaseModel):
    order_id: str
    order_date: str
    customer_id: Optional[str] = None
    customer_name: str
    product_id: Optional[str] = None
    product_name: str
    category: str
    region: str
    quantity: int
    unit_price: float
    sales_amount: float


class DataRecordsResponse(BaseModel):
    total: int
    page: int
    pageSize: int
    records: List[SalesRecord]
    dataSource: str = "databricks"
