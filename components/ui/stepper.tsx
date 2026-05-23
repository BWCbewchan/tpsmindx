import React from 'react'
import { Check, X } from 'lucide-react'

export interface StepItem {
  id: string | number
  label: string
  description?: string
  status: 'completed' | 'current' | 'upcoming' | 'error' | 'success'
}

export function Stepper({
  steps,
  compact = false,
}: {
  steps: StepItem[]
  compact?: boolean
}) {
  const circleSize = compact ? 'w-8 h-8' : 'w-8 h-8 sm:w-10 sm:h-10'
  const iconSize = compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'
  const titleSize = compact ? 'text-xs' : 'text-[11px] sm:text-sm'
  const descSize = compact ? 'text-[10px]' : 'text-xs'
  const labelMinHeight = compact ? 'min-h-9' : 'min-h-11 sm:min-h-12'
  const activeIndex = (() => {
    let index = -1
    steps.forEach((step, stepIndex) => {
      if (
        step.status === 'completed' ||
        step.status === 'success' ||
        step.status === 'current' ||
        step.status === 'error'
      ) {
        index = stepIndex
      }
    })
    return index
  })()
  const progressWidth =
    steps.length > 1 && activeIndex >= 0
      ? `${(activeIndex / (steps.length - 1)) * 100}%`
      : '0%'

  return (
    <div className="w-full">
      <div
        className="relative grid w-full"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        <div className="absolute left-0 right-0 top-4 h-0.5 rounded-full bg-slate-200 sm:top-5" />
        <div
          className="absolute left-0 top-4 h-0.5 rounded-full bg-[#1152D4] transition-all duration-500 sm:top-5"
          style={{ width: progressWidth }}
        />
        {steps.map((step, index) => {
          const isCompleted = step.status === 'completed'
          const isSuccess = step.status === 'success'
          const isCurrent = step.status === 'current'
          const isError = step.status === 'error'

          return (
            <div
              key={step.id}
              className="relative z-10 flex min-w-0 flex-col items-center text-center"
            >
              <div className="flex w-full items-center justify-center">
                <div
                  className={`shrink-0 ${circleSize} rounded-full flex items-center justify-center font-semibold ${titleSize} transition-all duration-300 shadow-md
                    ${isCompleted && !isError && !isSuccess ? 'bg-[#1152D4] text-white shadow-[#1152D4]/30' : ''}
                    ${isSuccess ? 'bg-green-500 text-white shadow-green-500/30' : ''}
                    ${isCurrent ? 'bg-[#1152D4] text-white ring-4 ring-[#1152D4]/20' : ''}
                    ${isError ? 'bg-red-500 text-white shadow-red-500/30' : ''}
                    ${!isCompleted && !isCurrent && !isError && !isSuccess ? 'bg-slate-100 text-slate-400 border-2 border-slate-200' : ''}
                  `}
                >
                  {(isCompleted || isSuccess) && !isError ? (
                    <Check className={iconSize} />
                  ) : isError ? (
                    <X className={iconSize} />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
              <div
                className={`${compact ? 'mt-1.5 w-full' : 'mt-2 w-full sm:mt-3'} ${labelMinHeight} px-1 text-center`}
              >
                <p
                  className={`${titleSize} wrap-break-word leading-tight font-semibold whitespace-normal transition-colors ${
                    (isCompleted || isSuccess) && !isError
                      ? 'text-slate-900'
                      : isCurrent
                        ? 'text-[#1152D4]'
                        : isError
                          ? 'text-red-500'
                          : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p
                    className={`${descSize} mt-0.5 whitespace-pre-line ${
                      isCurrent ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
