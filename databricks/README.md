# Databricks & PySpark Setup Guide for SalesPulse

This beginner-friendly guide explains how SalesPulse connects to your **Databricks Workspace**, **Unity Catalog (`mypyspark.sales_schema`)**, **Storage Volume (`sales_volume`)**, and **Serverless Starter SQL Warehouse**.

---

## 1. Data Flow Architecture

```
Raw CSV (data/sample_sales.csv)
       │
       ▼ Upload to Unity Catalog Volume
/Volumes/mypyspark/sales_schema/sales_volume/sample_sales.csv
       │
       ▼ PySpark Notebook (sales_etl_pipeline.py)
  • Explicit PySpark StructType schema
  • dropDuplicates(["order_id"])  -> removes 2 duplicate rows (82 -> 80)
  • Date, null & numeric validation
  • GroupBy & Window aggregations
       │
       ▼ 5 Unity Catalog Delta Tables (mypyspark.sales_schema)
  1. sales_cleaned            (80 rows)
  2. monthly_sales_summary    (12 rows: year, month, total_revenue)
  3. category_sales_summary   (3 rows)
  4. regional_sales_summary   (5 rows)
  5. top_products_summary     (10 rows)
       │
       ▼ Queried via Databricks SQL Warehouse (databricks-sql-connector)
FastAPI Backend (port 8000) ──► React Dashboard (port 5173)
```

---

## 2. Verify Existing Unity Catalog Objects

Run in Databricks **SQL Editor**:

```sql
USE CATALOG mypyspark;
USE SCHEMA sales_schema;

SHOW TABLES;
SHOW VOLUMES;
```

You should see the 5 Delta tables (`sales_cleaned`, `monthly_sales_summary`, `category_sales_summary`, `regional_sales_summary`, `top_products_summary`) and volume `sales_volume`.

---

## 3. Authentication: Browser OAuth vs. Personal Access Token (PAT)

| Feature | Browser OAuth (`DATABRICKS_TOKEN=` empty) | Personal Access Token (`DATABRICKS_TOKEN=dapi...`) |
| :--- | :---: | :---: |
| **SQL Warehouse Analytics Queries** (`/api/dashboard/summary`, `/api/analytics/*`, `/api/data`, `/api/forecast`) | Supported (opens browser login tab once) | Supported (no browser popup) |
| **Automated Volume CSV Upload** (`POST /api/upload`) | Requires PAT | Supported |
| **Databricks Jobs API Trigger & Status** (`POST /api/process`, `GET /api/jobs/{run_id}`) | Requires PAT + `DATABRICKS_JOB_ID` | Supported |

### Optional: Create a PAT Token & Job ID (for Automated Upload + Job Trigger)
1. **PAT Token:** Databricks $\rightarrow$ Profile icon (top right) $\rightarrow$ **Settings** $\rightarrow$ **Developer** $\rightarrow$ **Access tokens** $\rightarrow$ **Generate new token**. Paste into `backend/.env` as `DATABRICKS_TOKEN=...`.
2. **Databricks Job:** Databricks $\rightarrow$ **Workflows / Jobs & Pipelines** $\rightarrow$ **Create Job** $\rightarrow$ select your imported `sales_etl_pipeline.py` notebook $\rightarrow$ copy the numeric **Job ID** into `backend/.env` as `DATABRICKS_JOB_ID=...`.
3. Never commit `backend/.env` to GitHub (`.gitignore` already excludes it).

---

## 4. Starting the SQL Warehouse

Before opening SalesPulse in **Live Databricks** mode:
1. Open Databricks $\rightarrow$ **SQL Warehouses** $\rightarrow$ **Serverless Starter Warehouse**.
2. If the warehouse shows **Stopped**, click **▶ Start**.
