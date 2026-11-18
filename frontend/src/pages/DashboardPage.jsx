import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  ShoppingCart,
  Package,
  CreditCard,
  Users,
  TrendingUp,
  Cpu,
  ArrowRight,
  Database,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import KPICard from '../components/KPICard';
import ChartCard from '../components/ChartCard';
import StatusBadge from '../components/StatusBadge';
import ErrorBanner from '../components/ErrorBanner';
import {
  fetchSummaryKPIs,
  fetchMonthlySales,
  fetchCategorySales,
  fetchRegionalSales,
  fetchTopProducts,
  fetchRecentJobs,
  getAppMode,
  extractErrorMessage,
} from '../services/api';
import { formatCurrency, formatNumber, formatPercent } from '../utils/formatters';

const CATEGORY_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b'];

export default function DashboardPage({ setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState(null);
  const [monthlySales, setMonthlySales] = useState([]);
  const [categorySales, setCategorySales] = useState([]);
  const [regionalSales, setRegionalSales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [latestJob, setLatestJob] = useState(null);
  const [jobNote, setJobNote] = useState('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [kpiRes, monthRes, catRes, regRes, prodRes] = await Promise.all([
        fetchSummaryKPIs(),
        fetchMonthlySales(),
        fetchCategorySales(),
        fetchRegionalSales(),
        fetchTopProducts(),
      ]);
      setKpis(kpiRes);
      setMonthlySales(monthRes || []);
      setCategorySales(catRes || []);
      setRegionalSales(regRes || []);
      setTopProducts(prodRes || []);

      // Optional: fetch latest genuine Databricks Job run (non-blocking if Job ID/PAT not set)
      if (getAppMode() === 'live') {
        try {
          const jobs = await fetchRecentJobs(1);
          setLatestJob(jobs && jobs.length > 0 ? jobs[0] : null);
          setJobNote(jobs && jobs.length === 0 ? 'No job runs found yet for configured Job ID.' : '');
        } catch (jobErr) {
          setLatestJob(null);
          setJobNote(extractErrorMessage(jobErr));
        }
      } else {
        setLatestJob(null);
        setJobNote('Demo Mode active — Jobs API requires Live Mode with Databricks PAT & Job ID.');
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">
            {getAppMode() === 'demo'
              ? 'Loading sample CSV summary...'
              : 'Querying Databricks SQL Warehouse (mypyspark.sales_schema)...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Enterprise Sales Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Connected to <code className="font-mono">mypyspark.sales_schema</code> via FastAPI + Databricks SQL Warehouse
          </p>
        </div>
        <ErrorBanner message={error} onRetry={loadData} />
      </div>
    );
  }

  const growthLabel =
    kpis?.revenueGrowth !== null && kpis?.revenueGrowth !== undefined
      ? formatPercent(kpis.revenueGrowth)
      : 'N/A';

  return (
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Enterprise Sales Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {kpis?.dataSource === 'demo'
              ? 'Showing computed Demo Mode metrics from local data/sample_sales.csv'
              : 'Live metrics queried from Databricks Delta Lake (mypyspark.sales_schema)'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Upload Dataset</span>
          </button>
        </div>
      </div>

      {/* 6 Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(kpis?.totalRevenue)}
          description="sales_cleaned"
          icon={DollarSign}
          accent="blue"
        />
        <KPICard
          title="Total Orders"
          value={formatNumber(kpis?.totalOrders)}
          description="Deduplicated orders"
          icon={ShoppingCart}
          accent="purple"
        />
        <KPICard
          title="Average Order Value"
          value={formatCurrency(kpis?.averageOrderValue)}
          description="Revenue / Orders"
          icon={CreditCard}
          accent="indigo"
        />
        <KPICard
          title="Total Products"
          value={formatNumber(kpis?.totalProducts)}
          description="Unique product SKUs"
          icon={Package}
          accent="emerald"
        />
        <KPICard
          title="Total Customers"
          value={formatNumber(kpis?.totalCustomers)}
          description="Unique customers"
          icon={Users}
          accent="amber"
        />
        <KPICard
          title="H2 vs H1 Trend"
          value={growthLabel}
          description="Half-year revenue delta"
          icon={TrendingUp}
          accent="blue"
        />
      </div>

      {/* Row 1: Monthly Sales Trend (Area Chart) + Revenue by Category (Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Monthly Sales Trend"
            subtitle="Actual monthly gross revenue from monthly_sales_summary"
            badge="monthly_sales_summary"
            action={
              <button
                onClick={() => setActiveTab('analytics')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>Deep Dive</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {monthlySales.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-xs text-slate-400">
                No monthly records found in monthly_sales_summary.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="monthName"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val) => [formatCurrency(val), 'Revenue']}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                      itemStyle={{ color: '#ffffff' }}
                      labelStyle={{ color: '#93c5fd', fontWeight: 600 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#salesGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Revenue by Category */}
        <div className="lg:col-span-1">
          <ChartCard
            title="Revenue by Category"
            subtitle="Contribution breakdown by product department"
            badge="category_sales_summary"
          >
            {categorySales.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                No category data found.
              </div>
            ) : (
              <>
                <div className="h-56 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySales}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {categorySales.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => [formatCurrency(val), 'Revenue']}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                        itemStyle={{ color: '#ffffff' }}
                        labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
                  {categorySales.map((cat, idx) => (
                    <div key={cat.category} className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <span className="font-medium text-slate-700">{cat.category}</span>
                      </div>
                      <div className="font-semibold text-slate-900">
                        {formatCurrency(cat.revenue)} <span className="text-slate-400 font-normal">({cat.percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Row 2: Sales by Region (Bar Chart) + Pipeline & Delta Table Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard
            title="Sales by Geographic Region"
            subtitle="Regional revenue comparison in USD"
            badge="regional_sales_summary"
            action={
              <button
                onClick={() => setActiveTab('regional')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>View Regions</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {regionalSales.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                No regional data found.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={regionalSales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis
                      dataKey="region"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val) => [formatCurrency(val), 'Revenue']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#ffffff', fontSize: '12px' }}
                      itemStyle={{ color: '#ffffff' }}
                      labelStyle={{ color: '#ffffff', fontWeight: 600 }}
                    />
                    <Bar dataKey="revenue" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={45} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Recent Processing Activity / Unity Catalog Table Summary */}
        <div className="lg:col-span-1">
          <ChartCard
            title="Pipeline & Delta Status"
            subtitle="Unity Catalog & Databricks Jobs status"
            action={
              <button
                onClick={() => setActiveTab('processing')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
              >
                <span>Job Monitor</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            }
          >
            {latestJob ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <div className="text-xs font-mono font-medium text-slate-500">Run #{latestJob.runId}</div>
                    <div className="text-sm font-semibold text-slate-800">{latestJob.jobName}</div>
                  </div>
                  <StatusBadge status={latestJob.status} />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Started:</span>
                    <span className="font-mono text-slate-800">{latestJob.startTime || '-'}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Duration:</span>
                    <span className="font-mono text-slate-800">{latestJob.duration || 'In progress'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-slate-900 rounded-lg text-slate-300 text-[11px] font-mono space-y-1.5">
                  <div className="text-emerald-400 font-bold flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>mypyspark.sales_schema</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>sales_cleaned</span>
                    <span className="text-blue-300">{formatNumber(kpis?.totalOrders)} orders</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>monthly_sales_summary</span>
                    <span className="text-blue-300">{monthlySales.length} months</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>category_sales_summary</span>
                    <span className="text-blue-300">{categorySales.length} categories</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>regional_sales_summary</span>
                    <span className="text-blue-300">{regionalSales.length} regions</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>top_products_summary</span>
                    <span className="text-blue-300">{topProducts.length} products</span>
                  </div>
                </div>
                {jobNote && (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {jobNote}
                  </p>
                )}
              </div>
            )}
          </ChartCard>
        </div>
      </div>

      {/* Row 3: Top Products Table */}
      <ChartCard
        title="Top Products by Revenue"
        subtitle="Ranked inventory performance from top_products_summary"
        badge="top_products_summary"
        action={
          <button
            onClick={() => setActiveTab('products')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
          >
            <span>All Products</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        }
      >
        {topProducts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No product records found in top_products_summary.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3"># Rank</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Units Sold</th>
                  <th className="py-2.5 px-3 text-right">Avg Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.slice(0, 6).map((prod) => (
                  <tr key={prod.productId || prod.rank} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold inline-flex items-center justify-center text-[10px]">
                        {prod.rank}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {prod.productName}
                      <div className="text-[10px] font-mono text-slate-400">{prod.productId}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-slate-800">
                      {formatNumber(prod.quantitySold)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {formatCurrency(prod.unitPrice)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(prod.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
