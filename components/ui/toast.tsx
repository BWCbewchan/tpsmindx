/**
 * Toast Component
 * 
 * Toast notification component following international standards:
 * - Material Design 3 Snackbar
 * - Apple HIG Alerts
 * 
 * Position: Top-right corner
 * Z-Index: 1600 (z-tooltip) - Above all content
 * Auto-dismiss: 5 seconds (configurable)
 * 
 * @example
 * ```tsx
 * // Success toast
 * <Toast variant="success" title="Thành công" description="Đã lưu thay đổi" />
 * 
 * // Error toast
 * <Toast variant="error" title="Lỗi" description="Không thể lưu thay đổi" />
 * 
 * // With action
 * <Toast
 *   variant="default"
 *   title="Đã xóa"
 *   description="Mục đã được xóa"
 *   action={<Button size="sm" variant="ghost">Hoàn tác</Button>}
 * />
 * ```
 */

'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Box } from './primitives/box'
import { Stack } from './primitives/stack'
import { Text } from './primitives/text'
import { Icon } from './primitives/icon'

const toastVariants = cva(
  'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'bg-white border-gray-200',
        success: 'bg-green-50 border-green-200',
        error: 'bg-red-50 border-red-200',
        warning: 'bg-yellow-50 border-yellow-200',
        info: 'bg-blue-50 border-blue-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const iconMap = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const iconColorMap = {
  default: 'text-gray-600',
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
}

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  title: string
  description?: string
  action?: React.ReactNode
  onClose?: () => void
  duration?: number
}

export function Toast({
  variant = 'default',
  title,
  description,
  action,
  onClose,
  duration = 5000,
  className,
  ...props
}: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(true)
  const IconComponent = iconMap[variant || 'default']
  const iconColor = iconColorMap[variant || 'default']

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose?.(), 300) // Wait for animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  if (!isVisible) {
    return null
  }

  return (
    <Box
      className={cn(
        toastVariants({ variant }),
        'animate-in slide-in-from-top-full fade-in-0 duration-300',
        !isVisible && 'animate-out slide-out-to-top-full fade-out-0',
        className,
      )}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {/* Icon */}
      <Icon icon={IconComponent} size="md" className={iconColor} />

      {/* Content */}
      <Stack gap="xs" className="flex-1 min-w-0">
        <Text weight="semibold" className="text-gray-900">
          {title}
        </Text>
        {description && (
          <Text size="sm" color="muted">
            {description}
          </Text>
        )}
        {action && <Box className="mt-2">{action}</Box>}
      </Stack>

      {/* Close button */}
      {onClose && (
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => onClose(), 300)
          }}
          className="rounded-md p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Đóng"
        >
          <X className="size-4" />
        </button>
      )}
    </Box>
  )
}

// Toast Container - Position toasts in top-right corner
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <Box
      className="fixed top-4 right-4 z-[1600] flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {children}
    </Box>
  )
}

// Toast Provider Context (optional - for programmatic toasts)
type ToastContextType = {
  showToast: (props: Omit<ToastProps, 'onClose'>) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Array<ToastProps & { id: string }>>([])

  const showToast = React.useCallback((props: Omit<ToastProps, 'onClose'>) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { ...props, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
