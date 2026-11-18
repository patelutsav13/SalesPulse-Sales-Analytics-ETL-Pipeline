import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import ErrorBanner from '../components/ErrorBanner';
import { fetchRegionalSales, extractErrorMessage } from '../services/api';
import { formatCurrency, formatNumber } from '../utils/formatters';

const REGION_COLORS = {
  North: '#3b82f6',
  West: '#8b5cf6',
  East: '#06b6d4',
  South: '#10b981',
  Central: '#f59e0b',
};

export default function RegionalAnalysisPage() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchRegionalSales();
      setRegions(data || []);
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

  const totalAll = regions.reduce((s, r) => s + (r.revenue || 0), 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Geographic &amp; Regional Performance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Regional comparison from <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">mypyspark.sales_schema.regional_sales_summary</code>.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Regional Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {regions.map((reg) => {
          const share = ((reg.revenue / totalAll) * 100).toFixed(1);
          return (
            <div
              key={reg.region}
              className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:border-blue-300 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>{reg.region}</span>
                </span>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  {share}%
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900">
                {formatCurrency(reg.revenue)}
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                <span>{formatNumber(reg.orders)} Orders</span>
                <span>AOV: {formatCurrency(reg.avgOrderValue)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Regional Comparison Chart */}
      <ChartCard
        title="Revenue Comparison Across Regions"
        subtitle="Gross revenue generation comparison in USD"
        badge="regional_sales_summary"
      >
        {regions.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400">
            No regional records found.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regions} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {regions.map((entry) => (
                    <Cell key={`cell-${entry.region}`} fill={REGION_COLORS[entry.region] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Comparative Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Regional Performance Matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Region</th>
                <th className="py-3 px-4 text-right">Total Revenue</th>
                <th className="py-3 px-4 text-right">Total Orders</th>
                <th className="py-3 px-4 text-right">Average Order Value</th>
                <th className="py-3 px-4 text-right">Market Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {regions.map((reg) => {
                const share = ((reg.revenue / totalAll) * 100).toFixed(1);
                return (
                  <tr key={reg.region} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900 flex items-center space-x-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: REGION_COLORS[reg.region] || '#3b82f6' }}
                      />
                      <span>{reg.region}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(reg.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatNumber(reg.orders)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700">
                      {formatCurrency(reg.avgOrderValue)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-800">
                      {share}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
