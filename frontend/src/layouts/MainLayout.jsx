import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Cpu,
  BarChart3,
  Package,
  MapPin,
  TrendingUp,
  Database,
  Settings,
  Flame,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Server,
  AlertCircle,
} from 'lucide-react';
import { checkBackendHealth, getAppMode } from '../services/api';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, category: 'Overview' },
  { id: 'upload', label: 'Upload Dataset', icon: UploadCloud, category: 'Data Pipeline' },
  { id: 'processing', label: 'Data Processing', icon: Cpu, category: 'Data Pipeline' },
  { id: 'analytics', label: 'Sales Analytics', icon: BarChart3, category: 'Intelligence' },
  { id: 'products', label: 'Product Analysis', icon: Package, category: 'Intelligence' },
  { id: 'regional', label: 'Regional Analysis', icon: MapPin, category: 'Intelligence' },
  { id: 'forecast', label: 'Sales Forecast', icon: TrendingUp, category: 'Intelligence' },
  { id: 'explorer', label: 'Data Explorer', icon: Database, category: 'Data Lake' },
  { id: 'settings', label: 'Settings', icon: Settings, category: 'System' },
];

export default function MainLayout({ activeTab, setActiveTab, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentMode = getAppMode();
  const [healthStatus, setHealthStatus] = useState({
    mode: currentMode,
    backendConnected: false,
    databricksConnected: false,
    catalog: 'mypyspark',
    schemaName: 'sales_schema',
    status: 'checking',
  });

  useEffect(() => {
    let isMounted = true;
    const runCheck = () => {
      // Only run live Databricks ping when in live mode; in demo mode just ping FastAPI quickly
      checkBackendHealth(getAppMode() === 'live').then((status) => {
        if (isMounted) setHealthStatus(status);
      });
    };
    runCheck();
    const interval = setInterval(runCheck, 60000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const activeItem = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];
  const isDemo = currentMode === 'demo';
  const isLiveConnected = !isDemo && healthStatus.databricksConnected;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row antialiased">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Dark Navy) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out border-r border-slate-800 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg font-bold tracking-tight text-white">SalesPulse</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  v1.1
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Databricks + PySpark</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {['Overview', 'Data Pipeline', 'Intelligence', 'Data Lake', 'System'].map((cat) => {
            const items = NAV_ITEMS.filter((item) => item.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="space-y-1">
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {cat}
                </p>
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Workspace Connection Info Box */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div
            onClick={() => setActiveTab('settings')}
            className="cursor-pointer p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 space-y-2 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 flex items-center space-x-1.5">
                <Server className="w-3 h-3 text-slate-400" />
                <span>Data Source</span>
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  isDemo
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : isLiveConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : healthStatus.status === 'checking'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {isDemo
                  ? 'DEMO'
                  : isLiveConnected
                  ? 'LIVE'
                  : healthStatus.status === 'checking'
                  ? 'CHECKING'
                  : 'OFFLINE'}
              </span>
            </div>
            <div className="text-xs text-slate-300">
              <div className="font-semibold truncate">
                {isDemo
                  ? 'Local Sample CSV'
                  : isLiveConnected
                  ? 'Databricks SQL Warehouse'
                  : 'Databricks Disconnected'}
              </div>
              <div className="text-[11px] text-slate-400 truncate font-mono">
                {healthStatus.catalog}.{healthStatus.schemaName}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <span className="font-medium text-slate-400 hidden sm:inline">SalesPulse</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900">{activeItem.label}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Truthful Mode & Connection Status Pill */}
            {isDemo ? (
              <span
                onClick={() => setActiveTab('settings')}
                className="cursor-pointer inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                title="Running on local sample CSV. Click to switch to Live Databricks mode."
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-600" />
                <span>DEMO MODE: Sample CSV</span>
              </span>
            ) : isLiveConnected ? (
              <span
                onClick={() => setActiveTab('settings')}
                className="cursor-pointer inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                <span>LIVE: Databricks SQL Warehouse</span>
              </span>
            ) : (
              <span
                onClick={() => setActiveTab('settings')}
                className="cursor-pointer inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                title={healthStatus.message || 'Check Settings to verify backend & Databricks warehouse'}
              >
                <AlertCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                <span>{healthStatus.status === 'checking' ? 'Connecting...' : 'Databricks Disconnected'}</span>
              </span>
            )}

            {/* Quick Action: Upload */}
            <button
              onClick={() => setActiveTab('upload')}
              className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200/60"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload CSV</span>
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 bg-white py-4 px-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            SalesPulse Data Engineering Platform &bull; React.js, FastAPI, Apache Spark &amp; Delta Lake
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            Unity Catalog: {healthStatus.catalog}.{healthStatus.schemaName}
          </span>
        </footer>
      </div>
    </div>
  );
}
