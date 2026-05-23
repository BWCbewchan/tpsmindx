# Component Reuse Audit - Toàn bộ ứng dụng

## Ngày: 2026-05-03

## Tổng quan
Audit toàn bộ ứng dụng để tìm các components/elements chưa consistent và cần component reuse.

---

## ✅ Components ĐÃ CONSISTENT (Reusable)

### 1. **Tables** ✅
- **Component**: `components/ui/table.tsx`
- **Usage**: Table, TableHeader, TableBody, TableRow, TableHead, TableCell
- **Status**: ✅ Được sử dụng consistent trong hầu hết pages
- **Examples**:
  - `/user/giaithich` ✅
  - `/user/xin-nghi-mot-buoi` ✅
  - `/user/training` ✅
  - `/lichgiaovien` ✅
  - `/rawdata` ✅
  - `/test-teachers` ✅

### 2. **Buttons** ✅
- **Component**: `components/ui/button.tsx`
- **Usage**: `<Button variant="..." size="...">`
- **Status**: ✅ Được sử dụng consistent
- **Variants**: default, outline, ghost, destructive
- **Sizes**: sm, md, lg, icon-sm, icon-md

### 3. **Badges** ✅
- **Component**: `components/ui/badge.tsx`
- **Usage**: `<Badge variant="..." size="..." shape="...">`
- **Status**: ✅ Được sử dụng consistent
- **Also**: `StatusBadge` component cho status-specific badges

### 4. **Modals** ✅
- **Component**: `components/ui/modal.tsx`
- **Usage**: Modal, ModalHeader, ModalTitle, ModalClose, ModalBody
- **Status**: ✅ Được sử dụng trong `/lichgiaovien` và một số pages
- **Legacy**: `components/Modal.tsx` (old version - cần migrate)

### 5. **Page Layout** ✅
- **Component**: `components/ui/page-layout.tsx`
- **Usage**: PageLayout, PageLayoutContent
- **Status**: ✅ Được sử dụng consistent trong nhiều pages

### 6. **Form Fields** ✅
- **Components**:
  - `components/ui/input.tsx`
  - `components/ui/textarea.tsx`
  - `components/ui/form-field.tsx`
- **Status**: ✅ Có components nhưng chưa được sử dụng 100%

### 7. **Loading States** ✅
- **Component**: `components/skeletons/PageSkeleton.tsx`
- **Status**: ✅ ĐÃ STANDARDIZED (vừa hoàn thành)
- **Variants**: default, table, grid, form

### 8. **Empty States** ✅
- **Component**: `components/EmptyState.tsx` + `components/ui/empty-state.tsx`
- **Status**: ⚠️ Có 2 versions - cần consolidate

---

## ❌ Components CHƯA CONSISTENT (Cần Reuse)

### 1. **Modal/Dialog** ❌ CRITICAL
**Problem**: Có 2 implementations khác nhau

#### Version 1: `components/Modal.tsx` (Legacy)
```tsx
<Modal show={showModal} onClose={() => setShowModal(false)}>
  <div className="p-6">...</div>
</Modal>
```
**Used in**:
- `/admin/xin-nghi-mot-buoi`
- `/admin/deal-luong`
- `/admin/feedback`
- `/user/giaithich`
- `/user/xin-nghi-mot-buoi`
- `/user/nhan-lop-1-buoi`
- Many other pages

#### Version 2: `components/ui/modal.tsx` (New)
```tsx
<Modal>
  <ModalHeader>
    <ModalTitle>...</ModalTitle>
    <ModalClose />
  </ModalHeader>
  <ModalBody>...</ModalBody>
</Modal>
```
**Used in**:
- `/lichgiaovien`

#### Version 3: Custom inline modals
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="bg-white rounded-xl">...</div>
</div>
```
**Used in**:
- `/rawdata`
- `/rawdata-experience`
- Many admin pages

**ACTION NEEDED**: 
- ✅ Keep `components/ui/modal.tsx` as standard
- ❌ Migrate all pages from `components/Modal.tsx` → `components/ui/modal.tsx`
- ❌ Replace all custom inline modals with `components/ui/modal.tsx`

---

### 2. **Cards** ❌ CRITICAL
**Problem**: Multiple card implementations with inconsistent styling

#### Version 1: `components/Card.tsx`
```tsx
<Card padding="lg" hover>...</Card>
```

#### Version 2: `components/ui/card.tsx`
```tsx
<Card>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

#### Version 3: Custom inline cards (MOST COMMON)
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  ...
</div>
```
**Found in**: Almost EVERY page with custom variations:
- `rounded-xl border border-gray-200 bg-white p-4 shadow-sm`
- `rounded-lg border border-gray-200 bg-white p-3`
- `rounded-xl border border-gray-200 bg-white p-6`
- `rounded-lg border border-gray-300 bg-white p-4`

**ACTION NEEDED**:
- ✅ Consolidate to ONE Card component
- ❌ Replace ALL custom inline cards with reusable component
- ❌ Standardize padding, border, shadow values

**Estimated**: 100+ instances across the app

---

### 3. **Input Fields** ❌ HIGH PRIORITY
**Problem**: Inconsistent input styling across pages

#### Current State:
```tsx
// Version 1
<input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" />

// Version 2
<input className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#a1001f] focus:bg-white focus:ring-2 focus:ring-[#a1001f]/15" />

// Version 3
<input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

// Version 4
<input className="w-full border border-[#e7c6cb] rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" />
```

**Variations**:
- Border radius: `rounded-lg` vs `rounded-xl`
- Border color: `border-gray-300` vs `border-gray-200` vs `border-[#e7c6cb]`
- Padding: `px-3 py-2` vs `py-2.5 pl-10 pr-3` vs `px-3 py-2.5`
- Background: `bg-white` vs `bg-gray-50/80` vs none
- Focus ring: Different colors and opacities

**ACTION NEEDED**:
- ✅ Use `components/ui/input.tsx` consistently
- ❌ Replace ALL custom input styling
- ❌ Create variants: default, search, with-icon

**Estimated**: 50+ instances

---

### 4. **Select/Dropdown** ❌ HIGH PRIORITY
**Problem**: Inconsistent select styling

#### Current State:
```tsx
// Version 1
<select className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm">

// Version 2
<select className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#a1001f] focus:ring-2 focus:ring-[#a1001f]/15">

// Version 3
<select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
```

**ACTION NEEDED**:
- ✅ Create `components/ui/select.tsx`
- ❌ Replace ALL custom select styling
- ❌ Standardize focus states

**Estimated**: 30+ instances

---

### 5. **Textarea** ❌ MEDIUM PRIORITY
**Problem**: Inconsistent textarea styling

#### Current State:
```tsx
// Version 1
<textarea className="min-h-[120px] w-full shrink-0 resize-y rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" />

// Version 2
<textarea className="w-full px-3 py-2.5 border border-[#e7c6cb] rounded-lg focus:ring-2 focus:ring-[#a1001f]/20 focus:border-[#a1001f]" />

// Version 3
<textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1001f]/20" />
```

**ACTION NEEDED**:
- ✅ Use `components/ui/textarea.tsx` consistently
- ❌ Replace ALL custom textarea styling

**Estimated**: 20+ instances

---

### 6. **Empty States** ❌ MEDIUM PRIORITY
**Problem**: Multiple implementations

#### Version 1: `components/EmptyState.tsx`
```tsx
<EmptyState 
  icon={FileX}
  title="Không có dữ liệu"
  description="..."
/>
```

#### Version 2: `components/ui/empty-state.tsx`
```tsx
<EmptyState>...</EmptyState>
```

#### Version 3: Custom inline (MOST COMMON)
```tsx
<div className="p-12 text-center text-gray-500">
  Chưa có dữ liệu
</div>
```

**Found in**:
- `/admin/hr-onboarding` - "Chưa có GEN nào"
- `/public/training-detail` - "Chưa có dữ liệu video"
- `/analytics` - "Chưa có dữ liệu tìm kiếm"
- Many other pages

**ACTION NEEDED**:
- ✅ Consolidate to ONE EmptyState component
- ❌ Replace ALL custom empty states
- ❌ Add variants: no-data, no-results, no-permission

**Estimated**: 40+ instances

---

### 7. **Stat Cards** ❌ MEDIUM PRIORITY
**Problem**: Multiple implementations

#### Version 1: `components/StatCard.tsx`
```tsx
<StatCard title="..." value="..." />
```

#### Version 2: `components/ui/stat-card.tsx`
```tsx
<StatCard label="..." value="..." icon={Icon} variant="..." />
```

#### Version 3: Custom inline
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-4">
  <p className="text-xs text-gray-500">Label</p>
  <p className="text-2xl font-bold">Value</p>
</div>
```

**ACTION NEEDED**:
- ✅ Consolidate to `components/ui/stat-card.tsx`
- ❌ Migrate all StatCard usages
- ❌ Replace custom inline stat cards

**Estimated**: 30+ instances

---

### 8. **Filter Bar** ❌ LOW PRIORITY
**Problem**: Custom filter implementations on each page

**Current State**: Each page has custom filter UI with:
- Search inputs
- Date pickers
- Dropdowns
- Filter buttons

**ACTION NEEDED**:
- ✅ Use `components/ui/filter-bar.tsx` consistently
- ❌ Create reusable filter components
- ❌ Standardize filter patterns

**Estimated**: 20+ pages with custom filters

---

### 9. **Tabs** ❌ LOW PRIORITY
**Problem**: Multiple tab implementations

#### Version 1: `components/Tabs.tsx`
```tsx
<Tabs tabs={[...]} activeTab={...} onTabChange={...} />
```

#### Version 2: Custom inline tabs
```tsx
<nav className="flex gap-2">
  <button className={active ? 'bg-blue-600' : 'bg-white'}>...</button>
</nav>
```

**ACTION NEEDED**:
- ✅ Use `components/Tabs.tsx` consistently
- ❌ Replace custom tab implementations

**Estimated**: 15+ instances

---

## 📊 Priority Matrix

### CRITICAL (Do First)
1. **Modal/Dialog** - 3 different implementations, used everywhere
2. **Cards** - 100+ custom instances, no consistency

### HIGH PRIORITY
3. **Input Fields** - 50+ custom instances, inconsistent styling
4. **Select/Dropdown** - 30+ custom instances
5. **Empty States** - 40+ custom instances

### MEDIUM PRIORITY
6. **Textarea** - 20+ custom instances
7. **Stat Cards** - 30+ instances, 2 components

### LOW PRIORITY
8. **Filter Bar** - 20+ pages with custom filters
9. **Tabs** - 15+ instances

---

## 🎯 Recommended Action Plan

### Phase 1: Critical Components (Week 1)
1. **Consolidate Modal components**
   - Keep `components/ui/modal.tsx` as standard
   - Create migration guide
   - Migrate 5 high-traffic pages
   - Deprecate `components/Modal.tsx`

2. **Consolidate Card components**
   - Keep `components/ui/card.tsx` as standard
   - Define standard variants (default, hover, interactive)
   - Create Card, CardHeader, CardContent, CardFooter
   - Migrate 10 high-traffic pages

### Phase 2: High Priority (Week 2)
3. **Standardize Form Inputs**
   - Enhance `components/ui/input.tsx` with variants
   - Create `components/ui/select.tsx`
   - Migrate all form pages
   - Document form patterns

4. **Consolidate Empty States**
   - Keep `components/ui/empty-state.tsx`
   - Add variants and icons
   - Migrate all pages

### Phase 3: Medium Priority (Week 3)
5. **Standardize Stat Cards**
   - Keep `components/ui/stat-card.tsx`
   - Migrate all dashboard pages

6. **Standardize Textareas**
   - Use `components/ui/textarea.tsx` consistently

### Phase 4: Low Priority (Week 4)
7. **Filter Bar patterns**
8. **Tab patterns**

---

## 📝 Component Reuse Guidelines

### When Creating New Components:
1. ✅ Check if reusable component exists in `components/ui/`
2. ✅ Use existing component with variants
3. ❌ Don't create custom inline styling
4. ❌ Don't duplicate component logic

### When Refactoring:
1. ✅ Replace custom styling with reusable components
2. ✅ Use consistent variants and props
3. ✅ Follow design system tokens
4. ❌ Don't mix old and new patterns in same file

---

## 🎨 Design Tokens to Standardize

### Border Radius
- Small: `rounded-lg` (8px)
- Medium: `rounded-xl` (12px)
- Large: `rounded-2xl` (16px)

### Border Colors
- Default: `border-gray-200`
- Hover: `border-gray-300`
- Focus: `border-[#a1001f]`

### Shadows
- Small: `shadow-sm`
- Medium: `shadow-md`
- Large: `shadow-lg`

### Spacing (Padding)
- Small: `p-3` (12px)
- Medium: `p-4` (16px)
- Large: `p-6` (24px)

### Focus States
- Ring: `focus:ring-2 focus:ring-[#a1001f]/20`
- Border: `focus:border-[#a1001f]`
- Outline: `focus:outline-none`

---

## ✅ Success Metrics

### Code Quality
- [ ] Reduce custom styling instances by 80%
- [ ] All pages use consistent components
- [ ] No duplicate component logic

### Developer Experience
- [ ] Clear component documentation
- [ ] Easy to find and use components
- [ ] Consistent API across components

### User Experience
- [ ] Consistent look and feel
- [ ] Predictable interactions
- [ ] Better accessibility

---

## 📚 Next Steps

1. **Create detailed migration guides** for each component
2. **Set up component documentation** with examples
3. **Create design system documentation**
4. **Implement Phase 1** (Critical components)
5. **Monitor and iterate** based on feedback
