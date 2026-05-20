/**
 * Skeleton Component
 * 
 * Skeleton loading screens following international standards:
 * - Material Design 3 Skeleton Screens
 * - Apple HIG Loading States
 * 
 * @example
 * ```tsx
 * // Basic skeleton
 * <Skeleton className="h-4 w-full" />
 * 
 * // Circle skeleton (avatar)
 * <Skeleton className="size-12 rounded-full" />
 * 
 * // Card skeleton
 * <div className="space-y-3">
 *   <Skeleton className="h-32 w-full" />
 *   <Skeleton className="h-4 w-3/4" />
 *   <Skeleton className="h-4 w-1/2" />
 * </div>
 * ```
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200',
        className,
      )}
      role="status"
      aria-label="Đang tải"
      {...props}
    />
  )
}

// Pre-built skeleton patterns
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === lines - 1 ? 'w-3/4' : 'w-full',
          )}
        />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'size-8',
    md: 'size-12',
    lg: 'size-16',
  }
  
  return (
    <Skeleton className={cn('rounded-full', sizeClasses[size])} />
  )
}

export function SkeletonButton() {
  return <Skeleton className="h-9 w-24 rounded-lg" />
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  )
}
