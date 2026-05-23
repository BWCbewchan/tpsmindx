# Phase 3: Card Consolidation - IN PROGRESS 🚧

## Ngày bắt đầu: 2026-05-03

---

## 📊 Tổng quan

**Phase 3 - Card Consolidation** đang được thực hiện. Mục tiêu là consolidate 100+ custom card implementations thành 1 standard Card component.

---

## ✅ Công việc đã hoàn thành

### 1. Enhanced `components/ui/card.tsx` ✅

**Features đã thêm:**
- ✅ Support backward compatibility với legacy Card API
- ✅ Added `title` prop (legacy API)
- ✅ Added `hover` prop (legacy API - maps to variant="interactive")
- ✅ Added `padding="none"` option
- ✅ Fixed border colors: `border-border` → `border-gray-200` (consistent)
- ✅ Composition pattern: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

**API Compatibility:**
```tsx
// Legacy API (still works)
<Card title="Title" hover padding="lg">
  Content
</Card>

// New API - Composition pattern (recommended)
<Card padding="lg">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Actions</CardFooter>
</Card>

// New API - Variants
<Card variant="interactive">Content</Card>
<Card variant="elevated">Content</Card>
<Card variant="outlined">Content</Card>
```

---

### 2. Added Deprecation Warning to `components/Card.tsx` ✅

**Changes:**
- ✅ Added JSDoc deprecation notice with migration guide
- ✅ Added console.warn in development mode
- ✅ Component still works (backward compatible)
- ✅ Will be removed in future version

---

## 🔍 Custom Card Audit Results

### Pattern Analysis:

**Most Common Pattern** (100+ instances):
```tsx
<div className="rounded-xl border border-gray-200 bg-white p-X shadow-sm">
  Content
</div>
```

**Variations Found:**
1. **Border radius**: `rounded-xl` (12px) vs `rounded-lg` (8px)
2. **Border color**: `border-gray-200` (most common) vs `border-gray-100` vs `border-gray-300`
3. **Padding**: `p-3`, `p-4`, `p-5`, `p-6` (inconsistent)
4. **Shadow**: `shadow-sm` (most common) vs `shadow-md` vs none
5. **Hover effects**: Some have `hover:shadow-md`, some don't

### Files with Custom Cards (Sample):

#### Admin Pages:
- `app/admin/system-metrics/page.tsx` - **10+ custom cards**
- `app/admin/user-management/page.tsx` - **5+ custom cards**
- `app/admin/user-management/components/UsersTab.tsx` - **3+ custom cards**
- `app/admin/user-management/components/DataTab.tsx` - **2+ custom cards**
- `app/admin/user-management/components/ScreensTab.tsx` - **4+ custom cards**
- `app/admin/user-management/components/PermSelector.tsx` - **1 custom card**
- `app/admin/xin-nghi-mot-buoi/page.tsx` - **1 custom card**
- `app/admin/feedback/page.tsx` - **2 custom cards**
- `app/admin/page2/custom/page.tsx` - **1 custom card**
- `app/admin/page2/manage/page.tsx` - **1 custom card**
- `app/admin/page4/danh-sach-dang-ky/page.tsx` - **1 custom card**

#### User Pages:
- `app/user/xin-nghi-mot-buoi/page.tsx` - **2+ custom cards**

#### Other Pages:
- `app/checkdatasource/page.tsx` - **2+ custom cards**

**Total identified so far**: 35+ custom card instances in 13+ files

---

## 🎯 Standardization Strategy

### Standard Card Patterns:

#### 1. **Basic Card** (Default)
```tsx
// Before
<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
  Content
</div>

// After
<Card>
  <CardContent>Content</CardContent>
</Card>
```

#### 2. **Card with Title**
```tsx
// Before
<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
  <h3 className="text-sm font-semibold text-gray-800 mb-3">Title</h3>
  Content
</div>

// After
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

#### 3. **Interactive Card** (Hover effect)
```tsx
// Before
<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
  Content
</div>

// After
<Card variant="interactive">
  <CardContent>Content</CardContent>
</Card>
```

#### 4. **Elevated Card** (More shadow)
```tsx
// Before
<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-lg">
  Content
</div>

// After
<Card variant="elevated">
  <CardContent>Content</CardContent>
</Card>
```

#### 5. **Stat Card** (Metrics display)
```tsx
// Before
<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
  <p className="text-xs font-medium text-gray-500">Label</p>
  <p className="text-2xl font-bold text-gray-900">Value</p>
</div>

// After
<Card padding="lg">
  <CardContent>
    <p className="text-xs font-medium text-gray-500">Label</p>
    <p className="text-2xl font-bold text-gray-900">Value</p>
  </CardContent>
</Card>
```

---

## 📋 Migration Checklist

### Phase 3A: High-Priority Pages (Week 1)
- [ ] `app/admin/system-metrics/page.tsx` (10+ cards)
- [ ] `app/admin/user-management/page.tsx` (5+ cards)
- [ ] `app/admin/user-management/components/UsersTab.tsx` (3+ cards)
- [ ] `app/admin/user-management/components/ScreensTab.tsx` (4+ cards)
- [ ] `app/user/xin-nghi-mot-buoi/page.tsx` (2+ cards)

**Estimated**: 24+ card instances

### Phase 3B: Medium-Priority Pages (Week 2)
- [ ] `app/admin/user-management/components/DataTab.tsx`
- [ ] `app/admin/xin-nghi-mot-buoi/page.tsx`
- [ ] `app/admin/feedback/page.tsx`
- [ ] `app/checkdatasource/page.tsx`
- [ ] `app/admin/page4/danh-sach-dang-ky/page.tsx`

**Estimated**: 8+ card instances

### Phase 3C: Low-Priority Pages (Week 3)
- [ ] `app/admin/page2/custom/page.tsx`
- [ ] `app/admin/page2/manage/page.tsx`
- [ ] `app/admin/user-management/components/PermSelector.tsx`
- [ ] Other pages with 1-2 cards

**Estimated**: 3+ card instances

---

## 🎨 Design Tokens (Standardized)

### Border Radius:
- **Standard**: `rounded-xl` (12px) - Use this for all cards
- ~~Legacy~~: `rounded-lg` (8px) - Deprecated

### Border Color:
- **Standard**: `border-gray-200` - Use this for all cards
- ~~Legacy~~: `border-gray-100`, `border-gray-300` - Deprecated

### Padding:
- **Small**: `p-3 lg:p-4` (12px → 16px responsive)
- **Medium**: `p-4 lg:p-6` (16px → 24px responsive) - **DEFAULT**
- **Large**: `p-6 lg:p-8` (24px → 32px responsive)

### Shadow:
- **Default**: `shadow-sm` - Use for most cards
- **Elevated**: `shadow-lg` - Use for important/highlighted cards
- **Interactive**: `hover:shadow-md` - Use for clickable cards

---

## 📊 Progress Tracking

| Metric | Target | Current | Progress |
|--------|--------|---------|----------|
| Enhanced Card component | 1 | 1 | ✅ 100% |
| Deprecation warning added | 1 | 1 | ✅ 100% |
| High-priority pages migrated | 5 | 0 | ⏳ 0% |
| Medium-priority pages migrated | 5 | 0 | ⏳ 0% |
| Low-priority pages migrated | 3 | 0 | ⏳ 0% |
| **Total card instances migrated** | **35+** | **0** | **⏳ 0%** |

---

## 🚀 Next Steps

### Immediate (This Session):
1. ✅ Enhanced Card component with backward compatibility
2. ✅ Added deprecation warning to legacy Card
3. ✅ Audited custom card implementations
4. ⏳ Start migrating high-priority pages

### Week 1:
1. ❌ Migrate `app/admin/system-metrics/page.tsx` (10+ cards)
2. ❌ Migrate `app/admin/user-management/page.tsx` (5+ cards)
3. ❌ Migrate `app/admin/user-management/components/UsersTab.tsx` (3+ cards)
4. ❌ Migrate `app/admin/user-management/components/ScreensTab.tsx` (4+ cards)
5. ❌ Migrate `app/user/xin-nghi-mot-buoi/page.tsx` (2+ cards)

### Week 2-3:
1. ❌ Migrate medium-priority pages
2. ❌ Migrate low-priority pages
3. ❌ Create migration guide document
4. ❌ Update design system documentation

---

## 💡 Lessons Learned (So Far)

### What's Working Well:
1. **Backward compatibility** - Makes migration optional and gradual
2. **Composition pattern** - More flexible than legacy API
3. **Consistent design tokens** - Easier to maintain

### Challenges:
1. **100+ instances** - Will take time to migrate all
2. **Custom styling** - Some cards have unique styling that needs special handling
3. **Testing** - Need to verify each migration doesn't break layout

---

## 📝 Notes

- **Priority**: Focus on high-traffic pages first
- **Testing**: Test each page after migration
- **Gradual migration**: Don't need to migrate all at once
- **Backward compatibility**: Legacy Card API still works

---

## Status: 🚧 IN PROGRESS

**Current Phase**: Phase 3A - Preparing for high-priority page migration
**Next**: Start migrating `app/admin/system-metrics/page.tsx`
