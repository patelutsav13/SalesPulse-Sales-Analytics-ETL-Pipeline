/**
 * Format numbers as USD currency
 * @param {number} value
 * @returns {string} e.g. "$12,450.00"
 */
export function formatCurrency(value) {
  if (value === undefined || value === null || isNaN(value)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format compact currency e.g. "$12.4k" or "$1.2M"
 */
export function formatCompactCurrency(value) {
  if (value === undefined || value === null || isNaN(value)) return '$0';
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}k`;
  }
  return formatCurrency(value);
}

/**
 * Format integer or float with commas
 * @param {number} value
 * @returns {string} e.g. "1,250"
 */
export function formatNumber(value) {
  if (value === undefined || value === null || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format percentage change
 * @param {number} value
 * @returns {string} e.g. "+14.5%"
 */
export function formatPercent(value) {
  if (value === undefined || value === null || isNaN(value)) return '0.0%';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

/**
 * Format Date string to short human format
 * @param {string} dateStr e.g. "2024-05-15"
 * @returns {string} e.g. "May 15, 2024"
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}
