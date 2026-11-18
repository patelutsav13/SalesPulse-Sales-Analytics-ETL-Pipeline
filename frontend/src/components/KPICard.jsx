import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KPICard({
  title,
  value,
  change,
  isPositive,
  icon: Icon,
  description,
  accent = 'blue',
}) {
  const accentColors = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      border: 'hover:border-blue-300',
      glow: 'group-hover:bg-blue-500/10',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      border: 'hover:border-purple-300',
      glow: 'group-hover:bg-purple-500/10',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'hover:border-emerald-300',
      glow: 'group-hover:bg-emerald-500/10',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'hover:border-amber-300',
      glow: 'group-hover:bg-amber-500/10',
    },
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-600',
      border: 'hover:border-indigo-300',
      glow: 'group-hover:bg-indigo-500/10',
    },
  };

  const style = accentColors[accent] || accentColors.blue;

  return (
    <div className={`group relative bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm transition-all duration-200 ${style.border} kpi-card-hover`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <div className="text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${style.bg} ${style.text} transition-colors duration-200`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        {change !== undefined && (
          <div className="flex items-center space-x-1.5">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-xs ${
                isPositive === true
                  ? 'bg-emerald-50 text-emerald-700'
                  : isPositive === false
                  ? 'bg-rose-50 text-rose-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {isPositive === true && <TrendingUp className="w-3 h-3 mr-0.5 inline" />}
              {isPositive === false && <TrendingDown className="w-3 h-3 mr-0.5 inline" />}
              {isPositive === null && <Minus className="w-3 h-3 mr-0.5 inline" />}
              {change}
            </span>
            <span className="text-slate-400">vs last month</span>
          </div>
        )}
        {description && (
          <span className="text-slate-400 truncate max-w-[150px]">{description}</span>
        )}
      </div>
    </div>
  );
}
