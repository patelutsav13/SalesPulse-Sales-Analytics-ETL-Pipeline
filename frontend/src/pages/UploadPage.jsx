import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ArrowRight,
  Database,
  Sparkles,
  FileSpreadsheet,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  validateDatasetOnly,
  uploadDatasetFile,
  triggerJobProcessing,
  extractErrorMessage,
} from '../services/api';

const REQUIRED_COLUMNS = [
  'order_id',
  'order_date',
  'customer_id',
  'customer_name',
  'product_id',
  'product_name',
  'category',
  'region',
  'quantity',
  'unit_price',
  'sales_amount',
];

export default function UploadPage({ setActiveTab }) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | uploaded | processing | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [stagedPath, setStagedPath] = useState('');
  const [runId, setRunId] = useState('');

  const handleFileChange = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMessage('Invalid file type. Please select a .csv file.');
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);
    setPreviewRows([]);
    setUploadStatus('idle');
    setStatusMessage('');
    setErrorMessage('');
    setUploadProgress(0);
    setStagedPath('');
    setRunId('');

    // First validate using FastAPI backend if reachable; otherwise run browser check
    setValidating(true);
    try {
      const serverReport = await validateDatasetOnly(file);
      setValidationResult({
        valid: true,
        source: 'backend',
        ...serverReport,
      });
      setPreviewRows(serverReport.previewRows || []);
    } catch (err) {
      // If backend returned HTTP 400, that's a genuine CSV schema/content failure
      if (err?.response?.status === 400) {
        setValidationResult({
          valid: false,
          source: 'backend',
          error: extractErrorMessage(err),
        });
      } else {
        // Fallback to lightweight browser header inspection when backend isn't running
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
            if (lines.length < 2) {
              setValidationResult({ valid: false, error: 'CSV file is empty or missing rows.' });
              return;
            }
            const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
            const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
            const preview = [];
            for (let i = 1; i < Math.min(lines.length, 6); i++) {
              const vals = lines[i].split(',').map((v) => v.trim());
              const obj = {};
              headers.forEach((h, idx) => {
                obj[h] = vals[idx] || '';
              });
              preview.push(obj);
            }
            setPreviewRows(preview);
            setValidationResult({
              valid: missing.length === 0,
              source: 'browser',
              missingColumns: missing,
              foundColumns: headers,
              totalRows: lines.length - 1,
            });
          } catch (parseErr) {
            setValidationResult({ valid: false, error: `CSV parse error: ${parseErr.message}` });
          }
        };
        reader.readAsText(file.slice(0, 150 * 1024));
      }
    } finally {
      setValidating(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUploadToVolume = async () => {
    if (!selectedFile) return;
    try {
      setUploadStatus('uploading');
      setErrorMessage('');
      setStatusMessage('Uploading validated CSV to Databricks Unity Catalog Volume...');
      const res = await uploadDatasetFile(selectedFile, (pct) => setUploadProgress(pct));
      setStagedPath(res.stagedPath);
      if (res.validation) {
        setValidationResult({ valid: true, source: 'backend', ...res.validation });
      }
      setUploadStatus('uploaded');
      setStatusMessage(`Uploaded successfully to ${res.stagedPath}`);
    } catch (err) {
      setUploadStatus('error');
      setStatusMessage('');
      setErrorMessage(extractErrorMessage(err));
    }
  };

  const handleTriggerEtl = async () => {
    try {
      setUploadStatus('processing');
      setErrorMessage('');
      setStatusMessage('Triggering Databricks PySpark ETL Job via Jobs API...');
      const res = await triggerJobProcessing(stagedPath, selectedFile?.name);
      setRunId(res.runId);
      setUploadStatus('success');
      setStatusMessage(res.message || `Databricks Job launched (Run ID: ${res.runId})`);
    } catch (err) {
      setUploadStatus('error');
      setStatusMessage('');
      setErrorMessage(extractErrorMessage(err));
    }
  };

  const handleLoadSample = () => {
    const sampleText = `order_id,order_date,customer_id,customer_name,product_id,product_name,category,region,quantity,unit_price,sales_amount
ORD-1001,2024-01-15,CUST-001,John Smith,PROD-01,Quantum 4K Smart TV,Electronics,North,2,499.99,999.98
ORD-1002,2024-01-16,CUST-002,Sarah Johnson,PROD-02,ErgoFlex Office Chair,Furniture,West,1,249.50,249.50
ORD-1003,2024-01-18,CUST-003,Michael Brown,PROD-03,SoundWave ANC Headphones,Electronics,East,3,129.99,389.97
ORD-1004,2024-01-20,CUST-004,Emily Davis,PROD-04,SmartBreeze Air Purifier,Home Appliances,South,1,189.00,189.00
ORD-1005,2024-01-22,CUST-005,David Wilson,PROD-05,AeroDry Steam Iron,Home Appliances,Central,2,45.00,90.00
ORD-1001,2024-01-15,CUST-001,John Smith,PROD-01,Quantum 4K Smart TV,Electronics,North,2,499.99,999.98`;
    const blob = new Blob([sampleText], { type: 'text/csv' });
    const file = new File([blob], 'sample_sales_preview.csv', { type: 'text/csv' });
    handleFileChange(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Upload Dataset to Unity Catalog
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Validate transactional CSV files, upload to <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">/Volumes/mypyspark/sales_schema/sales_volume/</code>, and trigger PySpark ETL.
        </p>
      </div>

      {/* Upload Dropzone */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileChange(e.target.files?.[0])}
            accept=".csv"
            className="hidden"
          />
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <UploadCloud className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Click to choose a CSV file or drag &amp; drop here
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Requires all 11 standard SalesPulse columns (UTF-8, max 50 MB)
          </p>

          <div className="mt-4 flex items-center justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSample();
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Test Validation with Sample CSV Template</span>
            </button>
          </div>
        </div>

        {/* Selected File & Validation Report */}
        {selectedFile && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{selectedFile.name}</div>
                  <div className="text-xs text-slate-500">
                    {(selectedFile.size / 1024).toFixed(2)} KB &bull; CSV Format
                  </div>
                </div>
              </div>

              <div>
                {validating ? (
                  <span className="text-xs text-blue-600 font-medium">Validating CSV schema...</span>
                ) : validationResult?.valid ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>All 11 Required Columns Validated</span>
                  </span>
                ) : validationResult ? (
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {validationResult.error ||
                        `Missing Columns: ${(validationResult.missingColumns || []).join(', ')}`}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            {/* Detailed Quality Counters (when validated by backend) */}
            {validationResult?.valid && validationResult.source === 'backend' && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Total Rows</div>
                  <div className="font-bold text-slate-900 font-mono">{validationResult.totalRows}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Clean Unique</div>
                  <div className="font-bold text-emerald-600 font-mono">{validationResult.validRows}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Duplicate IDs</div>
                  <div className="font-bold text-amber-600 font-mono">{validationResult.duplicateOrderIds}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Null Cells</div>
                  <div className="font-bold text-slate-800 font-mono">{validationResult.nullValueCount}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <div className="text-slate-400">Invalid Rows</div>
                  <div className="font-bold text-slate-800 font-mono">
                    {(validationResult.invalidDateRows || 0) + (validationResult.invalidNumericRows || 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploadStatus === 'uploading' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Uploading to Unity Catalog Volume...</span>
                  <span className="font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Honest Error Box */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-rose-900">Operation Not Completed</div>
                  <div className="mt-0.5 leading-relaxed">{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Success Status Box */}
            {statusMessage && !errorMessage && (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>{statusMessage}</div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {(uploadStatus === 'idle' || uploadStatus === 'error') && (
                <button
                  disabled={!validationResult?.valid || validating}
                  onClick={handleUploadToVolume}
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all ${
                    validationResult?.valid && !validating
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload to Databricks Volume</span>
                </button>
              )}

              {uploadStatus === 'uploaded' && (
                <button
                  onClick={handleTriggerEtl}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Trigger Databricks PySpark Job</span>
                </button>
              )}

              {uploadStatus === 'success' && (
                <button
                  onClick={() => setActiveTab('processing')}
                  className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
                >
                  <span>Track Run #{runId} in Job Monitor</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Dataset Preview (First 5 Rows)</h3>
              <p className="text-xs text-slate-500">Verified against the 11-column SalesPulse schema</p>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Total rows in file: {validationResult?.totalRows || previewRows.length}
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  {REQUIRED_COLUMNS.map((col) => (
                    <th key={col} className="py-2.5 px-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {REQUIRED_COLUMNS.map((col) => (
                      <td key={col} className="py-2 px-3 whitespace-nowrap text-slate-700">
                        {row[col] !== undefined && row[col] !== '' ? String(row[col]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unity Catalog Path Guide */}
      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-900 space-y-1.5">
        <div className="font-bold flex items-center space-x-1.5 text-blue-800">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Unity Catalog Volume Pipeline Path</span>
        </div>
        <p className="text-blue-800/90 leading-relaxed">
          Target Volume: <code className="font-mono bg-blue-100 px-1.5 py-0.5 rounded">/Volumes/mypyspark/sales_schema/sales_volume/</code>
          <br />
          Note: Automated file upload and job triggering use the Databricks SDK, which requires <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">DATABRICKS_TOKEN</code> (PAT) and <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">DATABRICKS_JOB_ID</code> in <code className="font-mono bg-blue-100 px-1 py-0.5 rounded">backend/.env</code>.
        </p>
      </div>
    </div>
  );
}
