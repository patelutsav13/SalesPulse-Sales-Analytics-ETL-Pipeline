from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from app.config.settings import settings
from app.services.databricks_service import execute_query, DatabricksConfigError, DatabricksError
from app.services.forecast_service import compute_sales_forecast, format_month_label
from app.services import demo_service
from app.schemas.sales import (
    KPISummary,
    MonthlySalesItem,
    CategorySalesItem,
    RegionalSalesItem,
    TopProductItem,
    ForecastResponse,
    DataRecordsResponse,
    SalesRecord,
)

router = APIRouter(tags=["Analytics"])

CATEGORY_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"]


def _table(name: str) -> str:
    return f"`{settings.DATABRICKS_CATALOG}`.`{settings.DATABRICKS_SCHEMA}`.`{name}`"


def _run_sql_or_503(query: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    try:
        return execute_query(query, parameters=params)
    except DatabricksConfigError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except DatabricksError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected query error: {str(e)}")


@router.get("/dashboard/summary", response_model=KPISummary)
def get_dashboard_summary(mode: Optional[str] = Query(default=None)):
    """
    Single SQL query on mypyspark.sales_schema.sales_cleaned computing all KPIs
    and H2 vs H1 revenue growth in one fast round-trip.
    """
    if mode == "demo":
        return demo_service.get_demo_summary()

    rows = _run_sql_or_503(
        f"""
        SELECT
            ROUND(COALESCE(SUM(sales_amount), 0), 2) AS total_revenue,
            COUNT(DISTINCT order_id) AS total_orders,
            COUNT(DISTINCT product_id) AS total_products,
            COUNT(DISTINCT customer_id) AS total_customers,
            ROUND(COALESCE(SUM(sales_amount) / NULLIF(COUNT(DISTINCT order_id), 0), 0), 2) AS average_order_value,
            ROUND(COALESCE(SUM(CASE WHEN MONTH(CAST(order_date AS DATE)) <= 6 THEN sales_amount ELSE 0 END), 0), 2) AS h1_revenue,
            ROUND(COALESCE(SUM(CASE WHEN MONTH(CAST(order_date AS DATE)) > 6 THEN sales_amount ELSE 0 END), 0), 2) AS h2_revenue
        FROM {_table('sales_cleaned')}
        """
    )
    if not rows:
        return KPISummary(
            totalRevenue=0.0,
            totalOrders=0,
            totalProducts=0,
            averageOrderValue=0.0,
            totalCustomers=0,
            revenueGrowth=None,
            dataSource="databricks",
        )

    r = rows[0]
    h1 = float(r.get("h1_revenue") or 0.0)
    h2 = float(r.get("h2_revenue") or 0.0)
    growth = round(((h2 - h1) / h1) * 100.0, 1) if h1 > 0 else None

    return KPISummary(
        totalRevenue=float(r["total_revenue"] or 0.0),
        totalOrders=int(r["total_orders"] or 0),
        totalProducts=int(r["total_products"] or 0),
        averageOrderValue=float(r["average_order_value"] or 0.0),
        totalCustomers=int(r["total_customers"] or 0),
        revenueGrowth=growth,
        dataSource="databricks",
    )


@router.get("/analytics/monthly-sales", response_model=List[MonthlySalesItem])
def get_monthly_sales(mode: Optional[str] = Query(default=None)):
    """
    Single SQL query reading mypyspark.sales_schema.monthly_sales_summary (year, month, total_revenue)
    joined with order counts from sales_cleaned.
    """
    if mode == "demo":
        return demo_service.get_demo_monthly_sales()

    rows = _run_sql_or_503(
        f"""
        WITH monthly_orders AS (
            SELECT
                YEAR(CAST(order_date AS DATE)) AS yr,
                MONTH(CAST(order_date AS DATE)) AS mo,
                COUNT(DISTINCT order_id) AS orders
            FROM {_table('sales_cleaned')}
            GROUP BY YEAR(CAST(order_date AS DATE)), MONTH(CAST(order_date AS DATE))
        )
        SELECT
            m.year,
            m.month,
            ROUND(m.total_revenue, 2) AS revenue,
            COALESCE(o.orders, 0) AS orders
        FROM {_table('monthly_sales_summary')} m
        LEFT JOIN monthly_orders o
            ON m.year = o.yr AND m.month = o.mo
        ORDER BY m.year ASC, m.month ASC
        """
    )

    items: List[MonthlySalesItem] = []
    for r in rows:
        y = int(r["year"])
        m = int(r["month"])
        rev = round(float(r["revenue"] or 0.0), 2)
        orders = int(r["orders"] or 0)
        items.append(
            MonthlySalesItem(
                year=y,
                month=m,
                monthKey=f"{y}-{m:02d}",
                monthName=format_month_label(y, m),
                revenue=rev,
                orders=orders,
                avgOrderValue=round(rev / orders, 2) if orders > 0 else 0.0,
            )
        )
    return items


@router.get("/analytics/category-sales", response_model=List[CategorySalesItem])
def get_category_sales(mode: Optional[str] = Query(default=None)):
    """Single SQL query reading category_sales_summary enriched with order counts."""
    if mode == "demo":
        return demo_service.get_demo_category_sales()

    rows = _run_sql_or_503(
        f"""
        WITH cat_orders AS (
            SELECT category, COUNT(DISTINCT order_id) AS orders
            FROM {_table('sales_cleaned')}
            GROUP BY category
        )
        SELECT
            c.category,
            ROUND(c.revenue, 2) AS revenue,
            COALESCE(o.orders, 0) AS orders
        FROM {_table('category_sales_summary')} c
        LEFT JOIN cat_orders o ON c.category = o.category
        ORDER BY revenue DESC
        """
    )
    if not rows:
        return []

    grand_total = sum(float(r["revenue"] or 0.0) for r in rows) or 1.0
    return [
        CategorySalesItem(
            category=str(r["category"]),
            revenue=round(float(r["revenue"] or 0.0), 2),
            orders=int(r["orders"] or 0),
            percentage=round((float(r["revenue"] or 0.0) / grand_total) * 100.0, 1),
            fill=CATEGORY_COLORS[idx % len(CATEGORY_COLORS)],
        )
        for idx, r in enumerate(rows)
    ]


@router.get("/analytics/regional-sales", response_model=List[RegionalSalesItem])
def get_regional_sales(mode: Optional[str] = Query(default=None)):
    """Single SQL query reading regional_sales_summary enriched with order counts and AOV."""
    if mode == "demo":
        return demo_service.get_demo_regional_sales()

    rows = _run_sql_or_503(
        f"""
        WITH reg_orders AS (
            SELECT region, COUNT(DISTINCT order_id) AS orders
            FROM {_table('sales_cleaned')}
            GROUP BY region
        )
        SELECT
            r.region,
            ROUND(r.revenue, 2) AS revenue,
            COALESCE(o.orders, 0) AS orders
        FROM {_table('regional_sales_summary')} r
        LEFT JOIN reg_orders o ON r.region = o.region
        ORDER BY revenue DESC
        """
    )

    items: List[RegionalSalesItem] = []
    for r in rows:
        rev = round(float(r["revenue"] or 0.0), 2)
        orders = int(r["orders"] or 0)
        items.append(
            RegionalSalesItem(
                region=str(r["region"]),
                revenue=rev,
                orders=orders,
                avgOrderValue=round(rev / orders, 2) if orders > 0 else 0.0,
            )
        )
    return items


@router.get("/analytics/top-products", response_model=List[TopProductItem])
def get_top_products(mode: Optional[str] = Query(default=None)):
    """Single SQL query reading top_products_summary enriched with SKU, category, quantity, and price."""
    if mode == "demo":
        return demo_service.get_demo_top_products()

    rows = _run_sql_or_503(
        f"""
        WITH prod_details AS (
            SELECT
                product_name,
                MAX(product_id) AS product_id,
                MAX(category) AS category,
                SUM(quantity) AS quantity_sold,
                ROUND(AVG(unit_price), 2) AS avg_unit_price
            FROM {_table('sales_cleaned')}
            GROUP BY product_name
        )
        SELECT
            COALESCE(d.product_id, '') AS product_id,
            t.product_name,
            COALESCE(d.category, 'General') AS category,
            COALESCE(d.quantity_sold, 0) AS quantity_sold,
            COALESCE(d.avg_unit_price, 0.0) AS unit_price,
            ROUND(t.revenue, 2) AS total_revenue
        FROM {_table('top_products_summary')} t
        LEFT JOIN prod_details d ON t.product_name = d.product_name
        ORDER BY total_revenue DESC
        LIMIT 10
        """
    )

    return [
        TopProductItem(
            rank=idx,
            productId=str(r["product_id"] or f"SKU-{idx:02d}"),
            productName=str(r["product_name"]),
            category=str(r["category"] or "General"),
            quantitySold=int(r["quantity_sold"] or 0),
            unitPrice=round(float(r["unit_price"] or 0.0), 2),
            totalRevenue=round(float(r["total_revenue"] or 0.0), 2),
        )
        for idx, r in enumerate(rows, start=1)
    ]


@router.get("/forecast", response_model=ForecastResponse)
def get_sales_forecast(mode: Optional[str] = Query(default=None)):
    """Single lightweight SQL query on monthly_sales_summary powering the 3-month forecast."""
    if mode == "demo":
        return demo_service.get_demo_forecast()

    rows = _run_sql_or_503(
        f"""
        SELECT
            year,
            month,
            ROUND(total_revenue, 2) AS revenue
        FROM {_table('monthly_sales_summary')}
        ORDER BY year ASC, month ASC
        """
    )
    return compute_sales_forecast(rows, horizon_months=3, data_source="databricks")


@router.get("/data", response_model=DataRecordsResponse)
def get_data_records(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    region: Optional[str] = Query(default=None),
    mode: Optional[str] = Query(default=None),
):
    """Single SQL query with window COUNT(*) OVER() for fast paginated Delta exploration."""
    if mode == "demo":
        return demo_service.get_demo_records(
            page=page,
            page_size=pageSize,
            search=search,
            category=category,
            region=region,
        )

    where_clauses: List[str] = []
    params: Dict[str, Any] = {}

    if search and search.strip():
        where_clauses.append(
            "(LOWER(CAST(order_id AS STRING)) LIKE :search "
            "OR LOWER(CAST(customer_name AS STRING)) LIKE :search "
            "OR LOWER(CAST(product_name AS STRING)) LIKE :search)"
        )
        params["search"] = f"%{search.strip().lower()}%"

    if category and category != "All":
        where_clauses.append("category = :category")
        params["category"] = category

    if region and region != "All":
        where_clauses.append("region = :region")
        params["region"] = region

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
    offset = (page - 1) * pageSize

    data_rows = _run_sql_or_503(
        f"""
        SELECT
            order_id,
            CAST(order_date AS STRING) AS order_date,
            customer_id,
            customer_name,
            product_id,
            product_name,
            category,
            region,
            quantity,
            unit_price,
            sales_amount,
            COUNT(*) OVER() AS total_cnt
        FROM {_table('sales_cleaned')}
        {where_sql}
        ORDER BY order_date DESC, order_id DESC
        LIMIT {int(pageSize)} OFFSET {int(offset)}
        """,
        params=params,
    )

    total = int(data_rows[0]["total_cnt"]) if data_rows else 0
    records = [
        SalesRecord(
            order_id=str(r.get("order_id", "")),
            order_date=str(r.get("order_date", "")),
            customer_id=str(r.get("customer_id", "")) if r.get("customer_id") is not None else None,
            customer_name=str(r.get("customer_name", "")),
            product_id=str(r.get("product_id", "")) if r.get("product_id") is not None else None,
            product_name=str(r.get("product_name", "")),
            category=str(r.get("category", "")),
            region=str(r.get("region", "")),
            quantity=int(r.get("quantity") or 0),
            unit_price=round(float(r.get("unit_price") or 0.0), 2),
            sales_amount=round(float(r.get("sales_amount") or 0.0), 2),
        )
        for r in data_rows
    ]

    return DataRecordsResponse(
        total=total,
        page=page,
        pageSize=pageSize,
        records=records,
        dataSource="databricks",
    )
