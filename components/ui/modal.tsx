/**
 * Modal Component
 * 
 * Reusable modal/dialog component following international design standards:
 * - Material Design 3 (Google)
 * - Apple Human Interface Guidelines
 * - WCAG 2.1 AA Accessibility
 * 
 * Features:
 * - Backdrop with blur effect
 * - Click outside to close (optional)
 * - ESC key to close
 * - Focus trap
 * - Scroll lock on body
 * - Smooth animations
 * - Responsive sizing
 * - Colored headers (legacy Modal support)
 * - Footer support (legacy Modal support)
 * - Subtitle support (legacy Modal support)
 * 
 * @example
 * ```tsx
 * // New API (recommended)
 * <Modal open={isOpen} onClose={() => setIsOpen(false)}>
 *   <ModalHeader>
 *     <ModalTitle>Edit Profile</ModalTitle>
 *     <ModalClose />
 *   </ModalHeader>
 *   <ModalBody>
 *     <p>Modal content here</p>
 *   </ModalBody>
 *   <ModalFooter>
 *     <Button variant="outline" onClick={onCancel}>Cancel</Button>
 *     <Button onClick={onSave}>Save</Button>
 *   </ModalFooter>
 * </Modal>
 * 
 * // Legacy API (backward compatible)
 * <Modal 
 *   open={isOpen} 
 *   onClose={() => setIsOpen(false)}
 *   title="Edit Profile"
 *   subtitle="Update your information"
 *   headerColor="bg-[#a1001f]"
 *   footer={<Button>Save</Button>}
 * >
 *   <p>Modal content here</p>
 * </Modal>
 * ```
 */

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface ModalProps {
  open?: boolean
  onClose: () => void
  children: React.ReactNode
  /** Prevent closing when clicking outside (default: false) */
  disableBackdropClick?: boolean
  /** Prevent closing with ESC key (default: false) */
  disableEscapeKey?: boolean
  /** Custom backdrop className */
  backdropClassName?: string
  /** Custom container className */
  containerClassName?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'
  /** Legacy API: Modal title (use ModalHeader + ModalTitle instead) */
  title?: string
  /** Legacy API: Modal subtitle */
  subtitle?: string
  /** Legacy API: Header background color (default: bg-[#a1001f]) */
  headerColor?: string
  /** Legacy API: Footer content (use ModalFooter instead) */
  footer?: React.ReactNode
  /** Legacy API: Content overflow behavior */
  overflowContent?: 'auto' | 'visible'
  /** @deprecated Use 'open' instead */
  isOpen?: boolean
  /** @deprecated Use 'size' instead */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl'
}

interface ModalHeaderProps {
  children: React.ReactNode
  className?: string
}

interface ModalTitleProps {
  children: React.ReactNode
  className?: string
}

interface ModalCloseProps {
  onClick?: () => void
  className?: string
}

interface ModalBodyProps {
  children: React.ReactNode
  className?: string
}

interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
}

export function Modal({
  open: openProp,
  isOpen: isOpenProp,
  onClose,
  children,
  disableBackdropClick = false,
  disableEscapeKey = false,
  backdropClassName,
  containerClassName,
  size: sizeProp,
  maxWidth: maxWidthProp,
  title,
  subtitle,
  headerColor = 'bg-[#a1001f]',
  footer,
  overflowContent = 'auto',
}: ModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null)
  
  // Support both 'open' and legacy 'isOpen' prop
  const open = openProp ?? isOpenProp ?? false
  
  // Support both 'size' and legacy 'maxWidth' prop
  const size = sizeProp ?? maxWidthProp ?? 'md'
  
  // Determine if using legacy API (has title prop)
  const isLegacyAPI = !!title

  // Handle ESC key
  React.useEffect(() => {
    if (!open || disableEscapeKey) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose, disableEscapeKey])

  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (!open) return

    const originalStyle = window.getComputedStyle(document.body).overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalStyle
    }
  }, [open])

  // Focus trap
  React.useEffect(() => {
    if (!open || !modalRef.current) return

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => document.removeEventListener('keydown', handleTab)
  }, [open])

  if (!open) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (disableBackdropClick) return
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const headerClassName =
    headerColor?.includes('from-') || headerColor?.includes('to-')
      ? `bg-linear-to-r ${headerColor}`
      : headerColor

  // Legacy API: Render with title/subtitle/footer
  if (isLegacyAPI) {
    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-2 pt-[max(env(safe-area-inset-top),0.5rem)] sm:items-center sm:p-6',
          'animate-in fade-in duration-200',
          backdropClassName
        )}
        onClick={handleBackdropClick}
      >
        <div
          ref={modalRef}
          className={cn(
            'relative my-0.5 flex w-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-2xl sm:my-4 sm:h-auto sm:max-h-[95dvh]',
            sizeClasses[size],
            'animate-in zoom-in-95 duration-200',
            'overflow-hidden',
            containerClassName
          )}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div
            className={cn(
              'flex-shrink-0 rounded-t-xl px-4 py-4 sm:px-6',
              headerClassName
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-lg sm:text-xl font-semibold text-white break-words text-pretty leading-snug">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-white text-opacity-90 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="shrink-0 text-white hover:text-gray-200 transition-colors p-1"
                aria-label="Close modal"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            className={cn(
              'px-4 py-5 sm:px-6 sm:py-6 flex-1 min-h-0 overflow-y-auto overscroll-contain'
            )}
          >
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="shrink-0 rounded-b-xl border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    )
  }

  // New API: Render with composition pattern
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto',
        'animate-in fade-in duration-200',
        backdropClassName
      )}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className={cn(
          'bg-white rounded-xl shadow-2xl w-full my-8',
          'animate-in zoom-in-95 duration-200',
          sizeClasses[size],
          containerClassName
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-6 py-4 border-b border-gray-200',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ModalTitle({ children, className }: ModalTitleProps) {
  return (
    <h3 className={cn('text-lg font-bold text-gray-900', className)}>
      {children}
    </h3>
  )
}

export function ModalClose({ onClick, className }: ModalCloseProps) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      className={cn('shrink-0', className)}
      aria-label="Đóng"
    >
      <X className="h-4 w-4" />
    </Button>
  )
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('px-6 py-4 overflow-y-auto max-h-[60vh]', className)}>
      {children}
    </div>
  )
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50',
        className
      )}
    >
      {children}
    </div>
  )
}
