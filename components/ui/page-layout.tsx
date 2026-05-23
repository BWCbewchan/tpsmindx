/**
 * PageLayout Component
 * 
 * Standardized page layout wrapper for consistent spacing and max-width across all pages.
 * 
 * Features:
 * - Responsive padding (mobile → desktop)
 * - Configurable max-width
 * - Optional background variants
 * - Consistent spacing system
 * 
 * @example
 * ```tsx
 * <PageLayout>
 *   <h1>My Page</h1>
 *   <p>Content here</p>
 * </PageLayout>
 * 
 * <PageLayout maxWidth="4xl" background="gradient">
 *   <h1>Narrow Page with Gradient</h1>
 * </PageLayout>
 * ```
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

const maxWidthVariants = {
  'full': 'max-w-full',
  '7xl': 'max-w-7xl',
  '6xl': 'max-w-6xl',
  '5xl': 'max-w-5xl',
  '4xl': 'max-w-4xl',
  '3xl': 'max-w-3xl',
  '2xl': 'max-w-2xl',
} as const

const backgroundVariants = {
  'white': 'bg-white',
  'gray': 'bg-gray-50',
  'gradient': 'bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200',
  'gradient-blue': 'bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50',
  'none': '',
} as const

const paddingVariants = {
  'none': 'p-0',
  'sm': 'p-2 sm:p-3 lg:p-4',
  'md': 'p-4 sm:p-6 lg:p-8',
  'lg': 'p-6 sm:p-8 lg:p-10',
  'responsive': 'px-0 py-1.25 sm:px-[1.5%] sm:py-2 lg:px-[2%] lg:py-3 xl:px-[2.5%] xl:py-3',
} as const

export interface PageLayoutProps {
  /** Page content */
  children: React.ReactNode
  
  /** Maximum width constraint */
  maxWidth?: keyof typeof maxWidthVariants
  
  /** Background style */
  background?: keyof typeof backgroundVariants
  
  /** Padding size */
  padding?: keyof typeof paddingVariants
  
  /** Center content horizontally */
  centered?: boolean
  
  /** Additional CSS classes */
  className?: string
  
  /** Full viewport height */
  fullHeight?: boolean
}

export function PageLayout({
  children,
  maxWidth = '7xl',
  background = 'white',
  padding = 'md',
  centered = true,
  className,
  fullHeight = true,
}: PageLayoutProps) {
  return (
    <div
      className={cn(
        // Base styles
        fullHeight && 'min-h-screen',
        backgroundVariants[background],
        paddingVariants[padding],
        className
      )}
    >
      <div
        className={cn(
          maxWidthVariants[maxWidth],
          centered && 'mx-auto',
        )}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * PageLayoutContent Component
 * 
 * Inner content wrapper with consistent spacing.
 * Use inside PageLayout for additional spacing control.
 * 
 * @example
 * ```tsx
 * <PageLayout>
 *   <PageLayoutContent spacing="lg">
 *     <h1>Title</h1>
 *     <p>Content with large spacing</p>
 *   </PageLayoutContent>
 * </PageLayout>
 * ```
 */

const spacingVariants = {
  'none': 'space-y-0',
  'xs': 'space-y-2',
  'sm': 'space-y-3',
  'md': 'space-y-4',
  'lg': 'space-y-5',
  'xl': 'space-y-6',
  '2xl': 'space-y-8',
} as const

export interface PageLayoutContentProps {
  children: React.ReactNode
  spacing?: keyof typeof spacingVariants
  className?: string
}

export function PageLayoutContent({
  children,
  spacing = 'lg',
  className,
}: PageLayoutContentProps) {
  return (
    <div className={cn(spacingVariants[spacing], className)}>
      {children}
    </div>
  )
}

/**
 * PageLayoutSection Component
 * 
 * Section wrapper for grouping related content.
 * 
 * @example
 * ```tsx
 * <PageLayout>
 *   <PageLayoutSection>
 *     <h2>Section 1</h2>
 *     <p>Content</p>
 *   </PageLayoutSection>
 *   
 *   <PageLayoutSection>
 *     <h2>Section 2</h2>
 *     <p>More content</p>
 *   </PageLayoutSection>
 * </PageLayout>
 * ```
 */

export interface PageLayoutSectionProps {
  children: React.ReactNode
  spacing?: keyof typeof spacingVariants
  className?: string
}

export function PageLayoutSection({
  children,
  spacing = 'md',
  className,
}: PageLayoutSectionProps) {
  return (
    <section className={cn(spacingVariants[spacing], className)}>
      {children}
    </section>
  )
}
