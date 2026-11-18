# Databricks & PySpark Setup Guide for SalesPulse

This beginner-friendly guide explains how SalesPulse connects to your **Databricks Workspace**, **Unity Catalog (`mypyspark.sales_schema`)**, **Storage Volume (`sales_volume`)**, **Serverless PySpark Job**, and **Serverless Starter SQL Warehouse**.

---

## 1. Data Flow Architecture

```
Raw CSV (data/sample_sales.csv)
       │
       ▼ Upload to Unity Catalog Volume (Databricks SDK OAuth / optional PAT)
/Volumes/mypyspark/sales_schema/sales_volume/sample_sales.csv
       │
       ▼ Serverless Databricks Job -> PySpark Notebook (sales_etl_pipeline.py)
  • Explicit PySpark StructType schema
  • dropDuplicates(["order_id"])  -> removes 2 duplicate rows (82 -> 80)
  • Date, null & numeric validation
  • GroupBy & Window aggregations
       │
       ▼ 5 Unity Catalog Delta Tables (mypyspark.sales_schema)
  1. sales_cleaned            (80 rows)
  2. monthly_sales_summary    (12 rows: year, month, total_revenue)
  3. category_sales_summary   (3 rows: category, revenue)
  4. regional_sales_summary   (5 rows: region, revenue)
  5. top_products_summary     (10 rows: product_name, revenue)
       │
       ▼ Queried via Databricks SQL Warehouse (databricks-sql-connector OAuth)
FastAPI Backend (port 8000) ──► React Dashboard (port 5173)
```

---

## 2. Verify Unity Catalog Objects

Run in Databricks **SQL Editor**:

```sql
USE CATALOG mypyspark;
USE SCHEMA sales_schema;

SHOW TABLES;
SHOW VOLUMES;
```

You should see the 5 Delta tables (`sales_cleaned`, `monthly_sales_summary`, `category_sales_summary`, `regional_sales_summary`, `top_products_summary`) and volume `sales_volume`.

---

## 3. Authentication: OAuth-First (Tested) + Optional PAT Fallback

SalesPulse works **end-to-end with Databricks OAuth alone** — you do **not** need a Personal Access Token (PAT) for local development:

| Feature | Browser OAuth (`DATABRICKS_TOKEN=` empty — Default) | Optional PAT Fallback (`DATABRICKS_TOKEN=dapi...`) |
| :--- | :--- | :--- |
| **SQL Warehouse Analytics Queries** (`/api/dashboard/summary`, `/api/analytics/*`, `/api/data`, `/api/forecast`) | Supported via `databricks-sql-connector` (`auth_type="databricks-oauth"`, cached in git-ignored `backend/.databricks_oauth_token.json`) | Supported (no browser sign-in popup) |
| **Unity Catalog Volume CSV Upload** (`POST /api/upload`) | Supported via `databricks-sdk` (`auth_type="external-browser"`, cached in `~/.databricks/token-cache.json`) | Supported (no browser sign-in popup) |
| **Databricks Jobs API Trigger & Status** (`POST /api/process`, `GET /api/jobs`, `GET /api/jobs/{run_id}`) | Supported via `databricks-sdk` (`auth_type="external-browser"`) — requires numeric `DATABRICKS_JOB_ID` in `backend/.env` | Supported (no browser sign-in popup) |

### Creating Your Databricks Job (Required for Live Job Triggering)
1. Import [`databricks/notebooks/sales_etl_pipeline.py`](notebooks/sales_etl_pipeline.py) into your Databricks Workspace.
2. Go to **Jobs & Pipelines** $\rightarrow$ **Create Job**.
3. Configure Task:
   * **Task name:** `sales_etl_task`
   * **Type:** Notebook
   * **Notebook path:** Your imported `sales_etl_pipeline` notebook
   * **Compute:** Serverless (or an existing cluster)
4. Save the Job and copy its numeric **Job ID** into `backend/.env` as `DATABRICKS_JOB_ID=<your_job_id>`.

### Optional PAT Fallback (Only If Desired for Non-Interactive / Headless Auth)
If you prefer non-interactive authentication without browser OAuth sign-in:
1. Databricks $\rightarrow$ Profile icon (top right) $\rightarrow$ **Settings** $\rightarrow$ **Developer** $\rightarrow$ **Access tokens** $\rightarrow$ **Generate new token**.
2. Paste into `backend/.env` as `DATABRICKS_TOKEN=dapi...` and restart FastAPI.
3. **Never** commit `backend/.env` to GitHub (`.gitignore` excludes it automatically).

---

## 4. Starting the SQL Warehouse

Before opening SalesPulse in **Live Databricks** mode:
1. Open Databricks $\rightarrow$ **SQL Warehouses** $\rightarrow$ **Serverless Starter Warehouse**.
2. If the warehouse shows **Stopped**, click **▶ Start**.
