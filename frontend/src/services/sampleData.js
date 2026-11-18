/**
 * Verified Local Demo Dataset (exact math computed from data/sample_sales.csv)
 * Used ONLY when the user explicitly selects Demo Mode and the backend is offline.
 */

export const sampleSummaryKPIs = {
  totalRevenue: 33077.47,
  totalOrders: 80,
  totalProducts: 15,
  averageOrderValue: 413.47,
  totalCustomers: 80,
  revenueGrowth: -12.2,
  dataSource: 'demo',
};

export const sampleMonthlySales = [
  { year: 2024, month: 1, monthKey: '2024-01', monthName: 'Jan 2024', revenue: 2223.45, orders: 7, avgOrderValue: 317.64 },
  { year: 2024, month: 2, monthKey: '2024-02', monthName: 'Feb 2024', revenue: 3073.92, orders: 8, avgOrderValue: 384.24 },
  { year: 2024, month: 3, monthKey: '2024-03', monthName: 'Mar 2024', revenue: 3434.99, orders: 7, avgOrderValue: 490.71 },
  { year: 2024, month: 4, monthKey: '2024-04', monthName: 'Apr 2024', revenue: 1683.44, orders: 8, avgOrderValue: 210.43 },
  { year: 2024, month: 5, monthKey: '2024-05', monthName: 'May 2024', revenue: 4195.98, orders: 7, avgOrderValue: 599.43 },
  { year: 2024, month: 6, monthKey: '2024-06', monthName: 'Jun 2024', revenue: 3001.95, orders: 7, avgOrderValue: 428.85 },
  { year: 2024, month: 7, monthKey: '2024-07', monthName: 'Jul 2024', revenue: 2104.96, orders: 6, avgOrderValue: 350.83 },
  { year: 2024, month: 8, monthKey: '2024-08', monthName: 'Aug 2024', revenue: 2272.48, orders: 6, avgOrderValue: 378.75 },
  { year: 2024, month: 9, monthKey: '2024-09', monthName: 'Sep 2024', revenue: 1373.94, orders: 6, avgOrderValue: 228.99 },
  { year: 2024, month: 10, monthKey: '2024-10', monthName: 'Oct 2024', revenue: 3103.99, orders: 6, avgOrderValue: 517.33 },
  { year: 2024, month: 11, monthKey: '2024-11', monthName: 'Nov 2024', revenue: 2595.42, orders: 6, avgOrderValue: 432.57 },
  { year: 2024, month: 12, monthKey: '2024-12', monthName: 'Dec 2024', revenue: 4012.95, orders: 6, avgOrderValue: 668.82 },
];

export const sampleCategorySales = [
  { category: 'Electronics', revenue: 20120.56, orders: 30, percentage: 60.8, fill: '#3b82f6' },
  { category: 'Home Appliances', revenue: 6640.91, orders: 29, percentage: 20.1, fill: '#8b5cf6' },
  { category: 'Furniture', revenue: 6316.00, orders: 21, percentage: 19.1, fill: '#06b6d4' },
];

export const sampleRegionalSales = [
  { region: 'North', revenue: 10597.40, orders: 17, avgOrderValue: 623.38 },
  { region: 'West', revenue: 6081.48, orders: 16, avgOrderValue: 380.09 },
  { region: 'East', revenue: 6058.88, orders: 16, avgOrderValue: 378.68 },
  { region: 'Central', revenue: 5244.92, orders: 15, avgOrderValue: 349.66 },
  { region: 'South', revenue: 5094.79, orders: 16, avgOrderValue: 318.42 },
];

export const sampleTopProducts = [
  { rank: 1, productId: 'PROD-12', productName: 'AeroGlide Gaming Laptop', category: 'Electronics', quantitySold: 9, unitPrice: 1299.00, totalRevenue: 11691.00 },
  { rank: 2, productId: 'PROD-01', productName: 'Quantum 4K Smart TV', category: 'Electronics', quantitySold: 10, unitPrice: 499.99, totalRevenue: 4999.90 },
  { rank: 3, productId: 'PROD-10', productName: 'FlexiStand Standing Desk', category: 'Furniture', quantitySold: 7, unitPrice: 450.00, totalRevenue: 3150.00 },
  { rank: 4, productId: 'PROD-15', productName: 'Zenith Robot Vacuum', category: 'Home Appliances', quantitySold: 6, unitPrice: 349.00, totalRevenue: 2094.00 },
  { rank: 5, productId: 'PROD-02', productName: 'ErgoFlex Office Chair', category: 'Furniture', quantitySold: 8, unitPrice: 249.50, totalRevenue: 1996.00 },
  { rank: 6, productId: 'PROD-03', productName: 'SoundWave ANC Headphones', category: 'Electronics', quantitySold: 12, unitPrice: 129.99, totalRevenue: 1559.88 },
  { rank: 7, productId: 'PROD-04', productName: 'SmartBreeze Air Purifier', category: 'Home Appliances', quantitySold: 8, unitPrice: 189.00, totalRevenue: 1512.00 },
  { rank: 8, productId: 'PROD-07', productName: 'ProGrip Mechanical Keyboard', category: 'Electronics', quantitySold: 11, unitPrice: 110.00, totalRevenue: 1210.00 },
  { rank: 9, productId: 'PROD-11', productName: 'PureAir Dehumidifier', category: 'Home Appliances', quantitySold: 5, unitPrice: 220.00, totalRevenue: 1100.00 },
  { rank: 10, productId: 'PROD-14', productName: 'ThermoBrew Coffee Maker', category: 'Home Appliances', quantitySold: 9, unitPrice: 89.99, totalRevenue: 809.91 },
];

export const sampleForecast = {
  methodology: '3-Month Moving Average + Simple Linear Trend (OLS)',
  assumptions: 'Assumes recent 3-month revenue levels and the linear historical trend continue without major external shocks.',
  limitations: [
    'Small dataset (12 monthly data points): complex machine learning models (e.g., ARIMA/Prophet) would overfit.',
    'Estimates are NOT guaranteed — they do not account for sudden promotions, supply shortages, or external market changes.',
    'Range shown reflects ±1 historical standard deviation (±$875.15), not a formal probability guarantee.',
  ],
  dataPointsUsed: 12,
  movingAverage3m: 3237.45,
  monthlyTrendSlope: 16.94,
  historical: sampleMonthlySales.map((m, idx) => ({
    period: m.monthName,
    monthKey: m.monthKey,
    actual: m.revenue,
    predicted: idx === sampleMonthlySales.length - 1 ? m.revenue : null,
    isForecast: false,
  })),
  forecast: [
    { period: 'Jan 2025', monthKey: '2025-01', actual: null, predicted: 3254.40, lowerBound: 2379.25, upperBound: 4129.55, isForecast: true },
    { period: 'Feb 2025', monthKey: '2025-02', actual: null, predicted: 3271.34, lowerBound: 2396.19, upperBound: 4146.49, isForecast: true },
    { period: 'Mar 2025', monthKey: '2025-03', actual: null, predicted: 3288.29, lowerBound: 2413.14, upperBound: 4163.44, isForecast: true },
  ],
  insights: [
    'Based on 12 actual historical months, the recent 3-month moving average is $3,237.45/month.',
    'Overall historical monthly trend is upward ($+16.94 per month).',
    'Total projected revenue for the next 3 months is $9,814.03 (illustrative estimate).',
  ],
  dataSource: 'demo',
};

export const sampleRawRecords = [
  { order_id: 'ORD-1080', order_date: '2024-12-28', customer_name: 'Chloe Foster', product_name: 'ThermoBrew Coffee Maker', category: 'Home Appliances', region: 'North', quantity: 2, unit_price: 89.99, sales_amount: 179.98 },
  { order_id: 'ORD-1079', order_date: '2024-12-23', customer_name: 'Dominic Simmons', product_name: 'HydroFlow Water Filter', category: 'Home Appliances', region: 'Central', quantity: 3, unit_price: 85.00, sales_amount: 255.00 },
  { order_id: 'ORD-1078', order_date: '2024-12-19', customer_name: 'Destiny Butler', product_name: 'FlexiStand Standing Desk', category: 'Furniture', region: 'East', quantity: 1, unit_price: 450.00, sales_amount: 450.00 },
  { order_id: 'ORD-1077', order_date: '2024-12-14', customer_name: 'Garrett Washington', product_name: 'SoundWave ANC Headphones', category: 'Electronics', region: 'South', quantity: 3, unit_price: 129.99, sales_amount: 389.97 },
  { order_id: 'ORD-1076', order_date: '2024-12-09', customer_name: 'Alexis Flores', product_name: 'Lumina Desk Lamp', category: 'Furniture', region: 'West', quantity: 4, unit_price: 35.00, sales_amount: 140.00 },
  { order_id: 'ORD-1075', order_date: '2024-12-04', customer_name: 'Tristan Hughes', product_name: 'AeroGlide Gaming Laptop', category: 'Electronics', region: 'North', quantity: 2, unit_price: 1299.00, sales_amount: 2598.00 },
  { order_id: 'ORD-1074', order_date: '2024-11-29', customer_name: 'Savannah Patterson', product_name: 'OrthoRest Memory Pillow', category: 'Furniture', region: 'Central', quantity: 2, unit_price: 45.00, sales_amount: 90.00 },
  { order_id: 'ORD-1073', order_date: '2024-11-25', customer_name: 'Colton Long', product_name: 'Quantum 4K Smart TV', category: 'Electronics', region: 'East', quantity: 2, unit_price: 499.99, sales_amount: 999.98 },
  { order_id: 'ORD-1072', order_date: '2024-11-20', customer_name: 'Sierra Powell', product_name: 'Apex Wireless Mouse', category: 'Electronics', region: 'South', quantity: 6, unit_price: 29.99, sales_amount: 179.94 },
  { order_id: 'ORD-1071', order_date: '2024-11-15', customer_name: 'Jesse Perry', product_name: 'Zenith Robot Vacuum', category: 'Home Appliances', region: 'West', quantity: 2, unit_price: 349.00, sales_amount: 698.00 },
];
