'use client';

interface SubmissionProgressBarProps {
  submitted: number;
  total: number;
  showText?: boolean;
  size?: 'sm' | 'md';
}

export default function SubmissionProgressBar({
  submitted,
  total,
  showText = true,
  size = 'md',
}: SubmissionProgressBarProps) {
  const ratio = total > 0 ? Math.round((submitted / total) * 100) : 0;

  // Color based on ratio
  let barColor = 'bg-red-500';
  let textColor = 'text-red-600';
  if (ratio === 100) {
    barColor = 'bg-emerald-500';
    textColor = 'text-emerald-600';
  } else if (ratio > 0) {
    barColor = 'bg-amber-500';
    textColor = 'text-amber-600';
  }

  const barHeight = size === 'sm' ? 'h-2' : 'h-2.5';

  return (
    <div className="flex items-center gap-2.5 min-w-[140px]">
      {showText && (
        <span className={`text-sm font-semibold ${textColor} whitespace-nowrap min-w-[40px]`}>
          {submitted}/{total}
        </span>
      )}
      <div className={`flex-1 ${barHeight} bg-neutral-200 rounded-full overflow-hidden min-w-[60px]`}>
        <div
          className={`${barHeight} ${barColor} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${ratio}%` }}
        />
      </div>
      {showText && (
        <span className={`text-xs font-medium ${textColor} whitespace-nowrap`}>
          {ratio}%
        </span>
      )}
    </div>
  );
}
