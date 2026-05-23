'use client';

import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: {
    value: number; // percentage change
    direction: 'up' | 'down' | 'flat';
  };
  /** 0–100 progress bar value; shown only when provided */
  progress?: number;
  /** When progress exceeds this %, card shows warning state */
  warningThreshold?: number;
  /** When true, pulsing dot indicates live data */
  live?: boolean;
  /** Optional sub-detail, e.g. "500: 0.8% | 404: 0.4%" */
  detail?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  progress,
  warningThreshold,
  live,
  detail,
}: MetricCardProps) {
  const isWarning =
    progress !== undefined &&
    warningThreshold !== undefined &&
    progress > warningThreshold;

  const trendColor =
    trend?.direction === 'up'
      ? 'text-emerald-600'
      : trend?.direction === 'down'
        ? 'text-red-500'
        : 'text-gray-400';

  const trendIcon =
    trend?.direction === 'up'
      ? '↑'
      : trend?.direction === 'down'
        ? '↓'
        : '→';

  const progressColor = isWarning
    ? 'bg-red-500'
    : 'bg-[#a1001f]';

  const progressTrack = isWarning
    ? 'bg-red-100'
    : 'bg-gray-100';

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border bg-white p-5 
        shadow-sm hover:shadow-md transition-all duration-300 group
        ${isWarning ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}
      `}
    >
      {/* Decorative background */}
      <div
        className={`
          absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-[0.06] 
          transition-transform duration-500 group-hover:scale-110
          ${isWarning ? 'bg-red-500' : 'bg-[#a1001f]'}
        `}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`
              flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300
              ${isWarning
                ? 'bg-red-50 text-red-600'
                : 'bg-[#a1001f]/8 text-[#a1001f] group-hover:bg-[#a1001f] group-hover:text-white'
              }
            `}
          >
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <span className="text-xs font-medium text-gray-500 leading-tight max-w-[120px]">
            {label}
          </span>
        </div>

        {live && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        )}
      </div>

      {/* Value */}
      <div className="relative flex items-baseline gap-1.5 mb-1">
        <span className="text-2xl font-bold tracking-tight text-gray-900">
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-gray-400">{unit}</span>
        )}
      </div>

      {/* Trend */}
      {trend && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-xs font-semibold ${trendColor}`}>
            {trendIcon} {Math.abs(trend.value)}%
          </span>
          <span className="text-[10px] text-gray-400">so với 24h trước</span>
        </div>
      )}

      {/* Detail */}
      {detail && (
        <p className="text-[11px] text-gray-500 mb-2">{detail}</p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="mt-2">
          <div className={`h-1.5 w-full rounded-full ${progressTrack}`}>
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ease-out ${progressColor}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className={`text-[10px] font-medium ${isWarning ? 'text-red-500' : 'text-gray-400'}`}>
              {progress}%
            </span>
            {warningThreshold && (
              <span className="text-[10px] text-gray-300">
                Ngưỡng: {warningThreshold}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Warning badge */}
      {isWarning && (
        <div className="absolute right-3 top-3">
          <span className="flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
        </div>
      )}
    </div>
  );
}
