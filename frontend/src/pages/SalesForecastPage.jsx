import React, { useState, useEffect, useCallback } from 'react';
import {
  Info,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import ErrorBanner from '../components/ErrorBanner';
import { fetchSalesForecast, extractErrorMessage } from '../services/api';
import { formatCurrency } from '../utils/formatters';

export default function SalesForecastPage() {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchSalesForecast();
      setForecastData(data);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={load} />;
  }

  if (!forecastData) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
        No historical sales data available to generate a forecast.
      </div>
    );
  }

  const combinedChartData = [
    ...(forecastData.historical || []).map((h) => ({
      period: h.period,
      actual: h.actual,
      predicted: h.predicted,
      isForecast: false,
    })),
    ...(forecastData.forecast || []).map((f) => ({
      period: f.period,
      actual: null,
      predicted: f.predicted,
      lowerBound: f.lowerBound,
      upperBound: f.upperBound,
      isForecast: true,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sales Forecasting &amp; Projections (Next 3 Months)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {forecastData.methodology} computed from {forecastData.dataPointsUsed} historical months.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Recalculate</span>
        </button>
      </div>

      {/* 3 Projection Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(forecastData.forecast || []).map((f, idx) => (
          <div
            key={f.period}
            className="bg-white rounded-xl border border-purple-200/80 p-5 shadow-sm relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100/50 to-transparent rounded-bl-full pointer-events-none" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                Estimate M+{idx + 1}
              </span>
              <span className="text-xs font-mono text-slate-400">{f.period}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(f.predicted)}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              ±1 Std Dev Range:{' '}
              <span className="font-mono text-slate-700">
                {formatCurrency(f.lowerBound)} – {formatCurrency(f.upperBound)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Forecast Trend Chart */}
      <ChartCard
        title="Actual Historical Sales vs. 3-Month Forecast"
        subtitle="Solid blue = confirmed actual revenue from monthly_sales_summary; Dashed purple = predicted estimate"
        badge={forecastData.dataSource === 'demo' ? 'demo-csv' : 'monthly_sales_summary'}
      >
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedChartData} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
              />
              <Tooltip
                formatter={(val, name) => [
                  val !== null ? formatCurrency(val) : '-',
                  name === 'actual' ? 'Actual Sales (Historical)' : 'Estimated Sales (Forecast)',
                ]}
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                itemStyle={{ color: '#ffffff' }}
                labelStyle={{ color: '#ffffff', fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual Sales (Historical)"
                stroke="#2563eb"
                strokeWidth={3}
                dot={{ r: 4, fill: '#2563eb' }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="predicted"
                name="Predicted Sales (Estimate)"
                stroke="#8b5cf6"
                strokeWidth={3}
                strokeDasharray="5 5"
                dot={{ r: 5, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
                connectNulls={true}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Methodology & Honest Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl bg-white border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
            <Info className="w-4 h-4 text-blue-600" />
            <span>Forecasting Methodology &amp; Computed Inputs</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>{forecastData.methodology}</strong>: {forecastData.assumptions}
          </p>
          <div className="space-y-1.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Historical Months Used: <strong>{forecastData.dataPointsUsed}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Recent 3-Month Moving Avg: <strong>{formatCurrency(forecastData.movingAverage3m)}</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Linear Trend Slope: <strong>{forecastData.monthlyTrendSlope >= 0 ? '+' : ''}{formatCurrency(forecastData.monthlyTrendSlope)} / month</strong></span>
            </div>
          </div>
          {forecastData.insights?.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4 pt-2 border-t border-slate-100">
              {forecastData.insights.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 shadow-sm space-y-3">
          <div className="flex items-center space-x-2 font-bold text-sm text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Forecast Limitations &amp; PySpark Distinction</span>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed">
            <strong>Data Processing (PySpark)</strong> cleans and aggregates historical transactions reliably in Delta Lake.{' '}
            <strong>Forecasting</strong> is a simple statistical extrapolation — predictions are <em>never guaranteed</em>.
          </p>
          <ul className="text-xs text-amber-900/90 space-y-1.5 list-disc pl-4">
            {(forecastData.limitations || []).map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
