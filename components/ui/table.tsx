'use client'

/**
 * Table Component
 * 
 * Data table component following international standards:
 * - Material Design 3 Data Tables
 * - Apple HIG Tables
 * - WCAG 2.1 AA Accessibility
 * 
 * Built with base Box component for consistency.
 * Includes responsive horizontal scroll for mobile.
 * 
 * @example
 * ```tsx
 * <Table>
 *   <TableHeader>
 *     <TableRow>
 *       <TableHead>Tên</TableHead>
 *       <TableHead>Email</TableHead>
 *       <TableHead>Vai trò</TableHead>
 *     </TableRow>
 *   </TableHeader>
 *   <TableBody>
 *     <TableRow>
 *       <TableCell>Nguyễn Văn A</TableCell>
 *       <TableCell>a@example.com</TableCell>
 *       <TableCell>Giáo viên</TableCell>
 *     </TableRow>
 *   </TableBody>
 * </Table>
 * ```
 */

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Box } from './primitives/box'

function Table({ className, children, ...props }: React.ComponentProps<'table'>) {
    return (
        <Box
            data-slot="table-container"
            className="relative w-full overflow-x-auto rounded-lg border border-gray-200"
        >
            <table
                data-slot="table"
                className={cn('w-full caption-bottom text-sm', className)}
                {...props}
            >
                {children}
            </table>
        </Box>
    )
}

function TableHeader({ className, children, ...props }: React.ComponentProps<'thead'>) {
    return (
        <thead
            data-slot="table-header"
            className={cn(
                'bg-gray-50 [&_tr]:border-b [&_tr]:border-gray-200',
                className
            )}
            {...props}
        >
            {children}
        </thead>
    )
}

function TableBody({ className, children, ...props }: React.ComponentProps<'tbody'>) {
    return (
        <tbody
            data-slot="table-body"
            className={cn(
                'bg-white [&_tr:last-child]:border-0',
                className
            )}
            {...props}
        >
            {children}
        </tbody>
    )
}

function TableFooter({ className, children, ...props }: React.ComponentProps<'tfoot'>) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn(
                'bg-gray-50 border-t border-gray-200 font-medium [&>tr]:last:border-b-0',
                className,
            )}
            {...props}
        >
            {children}
        </tfoot>
    )
}

function TableRow({ className, children, ...props }: React.ComponentProps<'tr'>) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                'border-b border-gray-200 transition-colors',
                'hover:bg-gray-50',
                'data-[state=selected]:bg-blue-50',
                className,
            )}
            {...props}
        >
            {children}
        </tr>
    )
}

function TableHead({ className, children, ...props }: React.ComponentProps<'th'>) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                'h-12 px-4 text-left align-middle font-semibold text-gray-700 text-xs uppercase tracking-wide',
                '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
                className,
            )}
            {...props}
        >
            {children}
        </th>
    )
}

function TableCell({ className, children, ...props }: React.ComponentProps<'td'>) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                'px-4 py-3 align-middle text-gray-900',
                '[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
                className,
            )}
            {...props}
        >
            {children}
        </td>
    )
}

function TableCaption({
    className,
    children,
    ...props
}: React.ComponentProps<'caption'>) {
    return (
        <caption
            data-slot="table-caption"
            className={cn('mt-4 text-sm text-gray-600', className)}
            {...props}
        >
            {children}
        </caption>
    )
}

export {
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableFooter,
  TableHead, 
  TableHeader, 
  TableRow
}
