import React from 'react';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { setAppMode } from '../services/api';

export default function ErrorBanner({
  title = 'Unable to load live Databricks data',
  message,
  onRetry,
  showDemoOption = true,
}) {
  const handleSwitchDemo = () => {
    setAppMode('demo');
    window.location.reload();
  };

  return (
    <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 text-rose-900 space-y-3 shadow-xs">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <h3 className="text-sm font-bold text-rose-900">{title}</h3>
          <p className="text-xs text-rose-800 leading-relaxed">
            {message || 'Make sure FastAPI is running on port 8000 and your Databricks Serverless Starter Warehouse is started.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-8">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Live Query</span>
          </button>
        )}
        {showDemoOption && (
          <button
            onClick={handleSwitchDemo}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Preview in Demo Mode (Sample CSV)</span>
          </button>
        )}
      </div>
    </div>
  );
}
