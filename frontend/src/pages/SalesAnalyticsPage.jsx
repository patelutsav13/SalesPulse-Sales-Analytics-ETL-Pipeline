import React, { useState, useEffect, useCallback } from 'react';
import { Filter, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import ChartCard from '../components/ChartCard';
import ErrorBanner from '../components/ErrorBanner';
import {
  fetchMonthlySales,
  fetchCategorySales,
  fetchRegionalSales,
  extractErrorMessage,
} from '../services/api';
import { formatCurrency, formatNumber } from '../utils/formatters';

export default function SalesAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [regionalData, setRegionalData] = useState([]);

  // Working interactive filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedHalf, setSelectedHalf] = useState('all'); // all | h1 | h2
  const [metricType, setMetricType] = useState('both'); // both | revenue | orders

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [mRes, cRes, rRes] = await Promise.all([
        fetchMonthlySales(),
        fetchCategorySales(),
        fetchRegionalSales(),
      ]);
      setMonthlyData(mRes || []);
      setCategoryData(cRes || []);
      setRegionalData(rRes || []);
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

  const filteredMonthly = monthlyData.filter((m) => {
    if (selectedHalf === 'h1') return m.month <= 6;
    if (selectedHalf === 'h2') return m.month >= 7;
    return true;
  });

  const filteredCategories =
    selectedCategory === 'All'
      ? categoryData
      : categoryData.filter((c) => c.category === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Title & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Interactive Sales Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monthly, category, and regional analytics queried from <code className="font-mono">mypyspark.sales_schema</code>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs text-xs">
            <select
              value={selectedHalf}
              onChange={(e) => setSelectedHalf(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Full Year (Jan–Dec)</option>
              <option value="h1">H1 (Jan–Jun)</option>
              <option value="h2">H2 (Jul–Dec)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Categories</option>
              {categoryData.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            {['both', 'revenue', 'orders'].map((m) => (
              <button
                key={m}
                onClick={() => setMetricType(m)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md capitalize transition-all ${
                  metricType === m
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Chart: Monthly Revenue & Orders */}
      <ChartCard
        title="Monthly Performance & Order Volume"
        subtitle="Historical revenue progression alongside monthly order counts"
        badge="monthly_sales_summary"
      >
        {filteredMonthly.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400">
            No monthly data for selected period.
          </div>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredMonthly} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} />
                {(metricType === 'both' || metricType === 'revenue') && (
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                  />
                )}
                {(metricType === 'both' || metricType === 'orders') && (
                  <YAxis
                    yAxisId="right"
                    orientation={metricType === 'orders' ? 'left' : 'right'}
                    tickFormatter={(val) => `${val} ord`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                  />
                )}
                <Tooltip
                  formatter={(val, name) => [
                    name.includes('Revenue') ? formatCurrency(val) : formatNumber(val),
                    name,
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {(metricType === 'both' || metricType === 'revenue') && (
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue ($)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={35} />
                )}
                {(metricType === 'both' || metricType === 'orders') && (
                  <Bar yAxisId="right" dataKey="orders" name="Total Orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Dual Column: Category Distribution & Average Order Value by Region */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Category Distribution Breakdown"
          subtitle="Revenue contribution compared across merchandise categories"
          badge="category_sales_summary"
        >
          {filteredCategories.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">No category data found.</div>
          ) : (
            <div className="space-y-4">
              {filteredCategories.map((cat) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{cat.category}</span>
                    <div className="space-x-2">
                      <span className="text-slate-500 font-mono">{formatCurrency(cat.revenue)}</span>
                      <span className="font-bold text-slate-900">{cat.percentage}%</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Average Order Value by Region"
          subtitle="Regional purchasing power (Total Revenue / Total Orders)"
          badge="regional_sales_summary"
        >
          {regionalData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-400">
              No regional data found.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionalData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis dataKey="region" type="category" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                  <Tooltip
                    formatter={(val) => [formatCurrency(val), 'Avg Order Value']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                    itemStyle={{ color: '#ffffff' }}
                    labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                  />
                  <Bar dataKey="avgOrderValue" fill="#06b6d4" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
