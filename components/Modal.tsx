'use client'

/**
 * @deprecated This component is deprecated. Please use `components/ui/modal.tsx` instead.
 * 
 * Migration guide:
 * ```tsx
 * // Old (this component)
 * import Modal from '@/components/Modal'
 * <Modal isOpen={show} onClose={close} title="Title" subtitle="Subtitle" footer={<Button>Save</Button>}>
 *   Content
 * </Modal>
 * 
 * // New (recommended)
 * import { Modal } from '@/components/ui/modal'
 * <Modal open={show} onClose={close} title="Title" subtitle="Subtitle" footer={<Button>Save</Button>}>
 *   Content
 * </Modal>
 * 
 * // Or use composition pattern (best practice)
 * import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal'
 * <Modal open={show} onClose={close}>
 *   <ModalHeader>
 *     <ModalTitle>Title</ModalTitle>
 *     <ModalClose />
 *   </ModalHeader>
 *   <ModalBody>Content</ModalBody>
 *   <ModalFooter><Button>Save</Button></ModalFooter>
 * </Modal>
 * ```
 */

import { lockBodyScroll, unlockBodyScroll } from '@/lib/body-scroll-lock'
import { ReactNode, useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  maxWidth?:
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl'
  footer?: ReactNode
  headerColor?: string
  overflowContent?: 'auto' | 'visible'
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '2xl',
  footer,
  headerColor = 'bg-[#a1001f]',
  overflowContent = 'auto',
}: ModalProps) {
  // Log deprecation warning in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[DEPRECATED] components/Modal.tsx is deprecated. Please migrate to components/ui/modal.tsx. See JSDoc for migration guide.'
      )
    }
  }, [])
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return

    lockBodyScroll()
    return () => {
      unlockBodyScroll()
    }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidthClasses = {
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
  }

  const headerClassName =
    headerColor.includes('from-') || headerColor.includes('to-')
      ? `bg-linear-to-r ${headerColor}`
      : headerColor

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto p-2 pt-[max(env(safe-area-inset-top),0.5rem)] sm:items-center sm:p-6"
      style={{ zIndex: 2000 }}
    >
      {/* Backdrop with minimal opacity */}
      <div
        className="fixed inset-0 bg-opacity-60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`relative my-0.5 flex h-[calc(100dvh-1rem)] w-full flex-col rounded-xl border border-gray-200 bg-white shadow-2xl sm:my-4 sm:h-auto sm:max-h-[95dvh] ${maxWidthClasses[maxWidth]} animate-modal-in ${overflowContent === 'visible' ? 'overflow-visible' : 'overflow-hidden'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`sticky top-0 ${headerClassName} z-10 shrink-0 rounded-t-xl px-4 py-4 sm:px-6`}
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
          className={`px-4 py-5 sm:px-6 sm:py-6 ${overflowContent === 'visible' ? 'overflow-visible' : 'flex-1 overflow-y-auto'}`}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="rounded-b-xl border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
