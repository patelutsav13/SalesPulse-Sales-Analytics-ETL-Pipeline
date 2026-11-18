import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  RefreshCw,
  Terminal,
  Play,
  ExternalLink,
  Search,
  AlertCircle,
  CheckCircle2,
  Database,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import {
  getJobRunStatus,
  fetchRecentJobs,
  triggerJobProcessing,
  getLastRunId,
  setLastRunId,
  extractErrorMessage,
} from '../services/api';

const ETL_STAGES = [
  { step: '01', name: 'Read Volume CSV', desc: 'spark.read.csv() from /Volumes/mypyspark/sales_schema/sales_volume/' },
  { step: '02', name: 'Schema Inspection', desc: 'printSchema(), count(), describe() profiling' },
  { step: '03', name: 'Deduplicate & Clean', desc: 'dropDuplicates(["order_id"]), date & numeric validation' },
  { step: '04', name: 'Spark Aggregations', desc: 'Monthly, category, regional & top-10 product rollups' },
  { step: '05', name: 'Delta Lake Commit', desc: 'ACID write to 5 Unity Catalog Delta tables' },
];

export default function DataProcessingPage() {
  const [runIdInput, setRunIdInput] = useState(getLastRunId());
  const [activeJob, setActiveJob] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [triggerSuccess, setTriggerSuccess] = useState('');

  const loadJobData = useCallback(async (explicitRunId) => {
    try {
      setLoading(true);
      setError('');
      const targetId = explicitRunId !== undefined ? explicitRunId : getLastRunId();

      if (targetId && /^\d+$/.test(String(targetId).trim())) {
        const statusData = await getJobRunStatus(String(targetId).trim());
        setActiveJob(statusData);
        if (statusData?.runId) {
          setRunIdInput(statusData.runId);
          setLastRunId(statusData.runId);
        }
      }

      const runs = await fetchRecentJobs(5);
      setRecentJobs(runs || []);
      if (!targetId && runs && runs.length > 0) {
        const latestDetailed = await getJobRunStatus(runs[0].runId);
        setActiveJob(latestDetailed);
        setRunIdInput(latestDetailed.runId);
        setLastRunId(latestDetailed.runId);
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobData();
  }, [loadJobData]);

  // Auto-poll every 5 seconds while the active Databricks job is PENDING or RUNNING
  useEffect(() => {
    if (!activeJob || !['PENDING', 'RUNNING'].includes((activeJob.status || '').toUpperCase())) {
      return;
    }
    const timer = setInterval(() => {
      loadJobData(activeJob.runId);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeJob, loadJobData]);

  const handleLookupSubmit = (e) => {
    e.preventDefault();
    if (!runIdInput.trim()) return;
    setLastRunId(runIdInput.trim());
    loadJobData(runIdInput.trim());
  };

  const handleTriggerJob = async () => {
    try {
      setTriggering(true);
      setError('');
      setTriggerSuccess('');
      const res = await triggerJobProcessing();
      setRunIdInput(res.runId);
      setLastRunId(res.runId);
      setTriggerSuccess(res.message || `Triggered Databricks Job (Run ID: ${res.runId})`);
      await loadJobData(res.runId);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Databricks PySpark Job Monitor
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live Databricks Jobs API execution status, timestamps, and run output for <code className="font-mono">sales_etl_pipeline</code>.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => loadJobData()}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleTriggerJob}
            disabled={triggering}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs disabled:opacity-60"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{triggering ? 'Triggering...' : 'Trigger Databricks Job'}</span>
          </button>
        </div>
      </div>

      {/* Run ID Lookup Bar */}
      <form
        onSubmit={handleLookupSubmit}
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Enter numeric Databricks Run ID (e.g., 123456789)..."
            value={runIdInput}
            onChange={(e) => setRunIdInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-mono bg-slate-50 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
        >
          Check Run Status
        </button>
      </form>

      {/* Success Banner */}
      {triggerSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{triggerSuccess}</span>
        </div>
      )}

      {/* Honest Error / Configuration Notice */}
      {error && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-900">Databricks Jobs API Status</h3>
              <p className="text-xs text-amber-900/90 leading-relaxed">{error}</p>
              <p className="text-xs text-amber-800 pt-1">
                <strong>Authentication:</strong> Databricks Jobs API uses browser OAuth (<code className="font-mono bg-amber-100 px-1 py-0.5 rounded">external-browser</code>) automatically when <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">DATABRICKS_JOB_ID</code> is set in <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">backend/.env</code> (or uses <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">DATABRICKS_TOKEN</code> PAT fallback if configured).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Job Card (shown ONLY when genuine Databricks job data is returned) */}
      {activeJob && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-4 border-b border-slate-100 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">{activeJob.jobName}</h3>
                  <StatusBadge status={activeJob.status} />
                </div>
                <p className="text-xs font-mono text-slate-500 mt-0.5">
                  Run ID: {activeJob.runId} {activeJob.jobId ? `• Job ID: ${activeJob.jobId}` : ''}
                </p>
              </div>
            </div>

            {activeJob.runPageUrl && (
              <a
                href={activeJob.runPageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
              >
                <span>Open in Databricks</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-slate-400">Life Cycle State</div>
              <div className="font-bold text-slate-900 font-mono mt-1">{activeJob.lifeCycleState || '-'}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-slate-400">Result State</div>
              <div className="font-bold text-slate-900 font-mono mt-1">{activeJob.resultState || 'In Progress'}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-slate-400">Start Time</div>
              <div className="font-semibold text-slate-800 font-mono mt-1">{activeJob.startTime || '-'}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-slate-400">Duration</div>
              <div className="font-semibold text-slate-800 font-mono mt-1">{activeJob.duration || 'Running...'}</div>
            </div>
          </div>

          {/* Genuine Run Output / Logs */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 space-y-2">
            <div className="flex items-center space-x-2 text-slate-300 pb-2 border-b border-slate-800">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-semibold">Databricks Job Run Logs</span>
            </div>
            <div className="font-mono text-xs text-slate-300 space-y-1 max-h-60 overflow-y-auto">
              {(activeJob.logs || []).map((line, i) => (
                <div key={i} className="text-slate-300">
                  <span className="text-slate-500 mr-2">&gt;</span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Runs List */}
      {recentJobs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Recent Databricks Job Runs</h3>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="py-2.5 px-4">Run ID</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Started</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentJobs.map((r) => (
                <tr key={r.runId} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-semibold text-blue-600">{r.runId}</td>
                  <td className="py-3 px-4"><StatusBadge status={r.status} size="xs" /></td>
                  <td className="py-3 px-4 font-mono text-slate-600">{r.startTime || '-'}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{r.duration || '-'}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => {
                        setRunIdInput(r.runId);
                        setLastRunId(r.runId);
                        loadJobData(r.runId);
                      }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pipeline Architecture Reference */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>PySpark ETL Pipeline Stages (databricks/notebooks/sales_etl_pipeline.py)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {ETL_STAGES.map((stg) => (
            <div key={stg.step} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
              <div className="text-[10px] font-bold text-blue-600 uppercase">Step {stg.step}</div>
              <div className="text-xs font-bold text-slate-800 mt-1">{stg.name}</div>
              <p className="text-[11px] text-slate-500 mt-1 font-mono leading-tight">{stg.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
