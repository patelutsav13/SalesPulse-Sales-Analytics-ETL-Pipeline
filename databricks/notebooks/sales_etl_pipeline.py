# Databricks notebook source
# ==============================================================================
# SalesPulse – Beginner-Friendly PySpark ETL Pipeline
# Notebook: sales_etl_pipeline
#
# What this notebook does:
#   1. Reads raw sales CSV from Databricks Unity Catalog Volume
#   2. Inspects schema and counts input records
#   3. Cleans data: removes duplicate order_ids, checks nulls, dates & amounts
#   4. Creates / updates the 5 clean & aggregated Delta Lake tables in:
#        mypyspark.sales_schema
#   5. Calculates an explainable 3-month moving-average + trend forecast
#   6. Prints a clear ETL data quality report
# ==============================================================================

# COMMAND ----------
# DBTITLE 1,Step 0: Imports & Configurable Parameters
from datetime import datetime
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    col, to_date, year, month, date_format,
    sum as _sum, count as _count, avg as _avg,
    round as _round, when, lit, desc, row_number
)
from pyspark.sql.types import (
    StructType, StructField, StringType, IntegerType, DoubleType
)
from pyspark.sql.window import Window

# Get active Spark session (automatically created by Databricks)
spark = SparkSession.builder.appName("SalesPulse_ETL").getOrCreate()

# Job / Notebook parameters (can be passed from Databricks Jobs API)
dbutils.widgets.text("catalog_name", "mypyspark", "Unity Catalog Name")
dbutils.widgets.text("schema_name", "sales_schema", "Schema Name")
dbutils.widgets.text("volume_name", "sales_volume", "Volume Name")
dbutils.widgets.text("file_name", "sample_sales.csv", "CSV File Name")
dbutils.widgets.text("write_raw_table", "false", "Also save sales_raw table (true/false)")

CATALOG = dbutils.widgets.get("catalog_name").strip()
SCHEMA = dbutils.widgets.get("schema_name").strip()
VOLUME = dbutils.widgets.get("volume_name").strip()
FILE_NAME = dbutils.widgets.get("file_name").strip()
WRITE_RAW = dbutils.widgets.get("write_raw_table").strip().lower() == "true"

VOLUME_FILE_PATH = f"/Volumes/{CATALOG}/{SCHEMA}/{VOLUME}/{FILE_NAME}"
TARGET_DB = f"{CATALOG}.{SCHEMA}"

print(f"[INFO] Source CSV Path : {VOLUME_FILE_PATH}")
print(f"[INFO] Target Database : {TARGET_DB}")

# Use existing Unity Catalog and Schema (non-destructive)
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# COMMAND ----------
# DBTITLE 1,Step 1: Read CSV with Explicit Schema (Data Ingestion)
sales_schema = StructType([
    StructField("order_id", StringType(), True),
    StructField("order_date", StringType(), True),
    StructField("customer_id", StringType(), True),
    StructField("customer_name", StringType(), True),
    StructField("product_id", StringType(), True),
    StructField("product_name", StringType(), True),
    StructField("category", StringType(), True),
    StructField("region", StringType(), True),
    StructField("quantity", IntegerType(), True),
    StructField("unit_price", DoubleType(), True),
    StructField("sales_amount", DoubleType(), True),
])

df_raw = (
    spark.read
    .option("header", "true")
    .option("mode", "PERMISSIVE")
    .schema(sales_schema)
    .csv(VOLUME_FILE_PATH)
)

# Optional Bronze table (only written if explicitly enabled so existing workspace stays tidy)
if WRITE_RAW:
    df_raw.write.format("delta").mode("overwrite").saveAsTable(f"{TARGET_DB}.sales_raw")
    print(f"[INFO] Saved optional Bronze table: {TARGET_DB}.sales_raw")

# COMMAND ----------
# DBTITLE 1,Step 2: Data Inspection
input_count = df_raw.count()
print(f"[METRIC] Total Input Records Read: {input_count}")
df_raw.printSchema()
df_raw.show(5, truncate=False)
df_raw.select("quantity", "unit_price", "sales_amount").describe().show()

# COMMAND ----------
# DBTITLE 1,Step 3: Data Cleaning & Data Quality Validation
# 3A. Remove duplicate orders using primary key order_id
df_dedup = df_raw.dropDuplicates(["order_id"])
after_dedup_count = df_dedup.count()
duplicates_removed = input_count - after_dedup_count

# 3B. Parse order_date safely and compute expected sales_amount
df_typed = (
    df_dedup
    .withColumn("parsed_date", to_date(col("order_date"), "yyyy-MM-dd"))
    .withColumn("expected_amount", _round(col("quantity") * col("unit_price"), 2))
)

# 3C. Separate valid vs invalid rows (never silently discard without logging!)
valid_condition = (
    col("order_id").isNotNull()
    & col("parsed_date").isNotNull()
    & col("product_id").isNotNull()
    & col("category").isNotNull()
    & col("region").isNotNull()
    & (col("quantity") > 0)
    & (col("unit_price") > 0.0)
)

df_invalid = df_typed.filter(~valid_condition)
invalid_count = df_invalid.count()
if invalid_count > 0:
    print(f"[WARNING] Found {invalid_count} invalid rows (logged below):")
    df_invalid.show(10, truncate=False)

# Fill missing customer_name safely, reconcile sales_amount if null or <= 0
df_cleaned = (
    df_typed
    .filter(valid_condition)
    .withColumn("order_date", col("parsed_date"))
    .withColumn(
        "customer_name",
        when(col("customer_name").isNull(), lit("Unknown Customer")).otherwise(col("customer_name"))
    )
    .withColumn(
        "sales_amount",
        when(col("sales_amount").isNull() | (col("sales_amount") <= 0), col("expected_amount"))
        .otherwise(_round(col("sales_amount"), 2))
    )
    .withColumn("year", year(col("order_date")))
    .withColumn("month", month(col("order_date")))
    .withColumn("order_month", date_format(col("order_date"), "yyyy-MM"))
    .drop("parsed_date", "expected_amount")
)

cleaned_count = df_cleaned.count()
print(f"[QUALITY] Input={input_count} | Cleaned={cleaned_count} | DuplicatesRemoved={duplicates_removed} | InvalidFlagged={invalid_count}")

# Save Silver Table: sales_cleaned
(
    df_cleaned.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{TARGET_DB}.sales_cleaned")
)
print(f"[SUCCESS] Updated Delta table: {TARGET_DB}.sales_cleaned ({cleaned_count} rows)")

# COMMAND ----------
# DBTITLE 1,Step 4: Gold Layer Aggregations (Preserving Existing 5 Table Names)

# 1. monthly_sales_summary (preserves year, month, total_revenue + adds helpful order metrics)
df_monthly = (
    df_cleaned
    .groupBy("year", "month", "order_month")
    .agg(
        _round(_sum("sales_amount"), 2).alias("total_revenue"),
        _count("order_id").alias("total_orders"),
        _round(_avg("sales_amount"), 2).alias("avg_order_value"),
    )
    .orderBy("year", "month")
)
(
    df_monthly.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{TARGET_DB}.monthly_sales_summary")
)
print(f"[SUCCESS] Updated Delta table: {TARGET_DB}.monthly_sales_summary ({df_monthly.count()} rows)")

# 2. category_sales_summary
total_rev_value = df_cleaned.agg(_sum("sales_amount")).collect()[0][0] or 1.0
df_category = (
    df_cleaned
    .groupBy("category")
    .agg(
        _round(_sum("sales_amount"), 2).alias("total_revenue"),
        _count("order_id").alias("total_orders"),
    )
    .withColumn("percentage", _round((col("total_revenue") / lit(total_rev_value)) * 100.0, 1))
    .orderBy(desc("total_revenue"))
)
(
    df_category.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{TARGET_DB}.category_sales_summary")
)
print(f"[SUCCESS] Updated Delta table: {TARGET_DB}.category_sales_summary ({df_category.count()} rows)")

# 3. regional_sales_summary
df_regional = (
    df_cleaned
    .groupBy("region")
    .agg(
        _round(_sum("sales_amount"), 2).alias("total_revenue"),
        _count("order_id").alias("total_orders"),
        _round(_avg("sales_amount"), 2).alias("avg_order_value"),
    )
    .orderBy(desc("total_revenue"))
)
(
    df_regional.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{TARGET_DB}.regional_sales_summary")
)
print(f"[SUCCESS] Updated Delta table: {TARGET_DB}.regional_sales_summary ({df_regional.count()} rows)")

# 4. top_products_summary (top 10 ranked by total_revenue)
rank_window = Window.orderBy(desc("total_revenue"))
df_top_products = (
    df_cleaned
    .groupBy("product_id", "product_name", "category")
    .agg(
        _sum("quantity").alias("total_quantity_sold"),
        _round(_avg("unit_price"), 2).alias("avg_unit_price"),
        _round(_sum("sales_amount"), 2).alias("total_revenue"),
    )
    .withColumn("rank", row_number().over(rank_window))
    .filter(col("rank") <= 10)
    .orderBy("rank")
)
(
    df_top_products.write
    .format("delta")
    .mode("overwrite")
    .option("overwriteSchema", "true")
    .saveAsTable(f"{TARGET_DB}.top_products_summary")
)
print(f"[SUCCESS] Updated Delta table: {TARGET_DB}.top_products_summary ({df_top_products.count()} rows)")

# COMMAND ----------
# DBTITLE 1,Step 5: Simple, Explainable 3-Month Forecast (Moving Average + Linear Trend)
# Note: This is an illustrative baseline forecast, NOT a guaranteed prediction.
# With only 12 monthly observations, complex ML models would overfit.
monthly_rows = df_monthly.orderBy("year", "month").collect()
n = len(monthly_rows)

if n >= 3:
    revenues = [float(r["total_revenue"]) for r in monthly_rows]
    last_year = int(monthly_rows[-1]["year"])
    last_month = int(monthly_rows[-1]["month"])

    # Compute simple ordinary least squares (OLS) linear trend slope across all historical months
    x_vals = list(range(n))
    x_mean = sum(x_vals) / n
    y_mean = sum(revenues) / n
    denom = sum((x - x_mean) ** 2 for x in x_vals) or 1.0
    slope = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, revenues)) / denom

    # Anchor baseline on the last 3-month moving average
    ma3 = sum(revenues[-3:]) / 3.0

    print("\n--- Explainable 3-Month Forecast Preview (3-Month Moving Avg + Linear Trend) ---")
    print(f"Historical months used: {n} | 3-Month Moving Avg: ${ma3:,.2f} | Monthly Trend Slope: ${slope:,.2f}")
    curr_y, curr_m = last_year, last_month
    for step in range(1, 4):
        curr_m += 1
        if curr_m > 12:
            curr_m = 1
            curr_y += 1
        predicted = max(0.0, round(ma3 + slope * step, 2))
        print(f"  Forecast {curr_y}-{curr_m:02d}: ${predicted:,.2f}")

# COMMAND ----------
# DBTITLE 1,Step 6: Final Pipeline Execution Summary
print("==================================================================")
print("             SALESPULSE PYSPARK ETL SUMMARY REPORT                ")
print("==================================================================")
print(f"Execution UTC Time     : {datetime.utcnow().isoformat()}")
print(f"Source Volume File     : {VOLUME_FILE_PATH}")
print(f"Target Schema          : {TARGET_DB}")
print(f"Input Records          : {input_count}")
print(f"Cleaned Records        : {cleaned_count}")
print(f"Duplicates Removed     : {duplicates_removed}")
print(f"Invalid Records Flagged: {invalid_count}")
print(f"Total Cleaned Revenue  : ${total_rev_value:,.2f}")
print("Status                 : COMPLETED")
print("==================================================================")
