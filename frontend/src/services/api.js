import axios from 'axios';
import {
  sampleSummaryKPIs,
  sampleMonthlySales,
  sampleCategorySales,
  sampleRegionalSales,
  sampleTopProducts,
  sampleForecast,
  sampleRawRecords,
} from './sampleData';

const API_BASE = '/api';

// Generous timeout (90s) to allow first-time Databricks OAuth browser sign-in & cold SQL Warehouse wake-up
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 90000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function extractErrorMessage(err) {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (detail) {
    const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
    if (status === 503) {
      return `Databricks SQL Query Error (HTTP 503): ${detailStr}`;
    }
    if (status === 400) {
      return `Validation Error (HTTP 400): ${detailStr}`;
    }
    return `Backend Error (HTTP ${status}): ${detailStr}`;
  }
  if (err?.code === 'ECONNABORTED') {
    return 'Request timed out (90s) waiting for FastAPI / Databricks SQL Warehouse. Click Retry once the warehouse finishes warming up.';
  }
  if (err?.message === 'Network Error' || status === 502 || status === 504) {
    return 'Connection Error: Cannot reach FastAPI backend on http://127.0.0.1:8000. Verify uvicorn is running.';
  }
  return err?.message || 'Unexpected error communicating with backend.';
}

// Operating Mode: 'live' (default — real Databricks) or 'demo' (explicit Sample CSV preview)
export const getAppMode = () => {
  const saved = localStorage.getItem('salespulse_mode');
  return saved === 'demo' ? 'demo' : 'live';
};

export const setAppMode = (mode) => {
  localStorage.setItem('salespulse_mode', mode === 'demo' ? 'demo' : 'live');
};

export const getLastRunId = () => localStorage.getItem('salespulse_last_run_id') || '';
export const setLastRunId = (runId) => {
  if (runId) localStorage.setItem('salespulse_last_run_id', String(runId));
};

/**
 * Health check: checks FastAPI and live Databricks SQL Warehouse status.
 */
export async function checkBackendHealth(checkDatabricks = true) {
  const mode = getAppMode();
  try {
    const res = await apiClient.get('/health', {
      params: { check_databricks: checkDatabricks },
      timeout: checkDatabricks ? 90000 : 5000,
    });
    return {
      mode,
      status: res.data.status,
      backendConnected: true,
      databricksConnected: Boolean(res.data.databricks_connected),
      authMode: res.data.auth_mode,
      workspace: res.data.workspace || 'Not configured',
      catalog: res.data.catalog || 'mypyspark',
      schemaName: res.data.schema_name || 'sales_schema',
      volume: res.data.volume || 'sales_volume',
      patConfigured: Boolean(res.data.pat_configured),
      jobIdConfigured: Boolean(res.data.job_id_configured),
      message: res.data.message,
      timestamp: res.data.timestamp,
    };
  } catch (err) {
    return {
      mode,
      status: 'offline',
      backendConnected: false,
      databricksConnected: false,
      catalog: 'mypyspark',
      schemaName: 'sales_schema',
      volume: 'sales_volume',
      patConfigured: false,
      jobIdConfigured: false,
      message: extractErrorMessage(err),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Fetch non-secret Databricks configuration for Settings page
 */
export async function fetchConfigStatus() {
  const res = await apiClient.get('/config/status', { timeout: 8000 });
  return res.data;
}

/**
 * Helper: runs live query or explicit demo query
 */
async function fetchAnalyticsEndpoint(path, localDemoFallback, extraParams = {}) {
  const mode = getAppMode();
  if (mode === 'demo') {
    try {
      const res = await apiClient.get(path, {
        params: { ...extraParams, mode: 'demo' },
        timeout: 5000,
      });
      return res.data;
    } catch {
      return typeof localDemoFallback === 'function' ? localDemoFallback(extraParams) : localDemoFallback;
    }
  }
  const res = await apiClient.get(path, { params: extraParams });
  return res.data;
}

export const fetchSummaryKPIs = () =>
  fetchAnalyticsEndpoint('/dashboard/summary', sampleSummaryKPIs);

export const fetchMonthlySales = () =>
  fetchAnalyticsEndpoint('/analytics/monthly-sales', sampleMonthlySales);

export const fetchCategorySales = () =>
  fetchAnalyticsEndpoint('/analytics/category-sales', sampleCategorySales);

export const fetchRegionalSales = () =>
  fetchAnalyticsEndpoint('/analytics/regional-sales', sampleRegionalSales);

export const fetchTopProducts = () =>
  fetchAnalyticsEndpoint('/analytics/top-products', sampleTopProducts);

export const fetchSalesForecast = () =>
  fetchAnalyticsEndpoint('/forecast', sampleForecast);

export const fetchDataRecords = (params = {}) =>
  fetchAnalyticsEndpoint('/data', (p) => {
    let records = [...sampleRawRecords];
    if (p.search) {
      const q = p.search.toLowerCase();
      records = records.filter(
        (r) =>
          r.product_name.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.order_id.toLowerCase().includes(q)
      );
    }
    if (p.category && p.category !== 'All') {
      records = records.filter((r) => r.category === p.category);
    }
    if (p.region && p.region !== 'All') {
      records = records.filter((r) => r.region === p.region);
    }
    const page = p.page || 1;
    const pageSize = p.pageSize || 10;
    return {
      total: records.length,
      page,
      pageSize,
      records: records.slice((page - 1) * pageSize, page * pageSize),
      dataSource: 'demo',
    };
  }, params);

/**
 * Validate CSV using FastAPI backend without uploading
 */
export async function validateDatasetOnly(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/upload/validate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/**
 * Upload CSV directly to Databricks Unity Catalog Volume via FastAPI.
 * Never fakes success if backend or Databricks upload fails.
 */
export async function uploadDatasetFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(pct);
      }
    },
  });
  return res.data;
}

/**
 * Trigger real Databricks PySpark ETL Job via FastAPI Jobs API.
 * Never returns fake run IDs.
 */
export async function triggerJobProcessing(volumePath, fileName) {
  const res = await apiClient.post('/process', {
    volume_path: volumePath || null,
    file_name: fileName || null,
  });
  if (res.data?.runId) {
    setLastRunId(res.data.runId);
  }
  return res.data;
}

/**
 * Fetch real Databricks Job status for a numeric runId.
 */
export async function getJobRunStatus(runId) {
  const res = await apiClient.get(`/jobs/${encodeURIComponent(runId)}`);
  return res.data;
}

/**
 * Fetch recent genuine Databricks Job runs.
 */
export async function fetchRecentJobs(limit = 5) {
  const res = await apiClient.get('/jobs', { params: { limit } });
  return res.data;
}
