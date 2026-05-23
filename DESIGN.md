# MindX Teaching Portal — Design System

> **Single source of truth** for colors, spacing, typography, components, and code conventions.
> Every new page, feature, or fix **must** follow these rules.

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Design Tokens (Constants)](#2-design-tokens-constants)
3. [Component Architecture](#3-component-architecture)
4. [Shared Components — What to Use](#4-shared-components--what-to-use)
5. [Anti-Patterns — What NOT to Do](#5-anti-patterns--what-not-to-do)
6. [Page Layout Standards](#6-page-layout-standards)
7. [File & Import Conventions](#7-file--import-conventions)
8. [Constants & Magic Values](#8-constants--magic-values)
9. [Migration Checklist (Legacy → New)](#9-migration-checklist-legacy--new)
10. [Quick Reference Card](#10-quick-reference-card)

---

## 1. Core Principles

| Principle | Rule |
| --- | --- |
| **Token-first** | Never use inline hex colors, arbitrary pixel values, or hardcoded strings. Use design tokens from `tailwind.config.js` and `globals.css`. |
| **Composition over configuration** | Build UIs by composing small, typed primitives (`Box`, `Stack`, `Flex`, `Text`, `Heading`, `Icon`) rather than adding props to monolithic components. |
| **Shared-first** | Before creating a new component, check `components/ui/`. If it exists there, **use it**. If it doesn't, create it there — not in a page-specific folder. |
| **Constants over literals** | Labels, status maps, option lists, colors, and API paths **must** be defined as named constants in `lib/` or co-located `constants.ts` files. |
| **Accessibility** | WCAG 2.1 AA minimum. All interactive elements need `aria-label`, focus ring, keyboard navigation. |
| **No legacy components** | Components under `components/*.tsx` root (like `Modal.tsx`, `Card.tsx`, `StatusBadge.tsx`) are **deprecated**. Always use `components/ui/` versions. |

---

## 2. Design Tokens (Constants)

### 2.1 Colors

All colors are defined in two places that **must stay in sync**:
- `tailwind.config.js` → Tailwind utility classes
- `app/globals.css` → CSS custom properties under `@theme` and `:root`

#### Brand Colors

| Token | Value | Tailwind Class | Usage |
| --- | --- | --- | --- |
| `mindx-red` | `#a1001f` | `bg-mindx-red`, `text-mindx-red` | Primary brand color |
| `mindx-red-dark` | `#8a0019` | `bg-mindx-red-dark` | Hover / pressed state |
| `mindx-red-light` | `#c41230` | `bg-mindx-red-light` | Accent / gradient end |
| `primary` | `#a1001f` | `bg-primary`, `text-primary` | Alias for brand red |
| `primary-foreground` | `#ffffff` | `text-primary-foreground` | Text on primary |

#### Semantic Colors

| Token | Value | Tailwind Class | Usage |
| --- | --- | --- | --- |
| `success` | `#16a34a` | `bg-success`, `text-success` | Positive outcomes |
| `error` / `destructive` | `#dc2626` | `bg-destructive` | Error states, delete actions |
| `warning` | `#ea580c` | `bg-warning` | Caution states |
| `info` | `#2563eb` | `bg-info` | Informational |

#### UI Surface Colors

| Token | Value | Tailwind Class | Usage |
| --- | --- | --- | --- |
| `background` | `#ffffff` | `bg-background` | Page / app background |
| `foreground` | `#171717` | `text-foreground` | Default text |
| `card` | `#ffffff` | `bg-card` | Card backgrounds |
| `muted` | `#f5f5f5` | `bg-muted` | Subtle backgrounds |
| `muted-foreground` | `#737373` | `text-muted-foreground` | Secondary text |
| `border` | `#e5e5e5` | `border-border` | All borders |
| `ring` | `#a1001f` | `ring-ring` | Focus ring |

> **🚫 NEVER use inline arbitrary colors** like `bg-[#a1001f]`, `text-[#840018]`, `border-[#e5e7eb]`.
> Always use the semantic token: `bg-primary`, `border-border`, etc.

#### Neutral Scale (for when you need gray shades)

Use `neutral-50` through `neutral-950` from the Tailwind config.
For example: `bg-neutral-50`, `text-neutral-700`, `border-neutral-200`.

### 2.2 Spacing

Based on a **4px base unit**. Use Tailwind spacing utilities:

| Token | Value | Example Classes |
| --- | --- | --- |
| `1` | `4px` | `p-1`, `m-1`, `gap-1` |
| `2` | `8px` | `p-2`, `m-2`, `gap-2` |
| `3` | `12px` | `p-3`, `gap-3` |
| `4` | `16px` | `p-4`, `gap-4` |
| `6` | `24px` | `p-6`, `gap-6` |
| `8` | `32px` | `p-8`, `gap-8` |
| `10` | `40px` | `p-10` |
| `12` | `48px` | `p-12` |

> **🚫 NEVER** use arbitrary spacing like `p-[13px]`, `gap-[18px]`.
> Round to the nearest token value.

### 2.3 Typography

**Font Family**: `Exo` (primary), with system fallbacks.

| Token | Size | Line Height | Usage |
| --- | --- | --- | --- |
| `text-xs` | 10.24px | 1.5 | Captions, labels |
| `text-sm` | 12.8px | 1.5 | Secondary text, descriptions |
| `text-base` | 16px | 1.5 | Body text (default) |
| `text-lg` | 20px | 1.5 | Subheadings |
| `text-xl` | 25px | 1.5 | Section titles |
| `text-2xl` | 31.25px | 1.25 | Page titles |
| `text-3xl` | 39.06px | 1.25 | Hero text |

**Font Weights**: `light` (300), `normal` (400), `medium` (500), `semibold` (600), `bold` (700)

### 2.4 Border Radius

| Token | Value | Usage |
| --- | --- | --- |
| `rounded-sm` | 4px | Small elements (tags, badges) |
| `rounded` / `rounded-md` | 6px | Default (inputs, small cards) |
| `rounded-lg` | 8px | Buttons, medium cards |
| `rounded-xl` | 12px | Cards, modals |
| `rounded-2xl` | 16px | Large panels, hero sections |
| `rounded-full` | 9999px | Avatars, pills |

### 2.5 Shadows (Elevation)

| Token | Usage |
| --- | --- |
| `shadow-xs` | Subtle depth (tags) |
| `shadow-sm` | Default cards |
| `shadow-md` | Elevated cards |
| `shadow-lg` | Dropdowns, popovers |
| `shadow-xl` | Modals, dialogs |
| `shadow-2xl` | Floating panels |

### 2.6 Z-Index Scale

Named layers — **never use arbitrary z-index values**:

| Token | Value | Usage |
| --- | --- | --- |
| `z-base` | 0 | Default content |
| `z-dropdown` | 1000 | Dropdowns, selects |
| `z-sticky` | 1100 | Sticky headers |
| `z-fixed` | 1200 | Fixed elements |
| `z-modal-backdrop` | 1300 | Modal backdrop |
| `z-modal` | 1400 | Modal content |
| `z-popover` | 1500 | Popovers |
| `z-tooltip` | 1600 | Tooltips, toasts |

> See `app/z-index.css` for CSS class definitions.

### 2.7 Animation

| Token | Duration | Usage |
| --- | --- | --- |
| `duration-fast` | 150ms | Hover, toggle |
| `duration-normal` | 300ms | Enter/exit animations |
| `duration-slow` | 500ms | Page transitions |

Pre-built animations: `animate-fade-in`, `animate-slide-in`, `animate-scale-in`, `animate-spin`, `animate-pulse`, `animate-bounce`

### 2.8 Breakpoints

| Name | Min Width | Usage |
| --- | --- | --- |
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Wide screens |

---

## 3. Component Architecture

```
components/
├── ui/                          ← ✅ DESIGN SYSTEM (shared, reusable)
│   ├── primitives/              ← Foundation layer (Box, Stack, Flex, Grid, Text, Heading, Icon, Input)
│   │   ├── box.tsx
│   │   ├── stack.tsx
│   │   ├── flex.tsx
│   │   ├── grid.tsx
│   │   ├── text.tsx
│   │   ├── heading.tsx
│   │   ├── icon.tsx
│   │   ├── input.tsx
│   │   └── index.ts             ← Barrel export
│   │
│   ├── button.tsx               ← Composed from primitives
│   ├── badge.tsx
│   ├── card.tsx
│   ├── modal.tsx
│   ├── dialog.tsx
│   ├── table.tsx
│   ├── toast.tsx
│   ├── loading-spinner.tsx
│   ├── loading-overlay.tsx
│   ├── empty-state.tsx
│   ├── stat-card.tsx
│   ├── filter-bar.tsx
│   ├── form-field.tsx
│   ├── page-layout.tsx
│   ├── stepper.tsx
│   ├── skeleton.tsx
│   ├── info-card.tsx
│   ├── input.tsx
│   ├── textarea.tsx
│   ├── label.tsx
│   ├── popover.tsx
│   └── calender.tsx
│
├── admin/                       ← Page-specific (admin pages only)
├── user/                        ← Page-specific (user pages only)
├── feedback/                    ← Feature module
├── leave-request/               ← Feature module
├── k12-docs/                    ← Feature module
├── onboarding/                  ← Feature module
├── system-metrics/              ← Feature module
├── skeletons/                   ← Loading skeletons
│
├── AppLayout.tsx                ← App shell layout
├── sidebar.tsx                  ← Navigation sidebar
├── index.ts                     ← Legacy barrel exports
│
│── ⚠️ DEPRECATED (do NOT use)
├── Modal.tsx                    → Use components/ui/modal.tsx
├── Card.tsx                     → Use components/ui/card.tsx
├── StatusBadge.tsx              → Use components/ui/badge.tsx
├── EmptyState.tsx               → Use components/ui/empty-state.tsx
├── LoadingSpinner.tsx           → Use components/ui/loading-spinner.tsx
├── StatCard.tsx                 → Use components/ui/stat-card.tsx
├── SearchBar.tsx                → Build with Input primitive
├── Tabs.tsx                     → (evaluate if UI version needed)
└── PageContainer.tsx            → Use components/ui/page-layout.tsx
```

### Layer Rules

| Layer | Path | Rule |
| --- | --- | --- |
| **Primitives** | `components/ui/primitives/` | Zero business logic. Pure layout/styling. Compose all other components from these. |
| **UI Components** | `components/ui/` | Reusable UI patterns (button, card, modal). Built by composing primitives + `cva` for variants. |
| **Feature Components** | `components/{feature}/` | Feature-specific components. Import from `ui/` — never redefine button/card/modal. |
| **Page Components** | `app/{route}/components/` | Page-specific components. Import from `ui/` and feature modules. |

---

## 4. Shared Components — What to Use

### 4.1 Primitives (Always import from `@/components/ui/primitives`)

```tsx
import { Box, Stack, Flex, Grid, Text, Heading, Icon, Input } from '@/components/ui/primitives'
```

| Primitive | Purpose | Key Props |
| --- | --- | --- |
| `Box` | Generic container (`div`) | Standard div props |
| `Stack` | Vertical stack with gap | `gap: 'xs'│'sm'│'md'│'lg'│'xl'`, `align` |
| `Flex` | Flexbox container | `direction`, `align`, `justify`, `gap`, `wrap` |
| `Grid` | CSS Grid container | `cols`, `gap`, `colsResponsive` |
| `Text` | Body text (`p`/`span`) | `size`, `weight`, `color: 'default'│'muted'│'error'`, `as` |
| `Heading` | Section headings | `level: 'h1'│'h2'│'h3'│'h4'` |
| `Icon` | Icon wrapper (lucide-react) | `icon`, `size: 'xs'│'sm'│'md'│'lg'│'xl'` |
| `Input` | Text input field | `variant`, `inputSize` |

### 4.2 UI Components (Import from `@/components/ui/{name}`)

#### Button — `@/components/ui/button`

```tsx
import { Button } from '@/components/ui/button'

// Variants: default | destructive | outline | secondary | ghost | link | success | mindx
// Sizes:    xs | sm | default | lg | xl | icon | icon-sm | icon-lg

<Button variant="default" size="default">Primary Action</Button>
<Button variant="outline" size="sm">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="mindx">Brand CTA</Button>
<Button loading>Saving...</Button>
```

> **🚫 NEVER** create raw `<button>` elements with inline Tailwind classes.
> Always use the `Button` component.

#### Badge — `@/components/ui/badge`

```tsx
import { Badge, StatusBadge } from '@/components/ui/badge'

// Variants: default | success | danger | warning | info | purple | pink | emerald | violet | slate | outline
// Sizes:    xs | sm | md | lg
// Shapes:   rounded | pill

<Badge variant="success">Active</Badge>
<Badge variant="danger" shape="pill">Expired</Badge>
<StatusBadge active={true} activeText="✓ Tính" inactiveText="✗ Không tính" />
```

#### Card — `@/components/ui/card`

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

// Variants: default | outlined | elevated | interactive
// Padding:  none | sm | md | lg

<Card variant="elevated" padding="lg">
  <CardHeader>
    <CardTitle>Section Title</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter><Button>Action</Button></CardFooter>
</Card>
```

#### Modal — `@/components/ui/modal`

```tsx
import { Modal, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from '@/components/ui/modal'

// Sizes: sm | md | lg | xl | 2xl | 3xl | 4xl | 5xl | 6xl | 7xl | full

// Composition API (preferred)
<Modal open={isOpen} onClose={close} size="lg">
  <ModalHeader>
    <ModalTitle>Edit Profile</ModalTitle>
    <ModalClose />
  </ModalHeader>
  <ModalBody>...</ModalBody>
  <ModalFooter>
    <Button variant="outline" onClick={close}>Cancel</Button>
    <Button onClick={save}>Save</Button>
  </ModalFooter>
</Modal>

// Legacy API (backward compatible, avoid in new code)
<Modal open={isOpen} onClose={close} title="Title" footer={<Button>Save</Button>} />
```

#### Dialog — `@/components/ui/dialog`

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm</DialogTitle>
      <DialogDescription>Are you sure?</DialogDescription>
    </DialogHeader>
    <DialogBody>...</DialogBody>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Table — `@/components/ui/table`

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption } from '@/components/ui/table'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Nguyen Van A</TableCell>
      <TableCell>a@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Toast — `@/lib/app-toast`

```tsx
import { toast } from '@/lib/app-toast'

toast.success('Saved successfully')
toast.error('Something went wrong')
toast.info('New update available')
```

#### Loading States

```tsx
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { LoadingOverlay } from '@/components/ui/loading-overlay'

<LoadingSpinner size="md" />
<LoadingSpinner size="sm">Loading data...</LoadingSpinner>
<LoadingOverlay />
```

#### Empty States

```tsx
import { EmptyState, EmptyStateNoResults, EmptyStateNoData, EmptyStateError } from '@/components/ui/empty-state'

<EmptyState icon={Inbox} title="No data" description="Nothing here yet" action={<Button>Create</Button>} />
<EmptyStateNoResults />
```

#### Page Layout

```tsx
import { PageLayout, PageLayoutContent, PageLayoutSection } from '@/components/ui/page-layout'

// maxWidth: full | 7xl | 6xl | 5xl | 4xl | 3xl | 2xl
// background: white | gray | gradient | gradient-blue | none
// padding: none | sm | md | lg | responsive

<PageLayout maxWidth="7xl" background="white" padding="md">
  <PageLayoutContent spacing="lg">
    <PageLayoutSection>Section 1</PageLayoutSection>
    <PageLayoutSection>Section 2</PageLayoutSection>
  </PageLayoutContent>
</PageLayout>
```

#### Stat Card & Grid

```tsx
import { StatCard, StatGrid } from '@/components/ui/stat-card'

<StatGrid cols={4}>
  <StatCard label="Total" value={1234} icon={File} variant="blue" />
  <StatCard label="Active" value={89} icon={Users} variant="success" trend={{ value: 12.5, direction: 'up' }} />
</StatGrid>
```

#### Filter Bar

```tsx
import { FilterBar, FilterSection } from '@/components/ui/filter-bar'

<FilterSection>
  <FilterBar label="Region" options={regions} selected={region} onSelect={setRegion} />
  <FilterBar label="Program" options={programs} selected={selectedPrograms} onSelect={setSelectedPrograms} multiple onClear={() => setSelectedPrograms([])} />
</FilterSection>
```

#### Form Field

```tsx
import { FormField } from '@/components/ui/form-field'

<FormField label="Name" required error="Required field" hint="Enter your full name">
  <Input placeholder="Nguyen Van A" />
</FormField>
```

---

## 5. Anti-Patterns — What NOT to Do

### 🚫 Inline Colors

```tsx
// ❌ BAD — arbitrary hex values
<div className="bg-[#a1001f] text-[#ffffff]">
<div className="border-[#e5e7eb]">
<div className="focus:ring-[#a1001f]/25 focus:border-[#a1001f]">

// ✅ GOOD — semantic tokens
<div className="bg-primary text-primary-foreground">
<div className="border-border">
<div className="focus:ring-ring/25 focus:border-ring">
```

### 🚫 Raw HTML Elements Instead of Components

```tsx
// ❌ BAD — raw button with inline styles
<button className="px-4 py-2.5 text-sm font-semibold text-white bg-linear-to-r from-[#a1001f] to-[#c41230] rounded-xl">
  Save
</button>

// ✅ GOOD — design system Button
<Button variant="mindx">Save</Button>
```

```tsx
// ❌ BAD — raw modal implementation
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
  <div className="bg-white rounded-xl shadow-2xl">...</div>
</div>

// ✅ GOOD — design system Modal
<Modal open={isOpen} onClose={close}>...</Modal>
```

### 🚫 Deprecated Components

```tsx
// ❌ BAD — importing from deprecated root components
import Modal from '@/components/Modal'
import { Card } from '@/components/Card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { StatCard } from '@/components/StatCard'
import { PageContainer } from '@/components/PageContainer'

// ✅ GOOD — importing from ui/
import { Modal } from '@/components/ui/modal'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { StatCard } from '@/components/ui/stat-card'
import { PageLayout } from '@/components/ui/page-layout'
```

### 🚫 Magic Numbers & Strings

```tsx
// ❌ BAD — inline magic values
<div style={{ zIndex: 2000 }}>
<div className="z-[9999]">
<div className="max-w-[1200px]">
if (role === 'admin') { ... }
const timeout = 5000

// ✅ GOOD — use tokens and constants
<div className="z-modal">
<div className="max-w-5xl">
if (role === ROLES.ADMIN) { ... }
const timeout = TOAST_DURATION_MS
```

### 🚫 Duplicating Component Logic

```tsx
// ❌ BAD — re-implementing loading spinner in a page
<div className="animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" />

// ✅ GOOD — use shared component
<LoadingSpinner size="lg" />
```

### 🚫 Inline Style Objects

```tsx
// ❌ BAD — inline styles
<div style={{ backgroundColor: '#a1001f', padding: '16px', borderRadius: '12px' }}>

// ✅ GOOD — Tailwind classes with design tokens
<div className="bg-primary p-4 rounded-xl">
```

---

## 6. Page Layout Standards

### Standard Page Template

Every page should follow this structure:

```tsx
'use client'

import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { Heading } from '@/components/ui/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MyPage() {
  return (
    <PageLayout maxWidth="7xl" padding="responsive">
      <PageLayoutContent spacing="lg">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <Heading level="h1">Page Title</Heading>
          <Button variant="default">Create New</Button>
        </div>

        {/* Filters (if needed) */}
        <FilterSection>
          <FilterBar label="Status" options={statuses} selected={filter} onSelect={setFilter} />
        </FilterSection>

        {/* Stats (if needed) */}
        <StatGrid cols={4}>
          <StatCard label="Total" value={100} icon={File} />
        </StatGrid>

        {/* Main Content */}
        <Card>
          <CardContent>
            {/* Table, form, or other content */}
          </CardContent>
        </Card>
      </PageLayoutContent>
    </PageLayout>
  )
}
```

### Responsive Padding Convention

```tsx
// Standard page padding (use PageLayout with padding="responsive")
// This gives: px-0 py-1.25 → sm:px-[1.5%] → lg:px-[2%] → xl:px-[2.5%]

// Or use fixed padding:
// padding="sm" → p-2 sm:p-3 lg:p-4
// padding="md" → p-4 sm:p-6 lg:p-8 (default)
// padding="lg" → p-6 sm:p-8 lg:p-10
```

---

## 7. File & Import Conventions

### Import Order

```tsx
// 1. React / Next.js
import * as React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party libraries
import { cva, type VariantProps } from 'class-variance-authority'
import { X, ChevronRight } from 'lucide-react'

// 3. Design system primitives
import { Box, Stack, Flex, Text, Heading, Icon } from '@/components/ui/primitives'

// 4. Design system components
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'

// 5. Feature/shared components
import { SomeFeatureComponent } from '@/components/feature-name/SomeComponent'

// 6. Lib / utils / constants
import { cn } from '@/lib/utils'
import { SOME_CONSTANT } from '@/lib/some-constants'

// 7. Types
import type { Teacher } from '@/types/teacher'

// 8. Relative imports (page-specific)
import { LocalComponent } from './components/LocalComponent'
```

### Naming Conventions

| Item | Convention | Example |
| --- | --- | --- |
| UI Components | PascalCase | `Button.tsx`, `StatCard.tsx` |
| Primitives | camelCase filename | `box.tsx`, `stack.tsx` |
| Constants files | kebab-case | `assignment-constants.ts` |
| Feature folders | kebab-case | `leave-request/`, `k12-docs/` |
| Type files | kebab-case | `teacher.ts`, `assignment.ts` |
| Utility files | kebab-case | `format-date.ts`, `format-currency.ts` |

### Barrel Exports

- `components/ui/primitives/index.ts` — exports all primitives
- `components/index.ts` — legacy barrel (do not add new exports here)
- Each `components/ui/*.tsx` is imported directly by path

---

## 8. Constants & Magic Values

### Where to Define Constants

| Type | Location | Example |
| --- | --- | --- |
| **Feature constants** | `lib/{feature}-constants.ts` | `lib/assignment-constants.ts` |
| **Shared constants** | `lib/constants.ts` (create if needed) | Roles, statuses, pagination |
| **API endpoints** | `lib/api-paths.ts` (create if needed) | `/api/teachers`, `/api/assignments` |
| **UI constants** | `lib/ui-constants.ts` (create if needed) | Toast durations, animation delays |
| **Component variants** | Inside component with `cva()` | Button variants, badge variants |
| **Page-specific constants** | `app/{route}/constants.ts` | Tab definitions, column configs |

### Required Constants (define these, never inline)

```ts
// ==========================================
// lib/ui-constants.ts — UI behavior constants
// ==========================================
export const TOAST_DURATION_MS = 5000
export const DEBOUNCE_MS = 300
export const ITEMS_PER_PAGE = 20
export const ANIMATION_DURATION_MS = 300
export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// ==========================================
// lib/roles.ts — User roles
// ==========================================
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  MANAGER: 'manager',
  TEACHER: 'teacher',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// ==========================================
// lib/status-maps.ts — Status label/color maps
// ==========================================
export const STATUS_MAP = {
  active: { label: 'Active', variant: 'success' as const },
  inactive: { label: 'Inactive', variant: 'danger' as const },
  pending: { label: 'Pending', variant: 'warning' as const },
} as const
```

### Existing Constants to Use

| File | Contains |
| --- | --- |
| `lib/assignment-constants.ts` | `QUESTION_TEMPLATES`, `DIFFICULTY_LEVELS`, `ASSIGNMENT_TYPES`, `POINTS_PRESETS`, `TIME_PRESETS` |
| `lib/campus-data.ts` | Campus/center data |
| `lib/teaching-leaders.ts` | Teaching leader data |
| `lib/default-screen-catalog.ts` | Default screen permissions |
| `tailwind.config.js` | All design tokens (colors, spacing, typography, etc.) |

---

## 9. Migration Checklist (Legacy → New)

When touching any page, apply these fixes:

- [ ] **Replace deprecated component imports** (see table in Section 3)
- [ ] **Replace `bg-[#a1001f]`** → `bg-primary` or `bg-mindx-red`
- [ ] **Replace `bg-[#c41230]`** → `bg-mindx-red-light`
- [ ] **Replace `bg-[#8a0019]`** → `bg-mindx-red-dark`
- [ ] **Replace all `bg-[#hex]`** → appropriate semantic token
- [ ] **Replace raw `<button>` elements** → `<Button>` component
- [ ] **Replace `style={{ zIndex: N }}`** → Tailwind z-index token
- [ ] **Replace inline color strings** → constants from `tailwind.config.js`
- [ ] **Extract magic numbers** → named constants
- [ ] **Extract repeated strings** (labels, messages) → constants
- [ ] **Replace `components/Modal`** → `components/ui/modal`
- [ ] **Replace `components/ConfirmDialog`** → `components/ui/dialog`

### Files with Known Inline Colors (need migration)

**`app/` pages** (~42 files with `bg-[#...]` patterns):
- `admin/assignments/page.tsx`, `admin/cloudinary/page.tsx`, `admin/database/page.tsx`
- `admin/feedback/page.tsx`, `admin/hr-candidates/components/*.tsx`
- `admin/page1/page.tsx`, `admin/page2/manage/page.tsx`
- `admin/page4/*.tsx`, `admin/page5/page.tsx`
- `admin/profile/page.tsx`, `admin/system-metrics/page.tsx`
- `admin/training-dashboard/page.tsx`, `admin/user-management/components/*.tsx`
- `admin/video-detail/page.tsx`, `admin/video-setup/page.tsx`
- `admin/xin-nghi-mot-buoi/page.tsx`
- `user/assignments/page.tsx`, `user/giaithich/page.tsx`, `user/giaitrinh/page.tsx`
- `user/hoat-dong-hang-thang/page.tsx`, `user/lich-cua-toi/components/*.tsx`
- `user/profile/page.tsx`, `user/training/page.tsx`
- `login/page.tsx`, `not-found.tsx`, `bao-tri/page.tsx`

**`components/` files** (~26 files with `bg-[#...]` patterns):
- `AppLayout.tsx`, `AuthModal.tsx`, `Comments.tsx`
- `ConfirmDialog.tsx`, `Modal.tsx`, `sidebar.tsx`
- `birthday-wish-popup.tsx`, `birthday-send-wish-popup.tsx`
- `RichTextEditor.tsx`, `upcoming-events-sidebar.tsx`
- Various feature components under `feedback/`, `k12-docs/`, `leave-request/`

---

## 10. Quick Reference Card

### ✅ DO

```
✅ Use components from components/ui/
✅ Use primitives from components/ui/primitives/
✅ Use Tailwind semantic tokens (bg-primary, text-muted-foreground, border-border)
✅ Define constants in lib/ files
✅ Use cva() for component variants
✅ Use cn() for conditional class merging
✅ Follow composition pattern for complex components
✅ Import icons from lucide-react
✅ Use Button component for all clickable actions
✅ Use z-index tokens from the scale
```

### 🚫 DON'T

```
🚫 Use bg-[#hex] or text-[#hex] inline arbitrary colors
🚫 Import from deprecated components/ root files
🚫 Create raw <button>, <input>, <table> with inline Tailwind
🚫 Use style={{ ... }} for colors, spacing, z-index
🚫 Use magic numbers (z-index: 9999, timeout: 5000)
🚫 Duplicate component logic that exists in ui/
🚫 Use arbitrary spacing (p-[13px], gap-[18px])
🚫 Create new components in components/ root — use ui/ or feature folders
🚫 Use react-hot-toast directly — use lib/app-toast
🚫 Define ad-hoc status/color maps inline — use shared constants
```

### Import Cheat Sheet

```tsx
// Primitives
import { Box, Stack, Flex, Grid, Text, Heading, Icon, Input } from '@/components/ui/primitives'

// Core UI
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard, StatGrid } from '@/components/ui/stat-card'
import { FilterBar, FilterSection } from '@/components/ui/filter-bar'
import { FormField } from '@/components/ui/form-field'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'
import { Skeleton } from '@/components/ui/skeleton'
import { Stepper } from '@/components/ui/stepper'
import { InfoCard } from '@/components/ui/info-card'

// Utilities
import { cn } from '@/lib/utils'
import { toast } from '@/lib/app-toast'
```

---

> **Maintainer note**: Keep this document updated whenever new components, tokens, or conventions are added.
> Last updated: 2025-05-21
