import React from 'react';
import { CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export default function StatusBadge({ status, size = 'sm' }) {
  const normStatus = (status || '').toUpperCase();

  const configs = {
    COMPLETED: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Completed',
    },
    SUCCESS: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Success',
    },
    RUNNING: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500 animate-pulse',
      icon: RefreshCw,
      spin: true,
      label: 'Running',
    },
    PENDING: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
      icon: Clock,
      label: 'Pending',
    },
    QUEUED: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
      icon: Clock,
      label: 'Queued',
    },
    FAILED: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500',
      icon: AlertCircle,
      label: 'Failed',
    },
  };

  const config = configs[normStatus] || {
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    icon: Clock,
    label: normStatus || 'Unknown',
  };

  const Icon = config.icon;

  const sizeClasses = {
    xs: 'text-[11px] px-2 py-0.5 space-x-1',
    sm: 'text-xs px-2.5 py-1 space-x-1.5',
    md: 'text-sm px-3 py-1.5 space-x-2',
  }[size] || 'text-xs px-2.5 py-1 space-x-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${sizeClasses}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.spin ? 'animate-spin' : ''}`} />
      <span>{config.label}</span>
    </span>
  );
}
