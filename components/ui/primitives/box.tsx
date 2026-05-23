import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export interface BoxProps extends React.ComponentProps<'div'> {
  asChild?: boolean
}

export function Box({ asChild = false, className, ...props }: BoxProps) {
  const Comp = asChild ? Slot : 'div'
  return <Comp className={cn(className)} {...props} />
}
