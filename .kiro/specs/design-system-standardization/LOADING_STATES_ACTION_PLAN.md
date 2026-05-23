# 🔄 Loading States Standardization - Action Plan

## 🎯 Vấn Đề Phát Hiện

Bạn đã phát hiện đúng! Hiện tại có **3 patterns loading khác nhau** trong ứng dụng:

### ❌ Pattern 1: Không có skeleton (Worst)
```tsx
// Page render ngay, không có loading state
export default function Page() {
  const { data } = useSWR('/api/data')
  return <div>{data?.map(...)}</div> // Flash!
}
```
**Pages affected**: training, dang-ky-lich-lam-viec, hoat-dong-hang-thang, quan-ly-phan-hoi, nhan-lop-1-buoi

### ❌ Pattern 2: Skeleton một phần (Bad)
```tsx
// Header render trước, content skeleton sau
if (loading) {
  return (
    <div>
      <h1>Title</h1> {/* Already visible */}
      <div>Loading...</div> {/* Only this loading */}
    </div>
  )
}
```
**Pages affected**: truyenthong, assignments (một số sections)

### ⚠️ Pattern 3: Skeleton toàn bộ nhưng custom (Better but inconsistent)
```tsx
// Mỗi page có skeleton riêng, không consistent
if (loading) {
  return (
    <div className="p-8">
      <div className="h-8 bg-gray-200"></div>
      {/* Custom skeleton cho từng page */}
    </div>
  )
}
```
**Pages affected**: giaithich, giaitrinh, xin-nghi-mot-buoi

---

## ✅ Solution Đã Tạo

### 1. PageSkeleton Component
**File**: `components/skeletons/PageSkeleton.tsx`

**Features**:
- ✅ 4 variants: default, table, grid, form
- ✅ Configurable: itemCount, maxWidth, padding
- ✅ Consistent với PageLayout
- ✅ Smooth animations

**Usage**:
```tsx
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'

if (loading) {
  return <PageSkeleton variant="grid" itemCount={12} />
}
```

### 2. Documentation
**File**: `.kiro/specs/design-system-standardization/LOADING_STATES_STANDARDIZATION.md`

**Content**:
- ✅ Vấn đề hiện tại
- ✅ Standard patterns
- ✅ Variant guide
- ✅ Migration checklist
- ✅ Examples

---

## 📋 Migration Plan

### Phase 1: Critical Pages (No Loading State) - Priority 🔴 HIGH

#### 1. Training Page
**File**: `app/user/training/page.tsx`
**Current**: Không có loading state
**Fix**: Add `<PageSkeleton variant="grid" itemCount={12} />`
**Reason**: Video cards grid layout

#### 2. Dang Ky Lich Lam Viec
**File**: `app/user/dang-ky-lich-lam-viec/page.tsx`
**Current**: Không có loading state
**Fix**: Add `<PageSkeleton variant="table" itemCount={10} />`
**Reason**: Calendar/schedule table

#### 3. Hoat Dong Hang Thang
**File**: `app/user/hoat-dong-hang-thang/page.tsx`
**Current**: Không có loading state
**Fix**: Add `<PageSkeleton variant="default" itemCount={8} />`
**Reason**: Activity list

#### 4. Quan Ly Phan Hoi
**File**: `app/user/quan-ly-phan-hoi/page.tsx`
**Current**: Không có loading state
**Fix**: Add `<PageSkeleton variant="default" itemCount={6} />`
**Reason**: Feedback list

#### 5. Nhan Lop 1 Buoi
**File**: `app/user/nhan-lop-1-buoi/page.tsx`
**Current**: Không có loading state
**Fix**: Add `<PageSkeleton variant="table" itemCount={8} />`
**Reason**: Leave requests table

---

### Phase 2: Partial Loading (Header Shows First) - Priority 🟡 MEDIUM

#### 6. Truyenthong Page
**File**: `app/user/truyenthong/page.tsx`
**Current**: Header + description render trước, content loading sau
**Fix**: 
```tsx
if (isLoading) {
  return <PageSkeleton variant="grid" itemCount={9} showHeader={true} />
}
```
**Reason**: Post grid với hero section

#### 7. Assignments Page
**File**: `app/user/assignments/page.tsx`
**Current**: Một số sections có skeleton, một số không
**Fix**: Standardize toàn bộ với PageSkeleton
**Reason**: Assignment cards/table

---

### Phase 3: Custom Skeletons → PageSkeleton - Priority 🟢 LOW

#### 8. Giaithich Page
**File**: `app/user/giaithich/page.tsx`
**Current**: Custom skeleton
**Fix**: Replace với `<PageSkeleton variant="default" />`

#### 9. Giaitrinh Page
**File**: `app/user/giaitrinh/page.tsx`
**Current**: Custom skeleton
**Fix**: Replace với `<PageSkeleton variant="default" />`

#### 10. Xin Nghi Mot Buoi
**File**: `app/user/xin-nghi-mot-buoi/page.tsx`
**Current**: Custom skeleton
**Fix**: Replace với `<PageSkeleton variant="table" />`

---

## 🎯 Implementation Steps

### For Each Page:

1. **Import PageSkeleton**:
```tsx
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
```

2. **Identify loading state**:
```tsx
const { data, isLoading } = useSWR('/api/data')
// or
const [loading, setLoading] = useState(true)
```

3. **Add skeleton return**:
```tsx
if (isLoading || loading) {
  return <PageSkeleton variant="grid" itemCount={12} />
}
```

4. **Match layout**:
```tsx
// Skeleton
<PageSkeleton maxWidth="7xl" padding="md" />

// Actual content
<PageLayout maxWidth="7xl" padding="md">
```

---

## 📊 Expected Results

### Before:
- ❌ **10 pages** không có loading state
- ❌ **2 pages** có partial loading
- ❌ **3 pages** có custom skeleton không consistent
- ❌ **Total**: 15 pages cần fix

### After:
- ✅ **15 pages** có consistent loading state
- ✅ **1 PageSkeleton component** thay vì nhiều custom skeletons
- ✅ **4 variants** cover tất cả use cases
- ✅ **0 content flash** - smooth loading experience
- ✅ **0 layout shift** - skeleton match actual content

---

## 🚀 Benefits

### UX Benefits:
- ✅ **Consistent experience**: Tất cả pages loading giống nhau
- ✅ **No surprises**: Users biết chờ gì
- ✅ **Professional**: Smooth transitions
- ✅ **Perceived performance**: Skeleton makes app feel faster

### Developer Benefits:
- ✅ **Easy to use**: 1 line of code
- ✅ **Maintainable**: 1 component thay vì nhiều custom
- ✅ **Documented**: Clear patterns to follow
- ✅ **Consistent**: No need to think about loading states

---

## 📝 Next Actions

### Immediate (This Session):
1. ✅ Created PageSkeleton component
2. ✅ Created documentation
3. ✅ Created action plan (this file)

### Next Session:
1. ⏳ Migrate Phase 1 pages (5 pages - no loading state)
2. ⏳ Test all loading states
3. ⏳ Migrate Phase 2 pages (2 pages - partial loading)
4. ⏳ Migrate Phase 3 pages (3 pages - custom skeletons)
5. ⏳ Final testing & verification

---

## 🎊 Summary

**Vấn đề phát hiện**: ✅ Correct!
- Có pages không có skeleton
- Có pages skeleton một phần
- Có pages skeleton toàn bộ nhưng không consistent

**Solution**: ✅ Created!
- PageSkeleton component với 4 variants
- Documentation đầy đủ
- Migration plan chi tiết

**Next**: ⏳ Implement migration
- 15 pages cần update
- Estimated time: 1-2 hours
- High impact on UX

---

**Status**: 🟡 Ready to Implement  
**Priority**: 🔴 High  
**Impact**: 🟢 Very High (affects user experience on all pages)

**Bạn muốn tôi bắt đầu migrate ngay không?** 🚀
