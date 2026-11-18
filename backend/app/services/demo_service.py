from functools import lru_cache
from pathlib import Path
from typing import List, Optional
import pandas as pd
from app.schemas.sales import (
    KPISummary,
    MonthlySalesItem,
    CategorySalesItem,
    RegionalSalesItem,
    TopProductItem,
    ForecastResponse,
    SalesRecord,
    DataRecordsResponse,
)
from app.services.forecast_service import compute_sales_forecast, format_month_label

PROJECT_ROOT = Path(__file__).resolve().parents[3]
SAMPLE_CSV_PATH = PROJECT_ROOT / "data" / "sample_sales.csv"
CATEGORY_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b"]


@lru_cache(maxsize=1)
def _load_cleaned_sample_df() -> pd.DataFrame:
    """Loads and cleans data/sample_sales.csv using the exact same rules as PySpark."""
    df = pd.read_csv(SAMPLE_CSV_PATH)
    df = df.drop_duplicates(subset=["order_id"]).copy()
    df["order_date_dt"] = pd.to_datetime(df["order_date"], errors="coerce")
    df = df[df["order_date_dt"].notna() & (df["quantity"] > 0) & (df["unit_price"] > 0)]
    df["year"] = df["order_date_dt"].dt.year.astype(int)
    df["month"] = df["order_date_dt"].dt.month.astype(int)
    df["sales_amount"] = df["sales_amount"].astype(float).round(2)
    return df


def get_demo_summary() -> KPISummary:
    df = _load_cleaned_sample_df()
    total_rev = round(float(df["sales_amount"].sum()), 2)
    total_orders = int(df["order_id"].nunique())
    total_products = int(df["product_id"].nunique())
    total_customers = int(df["customer_id"].nunique())
    aov = round(total_rev / total_orders, 2) if total_orders else 0.0

    # Calculate simple H2 vs H1 revenue growth from actual sample CSV
    h1 = float(df[df["month"] <= 6]["sales_amount"].sum())
    h2 = float(df[df["month"] > 6]["sales_amount"].sum())
    growth = round(((h2 - h1) / h1) * 100.0, 1) if h1 > 0 else None

    return KPISummary(
        totalRevenue=total_rev,
        totalOrders=total_orders,
        totalProducts=total_products,
        averageOrderValue=aov,
        totalCustomers=total_customers,
        revenueGrowth=growth,
        dataSource="demo",
    )


def get_demo_monthly_sales() -> List[MonthlySalesItem]:
    df = _load_cleaned_sample_df()
    grouped = (
        df.groupby(["year", "month"], as_index=False)
        .agg(
            revenue=("sales_amount", "sum"),
            orders=("order_id", "nunique"),
        )
        .sort_values(["year", "month"])
    )
    items: List[MonthlySalesItem] = []
    for _, row in grouped.iterrows():
        y, m = int(row["year"]), int(row["month"])
        rev = round(float(row["revenue"]), 2)
        orders = int(row["orders"])
        items.append(
            MonthlySalesItem(
                year=y,
                month=m,
                monthKey=f"{y}-{m:02d}",
                monthName=format_month_label(y, m),
                revenue=rev,
                orders=orders,
                avgOrderValue=round(rev / orders, 2) if orders else 0.0,
            )
        )
    return items


def get_demo_category_sales() -> List[CategorySalesItem]:
    df = _load_cleaned_sample_df()
    total_rev = float(df["sales_amount"].sum()) or 1.0
    grouped = (
        df.groupby("category", as_index=False)
        .agg(revenue=("sales_amount", "sum"), orders=("order_id", "nunique"))
        .sort_values("revenue", ascending=False)
    )
    items: List[CategorySalesItem] = []
    for idx, (_, row) in enumerate(grouped.iterrows()):
        rev = round(float(row["revenue"]), 2)
        items.append(
            CategorySalesItem(
                category=str(row["category"]),
                revenue=rev,
                orders=int(row["orders"]),
                percentage=round((rev / total_rev) * 100.0, 1),
                fill=CATEGORY_COLORS[idx % len(CATEGORY_COLORS)],
            )
        )
    return items


def get_demo_regional_sales() -> List[RegionalSalesItem]:
    df = _load_cleaned_sample_df()
    grouped = (
        df.groupby("region", as_index=False)
        .agg(revenue=("sales_amount", "sum"), orders=("order_id", "nunique"))
        .sort_values("revenue", ascending=False)
    )
    items: List[RegionalSalesItem] = []
    for _, row in grouped.iterrows():
        rev = round(float(row["revenue"]), 2)
        orders = int(row["orders"])
        items.append(
            RegionalSalesItem(
                region=str(row["region"]),
                revenue=rev,
                orders=orders,
                avgOrderValue=round(rev / orders, 2) if orders else 0.0,
            )
        )
    return items


def get_demo_top_products() -> List[TopProductItem]:
    df = _load_cleaned_sample_df()
    grouped = (
        df.groupby(["product_id", "product_name", "category"], as_index=False)
        .agg(
            quantitySold=("quantity", "sum"),
            unitPrice=("unit_price", "mean"),
            totalRevenue=("sales_amount", "sum"),
        )
        .sort_values("totalRevenue", ascending=False)
        .head(10)
    )
    items: List[TopProductItem] = []
    for rank, (_, row) in enumerate(grouped.iterrows(), start=1):
        items.append(
            TopProductItem(
                rank=rank,
                productId=str(row["product_id"]),
                productName=str(row["product_name"]),
                category=str(row["category"]),
                quantitySold=int(row["quantitySold"]),
                unitPrice=round(float(row["unitPrice"]), 2),
                totalRevenue=round(float(row["totalRevenue"]), 2),
            )
        )
    return items


def get_demo_forecast() -> ForecastResponse:
    monthly = [item.model_dump() for item in get_demo_monthly_sales()]
    return compute_sales_forecast(monthly, horizon_months=3, data_source="demo")


def get_demo_records(
    page: int = 1,
    page_size: int = 10,
    search: Optional[str] = None,
    category: Optional[str] = None,
    region: Optional[str] = None,
) -> DataRecordsResponse:
    df = _load_cleaned_sample_df()
    if search:
        q = search.strip().lower()
        mask = (
            df["order_id"].str.lower().str.contains(q, na=False)
            | df["customer_name"].str.lower().str.contains(q, na=False)
            | df["product_name"].str.lower().str.contains(q, na=False)
        )
        df = df[mask]
    if category and category != "All":
        df = df[df["category"] == category]
    if region and region != "All":
        df = df[df["region"] == region]

    total = int(len(df))
    start = (page - 1) * page_size
    page_df = df.sort_values("order_date", ascending=False).iloc[start : start + page_size]

    records = [
        SalesRecord(
            order_id=str(row["order_id"]),
            order_date=str(row["order_date"]),
            customer_id=str(row["customer_id"]),
            customer_name=str(row["customer_name"]),
            product_id=str(row["product_id"]),
            product_name=str(row["product_name"]),
            category=str(row["category"]),
            region=str(row["region"]),
            quantity=int(row["quantity"]),
            unit_price=round(float(row["unit_price"]), 2),
            sales_amount=round(float(row["sales_amount"]), 2),
        )
        for _, row in page_df.iterrows()
    ]
    return DataRecordsResponse(
        total=total,
        page=page,
        pageSize=page_size,
        records=records,
        dataSource="demo",
    )
