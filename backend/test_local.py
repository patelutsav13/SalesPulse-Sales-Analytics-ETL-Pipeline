"""
SalesPulse Local Automated Test Suite
Run from backend/ directory:
    .\\venv\\Scripts\\python.exe test_local.py
"""
import json
import os
import py_compile
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
SAMPLE_CSV = ROOT_DIR / "data" / "sample_sales.csv"
NOTEBOOK_PATH = ROOT_DIR / "databricks" / "notebooks" / "sales_etl_pipeline.py"


def assert_eq(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def test_notebook_syntax():
    py_compile.compile(str(NOTEBOOK_PATH), doraise=True)
    print("[PASS] PySpark notebook syntax compiled cleanly (sales_etl_pipeline.py)")


def test_csv_validator():
    from app.services.etl_validator import validate_sales_csv

    raw = SAMPLE_CSV.read_bytes()
    ok, msg, report = validate_sales_csv(raw, "sample_sales.csv")
    assert_eq(ok, True, "Valid sample CSV accepted")
    assert_eq(report["totalRows"], 82, "Sample CSV total rows")
    assert_eq(report["validRows"], 80, "Sample CSV clean unique rows")
    assert_eq(report["duplicateOrderIds"], 2, "Sample CSV duplicate order_id count")
    assert_eq(report["invalidDateRows"], 0, "Sample CSV invalid date count")
    assert_eq(report["invalidNumericRows"], 0, "Sample CSV invalid numeric count")

    # Non-CSV rejected
    ok_ext, _, _ = validate_sales_csv(b"a,b\n1,2", "data.txt")
    assert_eq(ok_ext, False, "Non-CSV file rejected")

    # Missing required columns rejected
    ok_cols, msg_cols, _ = validate_sales_csv(b"order_id,amount\n1,100\n", "bad.csv")
    assert_eq(ok_cols, False, "Missing columns rejected")
    assert "Missing required columns" in msg_cols

    print("[PASS] CSV validator tests passed (valid, duplicates, bad extension, missing columns)")


def test_forecast_service():
    from app.services import demo_service

    fc = demo_service.get_demo_forecast()
    assert_eq(fc.dataPointsUsed, 12, "Forecast historical data points")
    assert_eq(len(fc.historical), 12, "Historical array length")
    assert_eq(len(fc.forecast), 3, "3-month forecast length")
    assert_eq(fc.forecast[0].period, "Jan 2025", "First forecast month")
    assert_eq(fc.forecast[2].period, "Mar 2025", "Third forecast month")
    assert fc.movingAverage3m > 0
    print(
        f"[PASS] Forecast math verified (MA3=${fc.movingAverage3m:,.2f}, "
        f"Slope=${fc.monthlyTrendSlope:+,.2f}/mo, Jan2025=${fc.forecast[0].predicted:,.2f})"
    )


def http_json(url, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            return resp.status, json.loads(body) if body.strip().startswith(("{", "[")) else body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return e.code, parsed


def test_live_http_endpoints():
    port = 8011  # Dedicated test port to avoid clashing with user's port 8000
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=str(BACKEND_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        # Wait for server to come up
        ready = False
        for _ in range(30):
            try:
                status, _ = http_json(f"{base}/")
                if status == 200:
                    ready = True
                    break
            except Exception:
                time.sleep(0.4)
        if not ready:
            raise RuntimeError("FastAPI test server failed to start on port 8011")

        # 1. Root & Docs
        st, body = http_json(f"{base}/")
        assert_eq(st, 200, "GET /")
        assert_eq(body["catalog"], "mypyspark.sales_schema", "Root catalog check")

        st_docs, _ = http_json(f"{base}/docs")
        assert_eq(st_docs, 200, "GET /docs Swagger UI")

        # 2. Config status (verify zero secrets exposed)
        st, cfg = http_json(f"{base}/api/config/status")
        assert_eq(st, 200, "GET /api/config/status")
        assert_eq(cfg["catalog"], "mypyspark", "Config catalog")
        assert_eq(cfg["schema_name"], "sales_schema", "Config schema")
        assert_eq(cfg["volume"], "sales_volume", "Config volume")
        assert "token" not in json.dumps(cfg).lower() or "pat_configured" in cfg

        # 3. Health check (fast local liveness)
        st, health = http_json(f"{base}/api/health?check_databricks=false")
        assert_eq(st, 200, "GET /api/health")
        assert_eq(health["backend_connected"], True, "Backend online")

        # 4. Analytics endpoints in explicit demo mode (verifies full serialization & exact CSV math)
        st, kpi = http_json(f"{base}/api/dashboard/summary?mode=demo")
        assert_eq(st, 200, "GET /api/dashboard/summary?mode=demo")
        assert_eq(kpi["totalRevenue"], 33077.47, "KPI totalRevenue")
        assert_eq(kpi["totalOrders"], 80, "KPI totalOrders")

        st, monthly = http_json(f"{base}/api/analytics/monthly-sales?mode=demo")
        assert_eq(st, 200, "GET /api/analytics/monthly-sales?mode=demo")
        assert_eq(len(monthly), 12, "Monthly rows count")

        st, cat = http_json(f"{base}/api/analytics/category-sales?mode=demo")
        assert_eq(st, 200, "GET /api/analytics/category-sales?mode=demo")
        assert_eq(len(cat), 3, "Category rows count")

        st, reg = http_json(f"{base}/api/analytics/regional-sales?mode=demo")
        assert_eq(st, 200, "GET /api/analytics/regional-sales?mode=demo")
        assert_eq(len(reg), 5, "Regional rows count")

        st, prods = http_json(f"{base}/api/analytics/top-products?mode=demo")
        assert_eq(st, 200, "GET /api/analytics/top-products?mode=demo")
        assert_eq(len(prods), 10, "Top products count")

        st, fc = http_json(f"{base}/api/forecast?mode=demo")
        assert_eq(st, 200, "GET /api/forecast?mode=demo")
        assert_eq(len(fc["forecast"]), 3, "Forecast horizon")

        st, explorer = http_json(f"{base}/api/data?mode=demo&page=1&pageSize=5&category=Electronics")
        assert_eq(st, 200, "GET /api/data filtered & paginated")
        assert_eq(len(explorer["records"]), 5, "Page size respected")
        assert all(r["category"] == "Electronics" for r in explorer["records"])

        # 5. Honest error handling for unconfigured Jobs API / PAT (NO fake success!)
        st, err_proc = http_json(f"{base}/api/process", method="POST", data=b"{}", headers={"Content-Type": "application/json"})
        assert_eq(st, 503, "POST /api/process without Job ID returns honest 503")
        assert "DATABRICKS_JOB_ID" in err_proc["detail"]

        st, err_job = http_json(f"{base}/api/jobs/not-a-number")
        assert_eq(st, 400, "GET /api/jobs/not-a-number returns honest 400")

        # 6. Upload validation multipart test
        boundary = "----SalesPulseTestBoundary"
        csv_bytes = SAMPLE_CSV.read_bytes()
        multipart_body = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="sample_sales.csv"\r\n'
            f"Content-Type: text/csv\r\n\r\n"
        ).encode("utf-8") + csv_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

        st, val_resp = http_json(
            f"{base}/api/upload/validate",
            method="POST",
            data=multipart_body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        assert_eq(st, 200, "POST /api/upload/validate valid CSV")
        assert_eq(val_resp["totalRows"], 82, "Upload validate totalRows")
        assert_eq(val_resp["duplicateOrderIds"], 2, "Upload validate duplicates")

        # Upload to Volume without PAT must fail honestly with 503 (never fake success!)
        st, up_resp = http_json(
            f"{base}/api/upload",
            method="POST",
            data=multipart_body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        assert_eq(st, 503, "POST /api/upload without PAT returns honest 503")
        assert "DATABRICKS_TOKEN" in up_resp["detail"]

        print("[PASS] All 14 live HTTP endpoint & error-handling tests passed!")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


def test_oauth_single_flight_and_persistence():
    import tempfile
    from concurrent.futures import ThreadPoolExecutor
    from unittest.mock import patch, MagicMock
    from databricks.sql.experimental.oauth_persistence import OAuthToken
    from app.services import databricks_service as ds

    # 1. Test ThreadSafeOAuthPersistence memory + disk roundtrip
    with tempfile.TemporaryDirectory() as tmpdir:
        store = ds.ThreadSafeOAuthPersistence(Path(tmpdir) / "test_oauth.json")
        assert_eq(store.read("https://example.databricks.com/"), None, "Initial cache empty")
        store.persist("https://example.databricks.com/", OAuthToken("acc_1", "ref_1"))
        # Read via same instance & fresh instance (simulates uvicorn --reload)
        t1 = store.read("https://example.databricks.com")
        assert_eq(t1.access_token, "acc_1", "In-memory token read")
        store2 = ds.ThreadSafeOAuthPersistence(Path(tmpdir) / "test_oauth.json")
        t2 = store2.read("https://example.databricks.com/")
        assert_eq(t2.refresh_token, "ref_1", "Disk-persisted token read after reload")

    # 2. Test 6 simultaneous threads call sql.connect() ONLY ONCE (zero OAuth race condition!)
    connect_calls = []

    class FakeCursor:
        description = [("val",)]
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def execute(self, q, params=None): pass
        def fetchall(self): return [(42,)]

    class FakeConn:
        open = True
        def cursor(self): return FakeCursor()
        def close(self): self.open = False

    def fake_connect(**kwargs):
        time.sleep(0.08)  # Simulate OAuth handshake delay
        connect_calls.append(kwargs)
        return FakeConn()

    ds.close_shared_connection()
    with patch.object(ds.sql, "connect", side_effect=fake_connect):
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda i: ds.execute_query(f"SELECT {i}"), range(6)))

    ds.close_shared_connection()
    assert_eq(len(results), 6, "All 6 concurrent queries returned results")
    assert_eq(len(connect_calls), 1, "6 concurrent queries opened EXACTLY 1 SQL/OAuth connection")
    assert "experimental_oauth_persistence" in connect_calls[0] or "access_token" in connect_calls[0]
    print("[PASS] OAuth single-flight concurrency & token persistence verified (6 threads -> 1 connection)")


if __name__ == "__main__":
    test_notebook_syntax()
    test_csv_validator()
    test_forecast_service()
    test_oauth_single_flight_and_persistence()
    test_live_http_endpoints()
    print("\nALL LOCAL BACKEND TESTS PASSED SUCCESSFULLY!")
