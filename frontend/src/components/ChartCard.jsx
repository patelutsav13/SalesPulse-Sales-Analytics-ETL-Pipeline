import React from 'react';

export default function ChartCard({
  title,
  subtitle,
  badge,
  action,
  children,
  className = '',
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm transition-all duration-200 hover:shadow-md ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
            {badge && (
              <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex items-center space-x-2">{action}</div>}
      </div>

      <div className="pt-4">
        {children}
      </div>
    </div>
  );
}
