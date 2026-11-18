import io
from typing import Tuple, Dict, Any
import pandas as pd

REQUIRED_COLUMNS = [
    "order_id",
    "order_date",
    "customer_id",
    "customer_name",
    "product_id",
    "product_name",
    "category",
    "region",
    "quantity",
    "unit_price",
    "sales_amount",
]

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


def validate_sales_csv(content_bytes: bytes, filename: str) -> Tuple[bool, str, Dict[str, Any]]:
    """
    Performs comprehensive CSV validation before staging to Databricks Unity Catalog Volume:
      - File extension & size check
      - Required 11-column schema check
      - Duplicate order_id detection
      - Null value counting
      - Date format validation
      - Numeric (quantity, unit_price, sales_amount) validation
      - Accurate row counting & JSON-safe preview rows
    """
    if not filename or not filename.lower().endswith(".csv"):
        return False, "Invalid file type. Only .csv files are supported.", {}

    if not content_bytes or len(content_bytes) == 0:
        return False, "Uploaded CSV file is empty.", {}

    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        return False, "File exceeds the 50 MB maximum allowed size.", {}

    try:
        df = pd.read_csv(io.BytesIO(content_bytes))
    except UnicodeDecodeError:
        try:
            df = pd.read_csv(io.BytesIO(content_bytes), encoding="latin-1")
        except Exception as e:
            return False, f"Could not decode CSV file: {str(e)}", {}
    except Exception as e:
        return False, f"Failed to parse CSV file: {str(e)}", {}

    if df.empty:
        return False, "CSV contains headers but zero data rows.", {}

    # Normalize column names
    df.columns = [str(c).strip().lower() for c in df.columns]
    found_cols = list(df.columns)
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in found_cols]

    if missing_cols:
        return False, f"Missing required columns: {', '.join(missing_cols)}", {
            "totalRows": int(len(df)),
            "validRows": 0,
            "duplicateOrderIds": 0,
            "nullValueCount": 0,
            "invalidDateRows": 0,
            "invalidNumericRows": 0,
            "missingColumns": missing_cols,
            "foundColumns": found_cols,
            "previewRows": [],
        }

    total_rows = int(len(df))
    duplicate_order_ids = int(df["order_id"].duplicated().sum())
    null_value_count = int(df[REQUIRED_COLUMNS].isna().sum().sum())

    # Validate dates
    parsed_dates = pd.to_datetime(df["order_date"], errors="coerce")
    invalid_date_mask = parsed_dates.isna()
    invalid_date_rows = int(invalid_date_mask.sum())

    # Validate numeric fields
    qty = pd.to_numeric(df["quantity"], errors="coerce")
    price = pd.to_numeric(df["unit_price"], errors="coerce")
    amount = pd.to_numeric(df["sales_amount"], errors="coerce")

    invalid_numeric_mask = (
        qty.isna() | (qty <= 0)
        | price.isna() | (price <= 0)
        | amount.isna() | (amount < 0)
    )
    invalid_numeric_rows = int(invalid_numeric_mask.sum())

    # Valid unique rows estimate (mirrors PySpark silver cleaning logic)
    df_dedup = df.drop_duplicates(subset=["order_id"])
    dedup_dates = pd.to_datetime(df_dedup["order_date"], errors="coerce")
    dedup_qty = pd.to_numeric(df_dedup["quantity"], errors="coerce")
    dedup_price = pd.to_numeric(df_dedup["unit_price"], errors="coerce")
    dedup_amount = pd.to_numeric(df_dedup["sales_amount"], errors="coerce")

    valid_mask = (
        df_dedup["order_id"].notna()
        & dedup_dates.notna()
        & dedup_qty.notna() & (dedup_qty > 0)
        & dedup_price.notna() & (dedup_price > 0)
        & dedup_amount.notna() & (dedup_amount >= 0)
    )
    valid_rows = int(valid_mask.sum())

    if valid_rows == 0:
        return False, "No valid sales records found after schema, date, and numeric checks.", {
            "totalRows": total_rows,
            "validRows": 0,
            "duplicateOrderIds": duplicate_order_ids,
            "nullValueCount": null_value_count,
            "invalidDateRows": invalid_date_rows,
            "invalidNumericRows": invalid_numeric_rows,
            "missingColumns": [],
            "foundColumns": found_cols,
            "previewRows": [],
        }

    # Build JSON-safe preview of first 5 rows
    preview_df = df[REQUIRED_COLUMNS].head(5).fillna("")
    preview_rows = preview_df.to_dict(orient="records")

    report = {
        "totalRows": total_rows,
        "validRows": valid_rows,
        "duplicateOrderIds": duplicate_order_ids,
        "nullValueCount": null_value_count,
        "invalidDateRows": invalid_date_rows,
        "invalidNumericRows": invalid_numeric_rows,
        "missingColumns": [],
        "foundColumns": found_cols,
        "previewRows": preview_rows,
    }

    summary_msg = (
        f"CSV valid: {total_rows} rows ({valid_rows} clean unique rows, "
        f"{duplicate_order_ids} duplicate order IDs detected)."
    )
    return True, summary_msg, report
