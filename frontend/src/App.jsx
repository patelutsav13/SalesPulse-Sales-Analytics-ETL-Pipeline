import React, { useState } from 'react';
import MainLayout from './layouts/MainLayout';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import DataProcessingPage from './pages/DataProcessingPage';
import SalesAnalyticsPage from './pages/SalesAnalyticsPage';
import ProductAnalysisPage from './pages/ProductAnalysisPage';
import RegionalAnalysisPage from './pages/RegionalAnalysisPage';
import SalesForecastPage from './pages/SalesForecastPage';
import DataExplorerPage from './pages/DataExplorerPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage setActiveTab={setActiveTab} />;
      case 'upload':
        return <UploadPage setActiveTab={setActiveTab} />;
      case 'processing':
        return <DataProcessingPage setActiveTab={setActiveTab} />;
      case 'analytics':
        return <SalesAnalyticsPage />;
      case 'products':
        return <ProductAnalysisPage />;
      case 'regional':
        return <RegionalAnalysisPage />;
      case 'forecast':
        return <SalesForecastPage />;
      case 'explorer':
        return <DataExplorerPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage setActiveTab={setActiveTab} />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </MainLayout>
  );
}
