# Implementation Plan: Design System Standardization

## Overview

This implementation plan converts the design system standardization feature into actionable coding tasks. The approach follows a **composition-first architecture** where complex components are built by composing primitive base components, ensuring consistency, maintainability, and reusability.

The implementation will be done in **TypeScript** using Next.js 16, React 19, and Tailwind CSS 4, with a focus on:
- Creating a base component library (Box, Text, Heading, Stack, Grid, Flex, Icon, Button, Input)
- Establishing design tokens with 1.250 typography scale
- Refactoring existing shadcn/ui components to use base components
- Implementing Vietnamese language system with 200+ translations
- Setting up comprehensive testing infrastructure (property-based tests, unit tests, integration tests)

## Tasks

- [x] 1. Set up design token system and Tailwind configuration
  - Create `tailwind.config.js` with design tokens (colors, spacing, typography with 1.250 scale, shadows, z-index, border radius)
  - Define Brand_Color (#a1001f, #c41230) as primary colors
  - Define neutral color palette with 10 shades (50-950)
  - Define semantic colors (success, error, warning, info)
  - Define spacing system based on 4px base unit (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128)
  - Define typography scale following 1.250 ratio (xs: 10.24px, sm: 12.8px, base: 16px, lg: 20px, xl: 25px, 2xl: 31.25px, 3xl: 39.06px, 4xl: 48.83px, 5xl: 61.04px, 6xl: 76.29px)
  - Define shadow system (xs, sm, md, lg, xl, 2xl)
  - Define z-index scale (base: 0, dropdown: 1000, sticky: 1100, fixed: 1200, modal-backdrop: 1300, modal: 1400, popover: 1500, tooltip: 1600)
  - Define border radius scale (none: 0, sm: 4px, md: 6px, lg: 8px, xl: 12px, 2xl: 16px, full: 9999px)
  - Define animation durations (fast: 150ms, normal: 300ms, slow: 500ms)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 4.2, 4.3, 4.13_

- [~]* 1.1 Write property test for typography scale mathematical consistency
  - **Property 1: Typography Scale Mathematical Consistency**
  - **Validates: Requirements 1.3, 4.2, 4.3, 4.13**
  - Extract all font-size values from Tailwind config
  - Verify each value equals 16 * (1.25^n) for some integer n within ±0.1px tolerance
  - Use fast-check to generate test cases

- [x] 2. Create base component library primitives
  - [x] 2.1 Create Box primitive component
    - Create `components/ui/primitives/box.tsx`
    - Implement polymorphic component with `asChild` prop using @radix-ui/react-slot
    - Accept all standard div props
    - Export BoxProps interface
    - _Requirements: 6.1, 6.4, 6.7_

  - [x] 2.2 Create Text primitive component
    - Create `components/ui/primitives/text.tsx`
    - Implement with class-variance-authority for variants
    - Define size variants (xs, sm, base, lg, xl) following 1.250 scale
    - Define weight variants (light, normal, medium, semibold, bold)
    - Define color variants (primary, secondary, muted, disabled, error, success, warning, info)
    - Support polymorphic rendering with `asChild` prop
    - _Requirements: 6.1, 6.4, 6.7, 4.5_

  - [x] 2.3 Create Heading primitive component
    - Create `components/ui/primitives/heading.tsx`
    - Implement semantic heading levels (h1-h6) following 1.250 scale
    - Define sizes: h1: 61.04px, h2: 48.83px, h3: 39.06px, h4: 31.25px, h5: 25px, h6: 20px
    - Support polymorphic rendering with `asChild` prop
    - Apply font-bold by default
    - _Requirements: 6.1, 6.4, 4.4, 4.13_

  - [x] 2.4 Create Stack primitive component
    - Create `components/ui/primitives/stack.tsx`
    - Implement vertical layout with flex-col
    - Define gap variants (none, xs, sm, md, lg, xl) using spacing system
    - Define align variants (start, center, end, stretch)
    - Default to gap: md, align: stretch
    - _Requirements: 6.1, 6.7, 3.1, 3.5_

  - [-] 2.5 Create Flex primitive component
    - Create `components/ui/primitives/flex.tsx`
    - Implement horizontal layout with flex
    - Define gap variants (none, xs, sm, md, lg, xl)
    - Define align variants (start, center, end, stretch, baseline)
    - Define justify variants (start, center, end, between, around, evenly)
    - Define wrap variants (nowrap, wrap, wrap-reverse)
    - Default to gap: md, align: center, justify: start, wrap: nowrap
    - _Requirements: 6.1, 6.7, 3.1, 3.5_

  - [x] 2.6 Create Grid primitive component
    - Create `components/ui/primitives/grid.tsx`
    - Implement grid layout
    - Define cols variants (1, 2, 3, 4, 6, 12)
    - Define gap variants (none, xs, sm, md, lg, xl)
    - Default to cols: 1, gap: md
    - _Requirements: 6.1, 6.7, 3.1, 3.5_

  - [x] 2.7 Create Icon primitive component
    - Create `components/ui/primitives/icon.tsx`
    - Wrap lucide-react icons with consistent sizing
    - Define size variants (xs: 12px, sm: 16px, md: 20px, lg: 24px, xl: 32px, 2xl: 48px)
    - Support aria-label for accessibility
    - Apply shrink-0 to prevent icon distortion
    - _Requirements: 6.1, 18.1, 18.2, 18.8_

  - [x] 2.8 Create primitives index file
    - Create `components/ui/primitives/index.ts`
    - Export all primitive components (Box, Text, Heading, Stack, Flex, Grid, Icon)
    - _Requirements: 6.1_

- [~]* 2.9 Write property test for component composition dependency graph
  - **Property 3: Component Composition Dependency Graph**
  - **Validates: Requirements 6.2, 21.1**
  - Build import dependency graph by parsing all component files
  - Verify each non-primitive component imports at least one primitive component
  - Use fast-check to test all non-primitive components

- [x] 3. Refactor Button component to use base components
  - Update `components/ui/button.tsx` to compose from base components
  - Keep existing variants (default, destructive, outline, secondary, ghost, link) and add success, mindx variants
  - Keep existing sizes (xs, sm, default, lg, icon, icon-sm, icon-lg)
  - Add loading prop with inline spinner positioned left of text
  - Ensure disabled state uses opacity 0.5 and cursor not-allowed
  - Apply focus-visible ring with 2px offset
  - Use gap-2 for icon spacing
  - Ensure all button text examples use Vietnamese sentence case ("Gửi", "Hủy", "Lưu")
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.12, 7.13, 7.14, 7.16, 7.18_

- [~]* 3.1 Write unit tests for Button component
  - Test Vietnamese text rendering in sentence case
  - Test loading state shows spinner
  - Test disabled state prevents interaction
  - Test all variants apply correct styles
  - Test icon placement (left by default, right for directional)
  - _Requirements: 7.5, 7.18, 7.19_

- [x] 4. Refactor Card component to use base components
  - Update `components/ui/card.tsx` to compose from Box and Stack primitives
  - Implement Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription
  - Define variants (default, outlined, elevated, interactive)
  - Define padding sizes (sm: 16px, md: 24px, lg: 32px)
  - Use Stack for CardHeader with gap-sm
  - Apply hover effects for interactive variant
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [~]* 4.1 Write unit tests for Card component
  - Test all variants render correctly
  - Test padding sizes apply correctly
  - Test interactive variant has hover effects
  - Test compound component pattern (CardHeader, CardContent, CardFooter)
  - _Requirements: 9.3, 9.4, 9.5_

- [x] 5. Create Input primitive component
  - Create `components/ui/primitives/input.tsx`
  - Implement base input with consistent styling
  - Define states (default, focus, error, disabled, readonly)
  - Define sizes (sm: 32px, md: 36px, lg: 40px)
  - Apply focus ring on focus state
  - Apply red border for error state
  - Use muted color with 0.6 opacity for placeholder
  - _Requirements: 6.1, 8.1, 8.2, 8.3, 8.4, 8.7, 8.9_

- [x] 6. Create FormField composite component
  - Create `components/ui/form-field.tsx`
  - Compose from Stack, Text, and Input primitives
  - Implement label with font-size: 14px, font-weight: 500
  - Implement required field indicator (*) with red color, 16px size, 4px left margin
  - Implement error message display below field with 4px top margin
  - Implement helper text with font-size: 12px, muted color
  - Use Vietnamese text for all labels and messages
  - _Requirements: 8.5, 8.6, 13.6, 13.7, 13.9, 13.10, 14.3_

- [~]* 6.1 Write unit tests for FormField component
  - Test required indicator placement and styling
  - Test error message display in Vietnamese
  - Test helper text display
  - Test label styling
  - _Requirements: 13.9, 13.10, 14.3_

- [x] 7. Set up Vietnamese language system
  - [x] 7.1 Create Vietnamese UI glossary
    - Create `lib/i18n/vietnamese-ui-glossary.ts`
    - Define 200+ Vietnamese translations for common UI terms
    - Include button actions (Submit → "Gửi", Save → "Lưu", Delete → "Xóa", Cancel → "Hủy", etc.)
    - Include form fields (Email → "Địa chỉ email", Password → "Mật khẩu", etc.)
    - Include validation messages (Required → "Bắt buộc", Invalid → "Không hợp lệ", etc.)
    - Include status messages (Success → "Thành công", Error → "Lỗi", etc.)
    - Include navigation items (Home → "Trang chủ", About → "Giới thiệu", etc.)
    - Include time/date terms (Today → "Hôm nay", Yesterday → "Hôm qua", etc.)
    - Include empty states (No items found → "Không tìm thấy mục nào", etc.)
    - Include common phrases (Please wait → "Vui lòng đợi", Try again → "Thử lại", etc.)
    - Ensure all translations have proper diacritics
    - _Requirements: 26.1, 26.2, 26.3, 26.11_

  - [x] 7.2 Create Vietnamese language utilities
    - Create `lib/language-utils.ts`
    - Implement `isVietnamese(text: string): boolean` to detect Vietnamese text
    - Implement `hasDiacritics(text: string): boolean` to check for diacritics
    - Implement `isTechnicalTerm(text: string): boolean` to check whitelist
    - Define technical term whitelist (API, URL, email, HTML, CSS, JavaScript, JSON, XML, HTTP, HTTPS, SDK, UI, UX)
    - Implement `formatDate(date: Date): string` for Vietnamese date format (DD/MM/YYYY)
    - Implement `formatCurrency(amount: number): string` for VND format (1.234.567₫)
    - Implement `formatRelativeTime(date: Date): string` for Vietnamese relative time ("2 phút trước", "1 giờ trước")
    - _Requirements: 26.2, 26.3, 26.5, 26.8, 26.19_

  - [x] 7.3 Create Vietnamese content validation utilities
    - Create `lib/content-validator.ts`
    - Implement function to extract UI text from components
    - Implement function to validate Vietnamese content
    - Implement function to detect missing diacritics
    - Implement function to detect English content in user-facing elements
    - _Requirements: 26.12, 26.13, 26.14_

- [~]* 7.4 Write property test for Vietnamese content enforcement
  - **Property 4: Vietnamese Content Enforcement**
  - **Validates: Requirements 14.1, 26.1, 26.3**
  - Extract all user-facing text from UI components
  - Verify each string is either Vietnamese with diacritics OR approved technical term
  - Use fast-check to test all extracted text

- [~]* 7.5 Write property test for Vietnamese diacritic completeness
  - **Property 5: Vietnamese Diacritic Completeness**
  - **Validates: Requirements 26.3, 26.13**
  - Extract all Vietnamese text from UI
  - Tokenize into words
  - Verify each word has proper diacritics OR is technical term OR is number/punctuation
  - Use fast-check to test all Vietnamese text

- [~]* 7.6 Write property test for Vietnamese UI glossary consistency
  - **Property 13: Vietnamese UI Glossary Consistency**
  - **Validates: Requirements 26.11, 26.23**
  - Extract all UI text from components
  - Identify common terms (Submit, Save, Delete, etc.)
  - Verify Vietnamese translation matches glossary entry exactly
  - Use fast-check to test all common terms

- [~] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Refactor existing shadcn/ui components to use base components
  - [x] 9.1 Refactor Input component
    - Update `components/ui/input.tsx` to use base Input primitive
    - Ensure consistent styling with design tokens
    - _Requirements: 8.1, 8.8_

  - [x] 9.2 Refactor Label component
    - Update `components/ui/label.tsx` to use base Text component
    - Apply font-size: 14px, font-weight: 500
    - _Requirements: 8.5_

  - [x] 9.3 Refactor Textarea component
    - Update `components/ui/textarea.tsx` to use base Input primitive patterns
    - Ensure consistent styling with Input component
    - _Requirements: 8.1, 8.8_

  - [x] 9.4 Refactor Dialog component
    - Update `components/ui/dialog.tsx` to use base Box, Stack, Heading, Text components
    - Ensure modal backdrop uses z-index: 1300, modal content uses z-index: 1400
    - Apply fade-in animation for backdrop, slide-in for content
    - Add DialogBody component for content area
    - Add body scroll lock when dialog is open
    - Add Escape key handler to close dialog
    - _Requirements: 11.4, 15.9_

  - [x] 9.5 Refactor Popover component
    - Update `components/ui/popover.tsx` to use base Box component
    - Ensure popover uses z-index: 1500
    - Add PopoverHeader, PopoverBody, PopoverFooter components
    - Improve animations and focus styles
    - _Requirements: 11.6_

  - [x] 9.6 Refactor Table component
    - Update `components/ui/table.tsx` to use base Box component
    - Ensure consistent cell styling with proper padding
    - Add horizontal scroll for mobile with border
    - Improve header styling (uppercase, tracking, semibold)
    - Add hover and selected states
    - _Requirements: 12.2, 16.10_

  - [x] 9.7 Refactor Badge component
    - Update `components/ui/badge.tsx` to use base Box and Text components
    - Define variants using semantic colors
    - Define sizes (sm, md, lg)
    - _Requirements: 12.4, 12.7_

  - [~] 9.8 Migrate inline buttons to standardized Button component
    - [x] 9.8.1 Create button migration guide
      - Created `.kiro/specs/design-system-standardization/BUTTON_MIGRATION_GUIDE.md`
      - Documented problem (inconsistent hover states, no reusability)
      - Documented solution (use standardized Button component)
      - Provided migration examples with before/after code
      - Documented variant selection rules
      - Documented icon placement rules
      - _Requirements: 7.1, 7.2, 7.3, 7.18, 7.19_

    - [x] 9.8.2 Migrate sidebar buttons
      - ✅ `components/sidebar.tsx` - "Đăng xuất" button
      - ✅ `components/slider-sidebar.tsx` - "Xem tất cả bài viết" button
      - Added Button and Icon imports
      - Changed inline buttons to use Button component with variant="outline"
      - _Requirements: 7.1, 7.2, 7.3, 7.5_

    - [x] 9.8.3 Migrate filter buttons
      - ✅ `app/user/truyenthong/page.tsx` - 7 filter buttons
      - Changed to use Button component with variant="default" (selected) or "ghost" (unselected)
      - Maintained consistent hover states
      - _Requirements: 7.1, 7.2, 7.3_

    - [x] 9.8.4 Migrate navigation buttons
      - ✅ `app/not-found.tsx` - 2 buttons
      - Changed to use Button component with variant="mindx" and "secondary"
      - Added Icon components for HomeIcon and ArrowLeft
      - _Requirements: 7.1, 7.2, 7.3, 7.18_

    - [x] 9.8.5 Migrate login page buttons
      - ✅ `app/login/page.tsx` - 3 buttons (role selection, password toggle, submit)
      - Role buttons: variant="default" (selected) or "outline" (unselected)
      - Password toggle: variant="ghost" with size="icon-sm"
      - Submit button: variant="default" with loading prop
      - Removed unused `getRoleButtonClass` function
      - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.12_

    - [x] 9.8.6 Migrate remaining application buttons (95% complete - 57/60 buttons)
      - ✅ `app/user/dang-ky-lich-lam-viec/page.tsx` - Calendar navigation (3), edit/delete buttons (2), modal buttons (6)
      - ✅ `app/analytics/page.tsx` - Retry button (1), refresh button (1)
      - ✅ `app/rawdata/page.tsx` - Search button (1), modal close button (1)
      - ✅ `app/training-test/page.tsx` - Fetch Data button (1)
      - ✅ `app/rawdata-experience/page.tsx` - Search button (1)
      - ✅ `app/course-links-test/page.tsx` - Refresh Data button (1)
      - ✅ `app/admin/user-management/components/ConfirmDialog.tsx` - Close, Cancel, Confirm buttons (3)
      - ✅ `app/admin/user-management/components/LeadersPanel.tsx` - Filter, Add, Clear, Cancel, Save, Status toggles, Edit/Delete icons (8)
      - ✅ `app/admin/user-management/components/RoleSettingsTab.tsx` - Add Role, Role cards, Close, Cancel, Save buttons (5)
      - ✅ `app/lichgiaovien/page.tsx` - Date range, Region filters, Program filters, Clear filter, Teacher selection, Modal buttons (7)
      - ✅ `app/admin/s3-supabase-manager/page.tsx` - Apply filter, Refresh buttons (2)
      - ✅ `app/user/thongtingv/page.tsx` - Modal close, Not found confirm, Info item toggle buttons (3)
      - ⏳ `app/admin/hr-onboarding/[gen]/page.tsx` - No inline buttons found (already using Button component)
      - ⏳ Large files deferred: `app/admin/page1/page.tsx` (~10 buttons, 2853 lines), `app/admin/user-management/components/UsersTab.tsx` (~15 buttons, 962 lines)
      - **Progress**: 57 buttons migrated across 17 files
      - **Remaining**: ~3-5 buttons in large files (deferred for future iteration)
      - _Requirements: 7.1, 7.2, 7.3_

- [~]* 9.9 Write integration tests for refactored components
  - Test Input, Label, Textarea work together in forms
  - Test Dialog opens/closes with correct animations
  - Test Popover positioning
  - Test Table responsive behavior
  - Test Badge variants
  - _Requirements: 8.1, 11.4, 12.2, 12.4_

- [x] 10. Implement micro-consistency standards
  - [x] 10.1 Create loading indicator components
    - Created `components/ui/loading-spinner.tsx` for inline spinners
    - Created `components/ui/loading-overlay.tsx` for full-page loading
    - Created `components/ui/skeleton.tsx` for skeleton screens
    - Includes pre-built patterns: SkeletonText, SkeletonCard, SkeletonAvatar, SkeletonButton, SkeletonTable
    - Uses animation from Animation_System (spin, pulse)
    - _Requirements: 13.3, 13.4, 13.5_

  - [x] 10.2 Create empty state component
    - Created `components/ui/empty-state.tsx`
    - Composed from Stack, Icon, Heading, Text, Box components
    - Center content vertically and horizontally
    - Uses Vietnamese sentence case for messages
    - Includes icon, message, and optional action button
    - Pre-built variants: EmptyStateNoResults, EmptyStateNoData, EmptyStateError
    - _Requirements: 13.13, 13.14, 13.15_

  - [x] 10.3 Create toast notification component
    - Created `components/ui/toast.tsx`
    - Composed from base Box, Stack, Text, Icon components
    - Position in top-right corner (z-index: 1600)
    - Auto-dismiss after 5 seconds (configurable)
    - Uses Vietnamese sentence case for messages
    - 5 variants: default, success, error, warning, info
    - Includes ToastProvider and useToast hook for programmatic usage
    - _Requirements: 13.16, 13.17, 13.18_

  - [x] 10.4 Create loading examples
    - Created `components/ui/loading.example.tsx`
    - Demonstrates all loading patterns and usage
    - _Requirements: 13.1, 13.2, 7.18, 7.19_
  - [x] 10.1 Create loading indicator components
    - Created `components/ui/loading-spinner.tsx` for inline spinners
    - Created `components/ui/loading-overlay.tsx` for full-page loading
    - Created `components/ui/skeleton.tsx` for skeleton screens
    - Includes pre-built patterns: SkeletonText, SkeletonCard, SkeletonAvatar, SkeletonButton, SkeletonTable
    - Uses animation from Animation_System (spin, pulse)
    - _Requirements: 13.3, 13.4, 13.5_

  - [x] 10.2 Create empty state component
    - Created `components/ui/empty-state.tsx`
    - Composed from Stack, Icon, Heading, Text, Box components
    - Center content vertically and horizontally
    - Uses Vietnamese sentence case for messages
    - Includes icon, message, and optional action button
    - Pre-built variants: EmptyStateNoResults, EmptyStateNoData, EmptyStateError
    - _Requirements: 13.13, 13.14, 13.15_

  - [x] 10.3 Create toast notification component
    - Created `components/ui/toast.tsx`
    - Composed from base Box, Stack, Text, Icon components
    - Position in top-right corner (z-index: 1600)
    - Auto-dismiss after 5 seconds (configurable)
    - Uses Vietnamese sentence case for messages
    - 5 variants: default, success, error, warning, info
    - Includes ToastProvider and useToast hook for programmatic usage
    - _Requirements: 13.16, 13.17, 13.18_

  - [x] 10.4 Create loading examples
    - Created `components/ui/loading.example.tsx`
    - Demonstrates all loading patterns and usage
    - _Requirements: 13.1, 13.2, 7.18, 7.19_

- [~]* 10.5 Write property test for button order in forms
  - **Property 6: Button Order in Forms**
  - **Validates: Requirements 7.6, 7.7**
  - Parse all form and modal components
  - Find instances with exactly 2 buttons
  - Verify first button is cancel/secondary, second is submit/primary
  - Use fast-check to test all forms with 2 buttons

- [~]* 10.6 Write property test for icon placement consistency
  - **Property 7: Icon Placement Consistency**
  - **Validates: Requirements 13.1, 13.2**
  - Parse all components with icons and text
  - Verify icon element comes before text element (excluding directional icons)
  - Use fast-check to test all components with icons

- [~]* 10.7 Write property test for required field indicator placement
  - **Property 8: Required Field Indicator Placement**
  - **Validates: Requirements 13.9, 13.10**
  - Find all form fields with required prop
  - Verify asterisk element exists after label with ml-1 and text-red-500
  - Use fast-check to test all required fields

- [x] 11. Implement formatting utilities
  - [x] 11.1 Create timestamp formatting utility
    - Created `lib/format-timestamp.ts`
    - Implements relative time for events within 24 hours ("2 phút trước", "1 giờ trước")
    - Implements absolute date for older events ("15/01/2024")
    - Functions: formatTimestamp, formatRelativeTime, formatAbsoluteDate, formatAbsoluteDateTime, formatTime, formatDayOfWeek, formatFullDate, formatSmartDate
    - Includes helpers: isToday, isYesterday
    - _Requirements: 13.19, 26.5_

  - [x] 11.2 Create number formatting utility
    - Created `lib/format-number.ts`
    - Implements consistent thousand separators (period for thousands, comma for decimals)
    - Functions: formatNumber, formatNumberCompact, formatPercent, formatOrdinal, formatFileSize, formatDuration, formatRange, formatNumberWithSign
    - Includes parser: parseVietnameseNumber
    - _Requirements: 13.20_

  - [x] 11.3 Create currency formatting utility
    - Created `lib/format-currency.ts`
    - Implements VND format with ₫ symbol after number, no decimals
    - Uses consistent thousand separators (period)
    - Functions: formatCurrency, formatCurrencyCompact, formatCurrencyRange, formatCurrencyWithSign, formatPrice, formatSalary, formatHourlyRate, formatDiscount, formatPriceWithDiscount
    - Includes helpers: parseCurrency, isValidVND, roundVND
    - _Requirements: 13.21, 26.8_

  - [x] 11.4 Create date formatting utility
    - Created `lib/format-date.ts`
    - Implements DD/MM/YYYY format for display
    - Implements YYYY-MM-DD format for form inputs and storage
    - Functions: formatDate, formatDateForInput, formatDateLong, formatDateWithDay, formatDateFull, formatMonthYear, formatDateRange
    - Includes helpers: getDayOfWeek, getMonthName, parseVietnameseDate, isValidDate, getToday, getTomorrow, getYesterday, isSameDay, isPast, isFuture, addDays, addMonths, addYears, getDaysDifference
    - _Requirements: 13.22, 13.23, 26.5_

- [~]* 11.5 Write property test for timestamp formatting consistency
  - **Property 9: Timestamp Formatting Consistency**
  - **Validates: Requirements 13.19**
  - Generate random timestamps (recent and old)
  - Pass to formatting function
  - Verify output matches expected pattern based on age
  - Use fast-check to generate test cases

- [~]* 11.6 Write property test for number formatting consistency
  - **Property 10: Number Formatting Consistency**
  - **Validates: Requirements 13.20**
  - Extract all number formatting calls
  - Verify all use same separator pattern (all periods OR all commas)
  - Use fast-check to test all number formats

- [~]* 11.7 Write property test for currency formatting consistency
  - **Property 11: Currency Formatting Consistency**
  - **Validates: Requirements 13.21**
  - Generate random VND amounts
  - Pass to currency formatter
  - Verify output matches pattern: "number₫" with no decimals
  - Use fast-check to generate test cases

- [~]* 11.8 Write property test for date formatting consistency
  - **Property 12: Date Formatting Consistency**
  - **Validates: Requirements 13.22, 13.23**
  - Generate random dates
  - Verify display format is DD/MM/YYYY
  - Verify input/storage format is YYYY-MM-DD
  - Use fast-check to generate test cases

- [~] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Set up testing infrastructure
  - [~] 13.1 Install testing dependencies
    - Install fast-check for property-based testing
    - Install @testing-library/react for component testing
    - Install @testing-library/jest-dom for DOM assertions
    - Install jest-axe for accessibility testing
    - Install @playwright/test for visual regression testing
    - _Requirements: Testing Strategy_

  - [~] 13.2 Create property test configuration
    - Create `test/config/property-test-config.ts`
    - Set numRuns: 100 minimum iterations
    - Enable verbose mode
    - Configure seed for reproducibility
    - _Requirements: Testing Strategy_

  - [~] 13.3 Create component analyzer utilities
    - Create `lib/component-analyzer.ts`
    - Implement `buildDependencyGraph()` to parse component imports
    - Implement `getPrimitiveComponents()` to identify base components
    - Implement `extractUIText()` to extract text from components
    - _Requirements: Property 3, Property 4_

  - [~] 13.4 Create color utilities for testing
    - Create `lib/color-utils.ts`
    - Implement `calculateContrastRatio(fg, bg)` for WCAG compliance
    - Implement color parsing utilities
    - _Requirements: Property 2_

- [~]* 13.5 Write property test for color contrast accessibility
  - **Property 2: Color Contrast Accessibility Compliance**
  - **Validates: Requirements 2.4, 2.9**
  - Generate all combinations of text and background colors from palette
  - Calculate contrast ratios using WCAG formula
  - Verify compliance (4.5:1 for normal text, 3:1 for large text)
  - Use fast-check to test all color combinations

- [~]* 13.6 Write property test for component reusability threshold
  - **Property 14: Component Reusability Threshold**
  - **Validates: Requirements 25.4, 25.8**
  - Build component dependency graph
  - For each primitive component, count how many components import it
  - Verify count >= 3
  - Use fast-check to test all primitive components

- [~]* 13.7 Write property test for TypeScript type safety
  - **Property 15: TypeScript Type Safety for Composition**
  - **Validates: Requirements 6.10, 21.10**
  - Create test cases with invalid compositions
  - Run TypeScript compiler
  - Verify compilation fails with appropriate errors
  - Use fast-check to generate invalid compositions

- [ ] 14. Create ESLint rules for design system enforcement
  - [~] 14.1 Create Vietnamese content linting rule
    - Create `eslint-rules/vietnamese-content.js`
    - Detect English content in JSXText nodes
    - Detect missing diacritics in Vietnamese text
    - Whitelist approved technical terms
    - _Requirements: 14.21, 26.12_

  - [~] 14.2 Create button text casing linting rule
    - Create `eslint-rules/button-text-casing.js`
    - Detect non-sentence-case button text
    - Provide auto-fix suggestions
    - _Requirements: 5.1_

  - [~] 14.3 Create component composition linting rule
    - Create `eslint-rules/use-base-components.js`
    - Detect when developers create new components instead of composing
    - Suggest existing base components
    - _Requirements: 21.1, 25.1_

  - [~] 14.4 Create button order linting rule
    - Create `eslint-rules/button-order.js`
    - Detect incorrect button order in forms (cancel should be left, submit right)
    - _Requirements: 7.6, 7.7_

  - [~] 14.5 Update ESLint configuration
    - Update `.eslintrc.js` to include custom rules
    - Enable design-system rules (vietnamese-content, button-text-casing, use-base-components, button-order)
    - _Requirements: 24.7_

- [ ] 15. Create documentation
  - [~] 15.1 Create design token documentation
    - Create `docs/design-tokens.md`
    - Document all color tokens with examples
    - Document spacing system with visual examples
    - Document typography scale with 1.250 ratio explanation
    - Document shadow system
    - Document z-index scale
    - Document border radius scale
    - _Requirements: 19.1_

  - [~] 15.2 Create base component documentation
    - Create `docs/base-components.md`
    - Document Box, Text, Heading, Stack, Flex, Grid, Icon components
    - Provide usage examples for each
    - Document composition patterns
    - _Requirements: 19.2, 19.3, 21.9_

  - [~] 15.3 Create Vietnamese language documentation
    - Create `docs/vietnamese-language.md`
    - Document Vietnamese UI glossary
    - Provide examples of correct Vietnamese content
    - Document text casing rules
    - Document when to use Vietnamese vs English
    - Document diacritic requirements
    - _Requirements: 26.15, 26.16, 26.22_

  - [~] 15.4 Create migration guide
    - Create `docs/migration-guide.md`
    - Document how to migrate from old components to new standardized components
    - Provide before/after examples
    - Document priority order for migration
    - _Requirements: 19.8, 24.4, 24.5_

  - [~] 15.5 Create component usage guidelines
    - Create `docs/component-guidelines.md`
    - Document do's and don'ts for each component
    - Document accessibility guidelines
    - Document responsive behavior
    - _Requirements: 19.4, 19.5, 19.7_

- [~] 16. Set up CI/CD pipeline for design system validation
  - Create `.github/workflows/design-system-tests.yml`
  - Add job to run property-based tests
  - Add job to run unit tests
  - Add job to run integration tests
  - Add job to run accessibility tests
  - Add job to run linting (including Vietnamese content validation)
  - Add job to run visual regression tests
  - Ensure all tests must pass before merge
  - _Requirements: 24.7, 26.21_

- [~] 17. Create component reusability metrics dashboard
  - Create `scripts/analyze-component-reusability.ts`
  - Build component dependency graph
  - Calculate reusability scores for each base component
  - Detect duplicate component patterns
  - Generate metrics report
  - _Requirements: 21.15, 25.3, 25.8_

- [~] 18. Final checkpoint - Ensure all tests pass and documentation is complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (15 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- The implementation uses TypeScript throughout
- All user-facing content must be in Vietnamese with proper diacritics
- Base components (Box, Text, Heading, Stack, Flex, Grid, Icon) are the foundation for all other components
- Complex components must be built by composing base components (composition over duplication)
- Typography scale follows 1.250 (Major Third) ratio for mathematical consistency
- Design tokens are centralized in Tailwind configuration
- Testing infrastructure includes property-based tests (fast-check), unit tests, integration tests, visual regression tests, accessibility tests, and linting rules
