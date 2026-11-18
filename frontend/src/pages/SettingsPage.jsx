import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import {
  checkBackendHealth,
  fetchConfigStatus,
  getAppMode,
  setAppMode,
  extractErrorMessage,
} from '../services/api';

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [testing, setTesting] = useState(false);
  const [mode, setMode] = useState(getAppMode());

  const runHealthTest = useCallback(async (includeDatabricks = true) => {
    try {
      setTesting(true);
      setConfigError('');
      const [hRes, cfgRes] = await Promise.all([
        checkBackendHealth(includeDatabricks),
        fetchConfigStatus().catch((err) => {
          setConfigError(extractErrorMessage(err));
          return null;
        }),
      ]);
      setHealth(hRes);
      if (cfgRes) setConfig(cfgRes);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    runHealthTest(true);
  }, [runHealthTest]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setAppMode(newMode);
    window.location.reload();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Platform Configuration &amp; Databricks Connectivity
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Inspect active non-secret configuration from <code className="font-mono">backend/.env</code>, test SQL Warehouse connectivity, and switch operating modes.
        </p>
      </div>

      {/* Mode Switch Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <Sliders className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">Application Operating Mode</h3>
              <p className="text-xs text-slate-500">
                <strong>Live Mode</strong> queries your Databricks SQL Warehouse. <strong>Demo Mode</strong> previews exact local <code className="font-mono">sample_sales.csv</code> data offline.
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 shrink-0">
            <button
              onClick={() => handleModeChange('live')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'live'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Databricks
            </button>
            <button
              onClick={() => handleModeChange('demo')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'demo'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Demo Mode (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* Backend & Databricks Health Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">FastAPI &amp; Databricks Live Health Check</h3>
              <p className="text-xs text-slate-500">
                Pings <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">/api/health</code> and executes <code className="font-mono">SELECT 1</code> on SQL Warehouse
              </p>
            </div>
          </div>

          <button
            onClick={() => runHealthTest(true)}
            disabled={testing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Test Live Connection'}</span>
          </button>
        </div>

        {health && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-xs text-slate-500">FastAPI Backend (Port 8000):</div>
                <div className="flex items-center space-x-1.5 font-bold text-sm">
                  {health.backendConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-700">Online &amp; Reachable</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      <span className="text-rose-700">Offline</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="text-xs text-slate-500">Databricks SQL Warehouse:</div>
                <div className="flex items-center space-x-1.5 font-bold text-sm">
                  {health.databricksConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-700">Connected ({health.authMode})</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-amber-700">Not Connected</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {health.message && (
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                {health.message}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Non-Secret Config Status Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Active Backend Databricks Configuration (Secrets Hidden)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Loaded from <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">backend/.env</code> via <code className="font-mono">/api/config/status</code>
          </p>
        </div>

        {configError ? (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {configError}
          </div>
        ) : config ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Setting</th>
                  <th className="py-2.5 px-3">Active Value / Status</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                <tr>
                  <td className="py-2.5 px-3 text-blue-600 font-bold">DATABRICKS_SERVER_HOSTNAME</td>
                  <td className="py-2.5 px-3 text-slate-800">{config.server_hostname}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">Workspace hostname</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-600 font-bold">DATABRICKS_WAREHOUSE_ID</td>
                  <td className="py-2.5 px-3 text-slate-800">{config.warehouse_id}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">
                    HTTP Path: {config.http_path_configured ? 'Configured' : 'Missing'}
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-600 font-bold">DATABRICKS_CATALOG / SCHEMA</td>
                  <td className="py-2.5 px-3 text-slate-800">{config.catalog}.{config.schema_name}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">Unity Catalog Delta tables</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-600 font-bold">DATABRICKS_VOLUME</td>
                  <td className="py-2.5 px-3 text-slate-800">{config.volume_path}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">CSV staging volume</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-600 font-bold">DATABRICKS_TOKEN (PAT)</td>
                  <td className="py-2.5 px-3">
                    {config.pat_configured ? (
                      <span className="text-emerald-700 font-semibold">Configured (Hidden)</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Not Set (Using OAuth for SQL)</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">Required for SDK Volume Upload &amp; Jobs API</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-blue-600 font-bold">DATABRICKS_JOB_ID</td>
                  <td className="py-2.5 px-3">
                    {config.job_id_configured ? (
                      <span className="text-emerald-700 font-semibold">{config.job_id}</span>
                    ) : (
                      <span className="text-amber-700 font-semibold">Not Set</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans text-slate-500">Numeric Job ID for sales_etl_pipeline</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-slate-400">Loading configuration...</div>
        )}
      </div>
    </div>
  );
}
