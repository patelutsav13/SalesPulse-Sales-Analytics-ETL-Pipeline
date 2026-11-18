-- ==============================================================================
-- SalesPulse - Databricks Spark SQL Analytics Queries
-- Target Catalog: mypyspark
-- Target Schema:  sales_schema
-- ==============================================================================

USE CATALOG mypyspark;
USE SCHEMA sales_schema;

-- Verify all 5 existing tables and their row counts
SELECT 'sales_cleaned' AS table_name, COUNT(*) AS row_count FROM sales_cleaned
UNION ALL
SELECT 'monthly_sales_summary', COUNT(*) FROM monthly_sales_summary
UNION ALL
SELECT 'category_sales_summary', COUNT(*) FROM category_sales_summary
UNION ALL
SELECT 'regional_sales_summary', COUNT(*) FROM regional_sales_summary
UNION ALL
SELECT 'top_products_summary', COUNT(*) FROM top_products_summary;

-- Query 1: Executive KPI Summary
SELECT
    ROUND(SUM(sales_amount), 2) AS total_revenue,
    COUNT(DISTINCT order_id) AS total_orders,
    COUNT(DISTINCT product_id) AS total_products,
    COUNT(DISTINCT customer_id) AS total_customers,
    ROUND(SUM(sales_amount) / COUNT(DISTINCT order_id), 2) AS average_order_value
FROM sales_cleaned;

-- Query 2: Monthly Sales Trend (Matches existing year, month, total_revenue table)
SELECT
    year,
    month,
    total_revenue
FROM monthly_sales_summary
ORDER BY year ASC, month ASC;

-- Query 3: Category Performance
SELECT *
FROM category_sales_summary;

-- Query 4: Regional Performance
SELECT *
FROM regional_sales_summary;

-- Query 5: Top 10 Products
SELECT *
FROM top_products_summary;

-- Query 6: Delta Lake Table History (ACID Versioning & Time Travel)
DESCRIBE HISTORY sales_cleaned;
