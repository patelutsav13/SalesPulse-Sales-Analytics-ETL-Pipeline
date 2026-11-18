import math
from typing import List, Dict, Any
from app.schemas.sales import ForecastResponse, ForecastHistoricalItem, ForecastItem

MONTH_NAMES = [
    "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]


def format_month_label(year: int, month: int) -> str:
    m_name = MONTH_NAMES[month] if 1 <= month <= 12 else f"M{month:02d}"
    return f"{m_name} {year}"


def compute_sales_forecast(
    monthly_items: List[Dict[str, Any]],
    horizon_months: int = 3,
    data_source: str = "databricks",
) -> ForecastResponse:
    """
    Computes a simple, transparent 3-month sales forecast from actual historical
    monthly revenue using:
      1. 3-Month Moving Average (captures recent sales level)
      2. Ordinary Least Squares (OLS) Linear Trend Slope (captures overall direction)

    Uncertainty band = predicted +/- 1 historical monthly standard deviation.
    Does NOT invent statistical confidence percentages.
    """
    if not monthly_items:
        return ForecastResponse(
            methodology="3-Month Moving Average + Linear Trend (OLS)",
            assumptions="Requires at least 3 months of historical monthly sales.",
            limitations=["No historical monthly sales data available yet."],
            dataPointsUsed=0,
            movingAverage3m=0.0,
            monthlyTrendSlope=0.0,
            historical=[],
            forecast=[],
            insights=["Upload and process sales data to generate a forecast."],
            dataSource=data_source,
        )

    # Sort chronologically by (year, month)
    ordered = sorted(monthly_items, key=lambda x: (int(x["year"]), int(x["month"])))
    revenues = [float(item["revenue"]) for item in ordered]
    n = len(revenues)

    # Recent moving average (last up to 3 months)
    window = min(3, n)
    ma3 = sum(revenues[-window:]) / window

    # Simple OLS linear trend slope across all historical months
    if n >= 2:
        x_vals = list(range(n))
        x_mean = sum(x_vals) / n
        y_mean = sum(revenues) / n
        denom = sum((x - x_mean) ** 2 for x in x_vals)
        slope = (
            sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, revenues)) / denom
            if denom > 0
            else 0.0
        )
    else:
        y_mean = revenues[0]
        slope = 0.0

    # Historical sample standard deviation for honest +/- range
    if n >= 2:
        variance = sum((r - y_mean) ** 2 for r in revenues) / (n - 1)
        std_dev = math.sqrt(variance)
    else:
        std_dev = revenues[0] * 0.15

    # Build historical items (anchor the last actual point as predicted start for chart continuity)
    historical_list: List[ForecastHistoricalItem] = []
    for idx, item in enumerate(ordered):
        y, m = int(item["year"]), int(item["month"])
        rev = round(float(item["revenue"]), 2)
        historical_list.append(
            ForecastHistoricalItem(
                period=format_month_label(y, m),
                monthKey=f"{y}-{m:02d}",
                actual=rev,
                predicted=rev if idx == n - 1 else None,
                isForecast=False,
            )
        )

    # Forecast next horizon_months
    last_y = int(ordered[-1]["year"])
    last_m = int(ordered[-1]["month"])
    forecast_list: List[ForecastItem] = []
    curr_y, curr_m = last_y, last_m

    for step in range(1, horizon_months + 1):
        curr_m += 1
        if curr_m > 12:
            curr_m = 1
            curr_y += 1

        predicted = max(0.0, round(ma3 + slope * step, 2))
        lower_bound = max(0.0, round(predicted - std_dev, 2))
        upper_bound = round(predicted + std_dev, 2)

        forecast_list.append(
            ForecastItem(
                period=format_month_label(curr_y, curr_m),
                monthKey=f"{curr_y}-{curr_m:02d}",
                actual=None,
                predicted=predicted,
                lowerBound=lower_bound,
                upperBound=upper_bound,
                isForecast=True,
            )
        )

    projected_total = sum(f.predicted for f in forecast_list)
    trend_word = "upward" if slope > 5 else ("downward" if slope < -5 else "flat/stable")

    insights = [
        f"Based on {n} actual historical months, the recent {window}-month moving average is ${ma3:,.2f}/month.",
        f"Overall historical monthly trend is {trend_word} (${slope:+,.2f} per month).",
        f"Total projected revenue for the next {horizon_months} months is ${projected_total:,.2f} (illustrative estimate).",
    ]

    limitations = [
        f"Small dataset ({n} monthly data points): complex machine learning models (e.g., ARIMA/Prophet) would overfit.",
        "Estimates are NOT guaranteed — they do not account for sudden promotions, supply shortages, or external market changes.",
        f"Range shown reflects ±1 historical standard deviation (±${std_dev:,.2f}), not a formal probability guarantee.",
    ]

    return ForecastResponse(
        methodology=f"{window}-Month Moving Average + Simple Linear Trend (OLS)",
        assumptions="Assumes recent 3-month revenue levels and the linear historical trend continue without major external shocks.",
        limitations=limitations,
        dataPointsUsed=n,
        movingAverage3m=round(ma3, 2),
        monthlyTrendSlope=round(slope, 2),
        historical=historical_list,
        forecast=forecast_list,
        insights=insights,
        dataSource=data_source,
    )
