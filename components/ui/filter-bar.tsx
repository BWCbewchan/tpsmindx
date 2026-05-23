/**
 * FilterBar Component
 * 
 * Reusable filter bar component for consistent filtering UI across the app.
 * 
 * Features:
 * - Multiple filter buttons with active state
 * - Clear filters button
 * - Responsive layout
 * - Consistent styling
 * 
 * @example
 * ```tsx
 * <FilterBar
 *   label="Khu vực"
 *   options={['Tất cả', 'Hà Nội', 'TP.HCM']}
 *   selected={selectedRegion}
 *   onSelect={setSelectedRegion}
 * />
 * 
 * <FilterBar
 *   label="Chương trình"
 *   options={['Coding', 'Robotics', 'Art']}
 *   selected={selectedPrograms}
 *   onSelect={setSelectedPrograms}
 *   multiple
 *   onClear={() => setSelectedPrograms([])}
 * />
 * ```
 */

import * as React from 'react'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Icon } from './primitives/icon'

interface FilterBarProps {
  /** Label for the filter group */
  label: string
  /** Filter options */
  options: string[] | readonly string[]
  /** Selected value(s) */
  selected: string | string[]
  /** Callback when selection changes */
  onSelect: (value: string | string[]) => void
  /** Allow multiple selections */
  multiple?: boolean
  /** Show clear button when filters are active */
  onClear?: () => void
  /** Custom className for container */
  className?: string
  /** Icon to show before label */
  icon?: React.ComponentType<{ className?: string }>
}

export function FilterBar({
  label,
  options,
  selected,
  onSelect,
  multiple = false,
  onClear,
  className,
  icon: IconComponent = Filter,
}: FilterBarProps) {
  const selectedArray = Array.isArray(selected) ? selected : [selected]
  const hasSelection = multiple
    ? selectedArray.length > 0
    : selected !== options[0] // Assume first option is "All"

  const handleSelect = (option: string) => {
    if (multiple) {
      const currentSelected = Array.isArray(selected) ? selected : []
      const isSelected = currentSelected.includes(option)

      if (isSelected) {
        onSelect(currentSelected.filter((s) => s !== option))
      } else {
        onSelect([...currentSelected, option])
      }
    } else {
      onSelect(option)
    }
  }

  const isSelected = (option: string) => {
    return selectedArray.includes(option)
  }

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex items-center gap-2 min-w-24">
        <IconComponent className="h-5 w-5 text-gray-600" />
        <span className="text-gray-700 font-medium text-sm">{label}:</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {options.map((option) => (
          <Button
            key={option}
            onClick={() => handleSelect(option)}
            variant={isSelected(option) ? 'default' : 'outline'}
            size="sm"
          >
            {option}
          </Button>
        ))}

        {multiple && hasSelection && onClear && (
          <Button onClick={onClear} variant="destructive" size="sm">
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {multiple && hasSelection && (
        <span className="text-sm text-gray-600 ml-auto">
          {selectedArray.length} đã chọn
        </span>
      )}
    </div>
  )
}

/**
 * FilterSection Component
 * 
 * Container for multiple FilterBar components with consistent styling.
 * 
 * @example
 * ```tsx
 * <FilterSection>
 *   <FilterBar label="Khu vực" options={regions} selected={region} onSelect={setRegion} />
 *   <FilterBar label="Chương trình" options={programs} selected={programs} onSelect={setPrograms} multiple />
 * </FilterSection>
 * ```
 */
interface FilterSectionProps {
  children: React.ReactNode
  className?: string
}

export function FilterSection({ children, className }: FilterSectionProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 p-4 space-y-4',
        className
      )}
    >
      {children}
    </div>
  )
}
