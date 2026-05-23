# Page Layout Standardization Guide

## 🎯 Problem Statement

Currently, pages across the application have inconsistent layout patterns:

### Current Issues:
```tsx
// ❌ Different padding patterns
<div className="min-h-screen bg-white p-4">           // Some pages
<div className="min-h-screen bg-white p-2">           // Other pages
<div className="min-h-screen bg-white p-8">           // More pages
<div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">  // Responsive pages
<div className="px-0 py-1.25 sm:px-[1.5%] sm:py-2 lg:px-[2%]">  // Complex responsive

// ❌ Different max-width patterns
<div className="max-w-7xl mx-auto">   // Some pages
<div className="max-w-4xl mx-auto">   // Other pages
<div className="max-w-2xl mx-auto">   // More pages
<div className="mx-auto">             // No max-width

// ❌ Different background patterns
<div className="bg-white">
<div className="bg-gray-50">
<div className="bg-gradient-to-br from-gray-50 to-gray-100">
```

### Impact:
- ❌ Inconsistent user experience
- ❌ Hard to maintain
- ❌ Duplicate code
- ❌ No single source of truth

---

## ✅ Solution: PageLayout Component

A standardized layout component with consistent spacing, max-width, and background options.

### Component Structure:
```
PageLayout (outer wrapper)
  └─ PageLayoutContent (spacing wrapper)
       └─ PageLayoutSection (section grouping)
```

---

## 📚 API Reference

### PageLayout

Main wrapper component for page content.

```tsx
interface PageLayoutProps {
  children: React.ReactNode
  maxWidth?: 'full' | '7xl' | '6xl' | '5xl' | '4xl' | '3xl' | '2xl'
  background?: 'white' | 'gray' | 'gradient' | 'gradient-blue' | 'none'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'responsive'
  centered?: boolean
  className?: string
  fullHeight?: boolean
}
```

**Props:**
- `maxWidth` (default: `'7xl'`): Maximum content width
- `background` (default: `'white'`): Background style
- `padding` (default: `'md'`): Responsive padding size
- `centered` (default: `true`): Center content horizontally
- `fullHeight` (default: `true`): Apply min-h-screen
- `className`: Additional CSS classes

**Padding Sizes:**
- `none`: No padding
- `sm`: `p-2 sm:p-3 lg:p-4` (compact)
- `md`: `p-4 sm:p-6 lg:p-8` (standard)
- `lg`: `p-6 sm:p-8 lg:p-10` (spacious)
- `responsive`: Complex responsive padding for special cases

### PageLayoutContent

Inner content wrapper with vertical spacing.

```tsx
interface PageLayoutContentProps {
  children: React.ReactNode
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}
```

**Spacing Sizes:**
- `xs`: `space-y-2` (8px)
- `sm`: `space-y-3` (12px)
- `md`: `space-y-4` (16px)
- `lg`: `space-y-5` (20px) - **default**
- `xl`: `space-y-6` (24px)
- `2xl`: `space-y-8` (32px)

### PageLayoutSection

Section wrapper for grouping related content.

```tsx
interface PageLayoutSectionProps {
  children: React.ReactNode
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}
```

---

## 🎨 Usage Examples

### Example 1: Standard Page (Most Common)

**Before:**
```tsx
export default function MyPage() {
  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-5">
        <h1>My Page</h1>
        <div>Content here</div>
      </div>
    </div>
  )
}
```

**After:**
```tsx
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'

export default function MyPage() {
  return (
    <PageLayout>
      <PageLayoutContent>
        <h1>My Page</h1>
        <div>Content here</div>
      </PageLayoutContent>
    </PageLayout>
  )
}
```

### Example 2: Narrow Content Page

**Before:**
```tsx
<div className="min-h-screen bg-white p-8">
  <div className="max-w-4xl mx-auto">
    <h1>Article</h1>
    <p>Content</p>
  </div>
</div>
```

**After:**
```tsx
<PageLayout maxWidth="4xl">
  <PageLayoutContent>
    <h1>Article</h1>
    <p>Content</p>
  </PageLayoutContent>
</PageLayout>
```

### Example 3: Gradient Background

**Before:**
```tsx
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-8">
  <div className="max-w-7xl mx-auto">
    <h1>Dashboard</h1>
  </div>
</div>
```

**After:**
```tsx
<PageLayout background="gradient-blue">
  <PageLayoutContent>
    <h1>Dashboard</h1>
  </PageLayoutContent>
</PageLayout>
```

### Example 4: Compact Padding

**Before:**
```tsx
<div className="min-h-screen bg-white p-2">
  <div className="max-w-7xl mx-auto">
    <h1>Compact Page</h1>
  </div>
</div>
```

**After:**
```tsx
<PageLayout padding="sm">
  <PageLayoutContent>
    <h1>Compact Page</h1>
  </PageLayoutContent>
</PageLayout>
```

### Example 5: Multiple Sections

**Before:**
```tsx
<div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
  <div className="max-w-7xl mx-auto space-y-8">
    <div className="space-y-4">
      <h2>Section 1</h2>
      <p>Content</p>
    </div>
    <div className="space-y-4">
      <h2>Section 2</h2>
      <p>More content</p>
    </div>
  </div>
</div>
```

**After:**
```tsx
<PageLayout>
  <PageLayoutContent spacing="2xl">
    <PageLayoutSection>
      <h2>Section 1</h2>
      <p>Content</p>
    </PageLayoutSection>
    
    <PageLayoutSection>
      <h2>Section 2</h2>
      <p>More content</p>
    </PageLayoutSection>
  </PageLayoutContent>
</PageLayout>
```

### Example 6: Full Width Page

**Before:**
```tsx
<div className="min-h-screen bg-white p-4">
  <div className="w-full">
    <h1>Full Width</h1>
  </div>
</div>
```

**After:**
```tsx
<PageLayout maxWidth="full">
  <PageLayoutContent>
    <h1>Full Width</h1>
  </PageLayoutContent>
</PageLayout>
```

### Example 7: Loading State

**Before:**
```tsx
if (loading) {
  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  )
}
```

**After:**
```tsx
if (loading) {
  return (
    <PageLayout>
      <PageLayoutContent>
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </PageLayoutContent>
    </PageLayout>
  )
}
```

---

## 🔄 Migration Strategy

### Phase 1: High-Traffic Pages (Priority)
1. Dashboard pages (`/admin/*`)
2. User-facing pages (`/user/*`)
3. Public pages (`/public/*`)

### Phase 2: Utility Pages
1. Test pages
2. Admin tools
3. Internal pages

### Phase 3: Special Cases
1. Login page (custom layout)
2. Error pages (custom layout)
3. Landing pages (custom layout)

---

## 📋 Migration Checklist

For each page:

- [ ] Import PageLayout components
- [ ] Replace outer `<div className="min-h-screen...">` with `<PageLayout>`
- [ ] Replace inner `<div className="max-w-...">` with content inside PageLayout
- [ ] Wrap content with `<PageLayoutContent>` for spacing
- [ ] Use `<PageLayoutSection>` for grouped content
- [ ] Remove old spacing classes (`space-y-*`)
- [ ] Test responsive behavior (mobile, tablet, desktop)
- [ ] Verify no visual regressions
- [ ] Run TypeScript diagnostics

---

## 🎯 Standard Patterns

### Pattern 1: List/Table Page
```tsx
<PageLayout>
  <PageLayoutContent>
    {/* Header */}
    <div className="border-b pb-4">
      <h1>Page Title</h1>
      <p>Description</p>
    </div>
    
    {/* Filters */}
    <FilterBar />
    
    {/* Content */}
    <Table>...</Table>
  </PageLayoutContent>
</PageLayout>
```

### Pattern 2: Form Page
```tsx
<PageLayout maxWidth="4xl">
  <PageLayoutContent>
    <h1>Form Title</h1>
    <form className="space-y-6">
      <FormField />
      <FormField />
      <Button type="submit">Submit</Button>
    </form>
  </PageLayoutContent>
</PageLayout>
```

### Pattern 3: Dashboard Page
```tsx
<PageLayout background="gradient-blue">
  <PageLayoutContent spacing="xl">
    <h1>Dashboard</h1>
    
    <StatGrid>
      <StatCard />
      <StatCard />
    </StatGrid>
    
    <div className="grid grid-cols-2 gap-6">
      <Card />
      <Card />
    </div>
  </PageLayoutContent>
</PageLayout>
```

---

## 🚀 Benefits

### Before Migration:
- ❌ 10+ different padding patterns
- ❌ 5+ different max-width patterns
- ❌ Inconsistent spacing
- ❌ Hard to maintain
- ❌ ~15-20 lines of layout code per page

### After Migration:
- ✅ Single standardized layout component
- ✅ Consistent spacing across all pages
- ✅ Easy to maintain and update
- ✅ Responsive by default
- ✅ ~3-5 lines of layout code per page
- ✅ **70% code reduction** for layout code

---

## 📊 Recommended Configurations

### Standard Content Page:
```tsx
<PageLayout maxWidth="7xl" padding="md" background="white">
```

### Article/Blog Page:
```tsx
<PageLayout maxWidth="4xl" padding="lg" background="white">
```

### Dashboard Page:
```tsx
<PageLayout maxWidth="7xl" padding="md" background="gradient-blue">
```

### Form Page:
```tsx
<PageLayout maxWidth="3xl" padding="md" background="gray">
```

### Full-Width Table:
```tsx
<PageLayout maxWidth="full" padding="md" background="white">
```

---

## 🔍 Testing Checklist

After migration, verify:

- [ ] Mobile (320px - 640px): Proper padding, no overflow
- [ ] Tablet (640px - 1024px): Responsive padding scales correctly
- [ ] Desktop (1024px+): Max-width constraint works, content centered
- [ ] Loading states: Skeleton loaders display correctly
- [ ] Error states: Error messages display correctly
- [ ] Scroll behavior: Page scrolls smoothly
- [ ] No visual regressions: Compare before/after screenshots

---

## 💡 Tips

1. **Start with simple pages**: Migrate test pages first to get familiar
2. **Use PageLayoutContent**: Always wrap content for consistent spacing
3. **Leverage spacing prop**: Use `spacing` instead of manual `space-y-*` classes
4. **Keep it simple**: Don't over-nest components
5. **Test responsive**: Always check mobile, tablet, desktop
6. **Batch migrations**: Migrate related pages together (e.g., all user pages)

---

## 🎨 Design Tokens

### Padding Scale:
- `sm`: 8px → 12px → 16px (mobile → tablet → desktop)
- `md`: 16px → 24px → 32px (mobile → tablet → desktop) **← Standard**
- `lg`: 24px → 32px → 40px (mobile → tablet → desktop)

### Max-Width Scale:
- `2xl`: 672px (42rem)
- `3xl`: 768px (48rem)
- `4xl`: 896px (56rem)
- `5xl`: 1024px (64rem)
- `6xl`: 1152px (72rem)
- `7xl`: 1280px (80rem) **← Standard**
- `full`: 100%

### Spacing Scale:
- `xs`: 8px (0.5rem)
- `sm`: 12px (0.75rem)
- `md`: 16px (1rem)
- `lg`: 20px (1.25rem) **← Standard**
- `xl`: 24px (1.5rem)
- `2xl`: 32px (2rem)

---

## ✅ Success Criteria

Migration is successful when:

1. ✅ All pages use PageLayout component
2. ✅ No inline layout classes (`min-h-screen`, `max-w-*`, `p-*`)
3. ✅ Consistent spacing across all pages
4. ✅ Responsive behavior works on all devices
5. ✅ No TypeScript errors
6. ✅ No visual regressions
7. ✅ Code is cleaner and more maintainable

---

## 📝 Next Steps

1. Review this guide
2. Start with 1-2 simple pages as proof of concept
3. Get feedback on the approach
4. Create a migration plan for all pages
5. Execute migration in phases
6. Document any edge cases or special requirements

---

**Status**: 📋 Ready for implementation
**Priority**: 🔴 High (affects all pages)
**Effort**: 🟡 Medium (systematic but straightforward)
**Impact**: 🟢 High (major consistency improvement)
