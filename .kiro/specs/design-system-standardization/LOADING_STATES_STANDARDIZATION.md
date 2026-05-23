# 🔄 Loading States Standardization Guide

## 🎯 Mục Tiêu

Standardize loading states across toàn bộ ứng dụng để:
- ✅ **Consistent UX**: Tất cả pages có loading experience giống nhau
- ✅ **No content flash**: Không bao giờ render một phần rồi mới loading
- ✅ **Skeleton matching**: Skeleton phải match với actual content layout
- ✅ **Smooth transitions**: Chuyển từ skeleton → content mượt mà

---

## 🚫 Vấn Đề Hiện Tại

### ❌ Inconsistent Patterns:

1. **Không có loading state**:
   ```tsx
   // ❌ BAD: Render ngay, không có skeleton
   export default function Page() {
     const { data } = useSWR('/api/data')
     
     return (
       <PageLayout>
         <h1>Title</h1>
         {data?.map(...)} // Flash of empty content
       </PageLayout>
     )
   }
   ```

2. **Loading một phần**:
   ```tsx
   // ❌ BAD: Header render ngay, content loading sau
   if (loading) {
     return (
       <PageLayout>
         <h1>Title</h1> {/* Already rendered */}
         <div>Loading...</div> {/* Only this part loading */}
       </PageLayout>
     )
   }
   ```

3. **Loading toàn bộ nhưng không match layout**:
   ```tsx
   // ❌ BAD: Skeleton không match actual content
   if (loading) {
     return <div className="p-8">Loading...</div>
   }
   
   return (
     <PageLayout maxWidth="7xl">
       <PageLayoutContent>
         {/* Different layout! */}
       </PageLayoutContent>
     </PageLayout>
   )
   ```

---

## ✅ Solution: PageSkeleton Component

### Component API

```tsx
<PageSkeleton
  variant="default" | "table" | "grid" | "form"
  showHeader={true}
  itemCount={6}
  maxWidth="7xl"
  padding="md"
/>
```

### Variants:

1. **default**: Content blocks (cho list pages)
2. **table**: Table layout (cho data tables)
3. **grid**: Card grid (cho gallery/card layouts)
4. **form**: Form fields (cho form pages)

---

## 📋 Standard Pattern

### Pattern 1: Simple Data Loading

```tsx
'use client'

import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { PageLayout, PageLayoutContent } from '@/components/ui/page-layout'

export default function MyPage() {
  const { data, isLoading } = useSWR('/api/data')
  
  // ✅ GOOD: Show full skeleton while loading
  if (isLoading) {
    return <PageSkeleton variant="default" />
  }
  
  // ✅ GOOD: Show error state with same layout
  if (!data) {
    return (
      <PageLayout>
        <PageLayoutContent>
          <div className="text-center py-20">
            <p>Không tìm thấy dữ liệu</p>
          </div>
        </PageLayoutContent>
      </PageLayout>
    )
  }
  
  // ✅ GOOD: Actual content with same layout
  return (
    <PageLayout>
      <PageLayoutContent spacing="lg">
        <div>
          <h1 className="text-2xl font-bold">Title</h1>
          <p className="text-gray-600">Description</p>
        </div>
        
        {/* Content */}
        <div className="space-y-4">
          {data.map(item => (
            <div key={item.id}>{item.name}</div>
          ))}
        </div>
      </PageLayoutContent>
    </PageLayout>
  )
}
```

### Pattern 2: Multiple Loading States

```tsx
export default function MyPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  useEffect(() => {
    fetchData().then(result => {
      setData(result)
      setLoading(false)
    })
  }, [])
  
  // ✅ GOOD: Single loading check at top
  if (loading) {
    return <PageSkeleton variant="table" />
  }
  
  return (
    <PageLayout>
      <PageLayoutContent>
        {/* Content */}
      </PageLayoutContent>
    </PageLayout>
  )
}
```

### Pattern 3: PageContainer with Loading

```tsx
export default function MyPage() {
  const { data, isLoading } = useSWR('/api/data')
  
  // ✅ GOOD: PageContainer has built-in skeleton support
  if (isLoading) {
    return <PageSkeleton variant="grid" />
  }
  
  return (
    <PageContainer title="My Page">
      {/* Content */}
    </PageContainer>
  )
}
```

---

## 🎨 Skeleton Variants Guide

### 1. Default Variant (Content Blocks)

**Use for**: List pages, feed pages, general content

```tsx
if (loading) {
  return <PageSkeleton variant="default" itemCount={6} />
}
```

**Example pages**:
- Giải trình list
- Xin nghỉ list
- Feedback list

---

### 2. Table Variant

**Use for**: Data tables, spreadsheet-like layouts

```tsx
if (loading) {
  return <PageSkeleton variant="table" itemCount={8} />
}
```

**Example pages**:
- Training stats
- Assignment results
- Teacher schedules

---

### 3. Grid Variant

**Use for**: Card grids, gallery layouts

```tsx
if (loading) {
  return <PageSkeleton variant="grid" itemCount={9} />
}
```

**Example pages**:
- Training lessons (video cards)
- Post grid
- Assignment cards

---

### 4. Form Variant

**Use for**: Form pages, settings pages

```tsx
if (loading) {
  return <PageSkeleton variant="form" itemCount={5} />
}
```

**Example pages**:
- Profile edit
- Settings
- Create/edit forms

---

## 📊 Migration Checklist

### Pages to Update:

#### ❌ No Loading State (Priority 1):
- [ ] `app/user/training/page.tsx` - Add grid skeleton for lessons
- [ ] `app/user/dang-ky-lich-lam-viec/page.tsx` - Add table skeleton
- [ ] `app/user/hoat-dong-hang-thang/page.tsx` - Add default skeleton
- [ ] `app/user/quan-ly-phan-hoi/page.tsx` - Add default skeleton
- [ ] `app/user/nhan-lop-1-buoi/page.tsx` - Add table skeleton

#### ⚠️ Partial Loading (Priority 2):
- [ ] `app/user/truyenthong/page.tsx` - Fix partial skeleton (header shows immediately)
- [ ] `app/user/assignments/page.tsx` - Standardize skeleton

#### ✅ Has Loading but Needs Standardization (Priority 3):
- [ ] `app/user/giaithich/page.tsx` - Use PageSkeleton instead of custom
- [ ] `app/user/giaitrinh/page.tsx` - Use PageSkeleton instead of custom
- [ ] `app/user/xin-nghi-mot-buoi/page.tsx` - Use PageSkeleton instead of custom

---

## 🔧 Implementation Steps

### Step 1: Import PageSkeleton

```tsx
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
```

### Step 2: Identify Loading State

```tsx
const { data, isLoading } = useSWR('/api/data')
// or
const [loading, setLoading] = useState(true)
```

### Step 3: Add Skeleton Return

```tsx
if (isLoading || loading) {
  return <PageSkeleton variant="grid" itemCount={6} />
}
```

### Step 4: Ensure Layout Consistency

Make sure skeleton uses same `maxWidth` and `padding` as actual content:

```tsx
// Skeleton
<PageSkeleton variant="grid" maxWidth="7xl" padding="md" />

// Actual content
<PageLayout maxWidth="7xl" padding="md">
  {/* Content */}
</PageLayout>
```

---

## 🎯 Success Criteria

### ✅ A page has consistent loading when:

1. **Full skeleton**: Toàn bộ page là skeleton, không có phần nào render trước
2. **Layout match**: Skeleton có cùng maxWidth, padding với actual content
3. **Variant match**: Skeleton variant match với content type (grid cho cards, table cho tables)
4. **Smooth transition**: Chuyển từ skeleton → content không có layout shift
5. **Error handling**: Error state cũng dùng cùng layout

---

## 📝 Examples

### Example 1: Training Page (Grid of Video Cards)

```tsx
export default function TrainingPage() {
  const { data: lessons, isLoading } = useSWR('/api/training')
  
  if (isLoading) {
    return <PageSkeleton variant="grid" itemCount={12} />
  }
  
  return (
    <PageContainer title="Đào Tạo Nâng Cao">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lessons.map(lesson => (
          <VideoCard key={lesson.id} lesson={lesson} />
        ))}
      </div>
    </PageContainer>
  )
}
```

### Example 2: Explanation List (Default Blocks)

```tsx
export default function ExplanationPage() {
  const [loading, setLoading] = useState(true)
  const [explanations, setExplanations] = useState([])
  
  useEffect(() => {
    fetchExplanations().then(data => {
      setExplanations(data)
      setLoading(false)
    })
  }, [])
  
  if (loading) {
    return <PageSkeleton variant="default" itemCount={8} />
  }
  
  return (
    <PageLayout>
      <PageLayoutContent spacing="lg">
        <div>
          <h1>Giải Trình</h1>
          <p>Quản lý giải trình</p>
        </div>
        
        <div className="space-y-4">
          {explanations.map(item => (
            <ExplanationCard key={item.id} data={item} />
          ))}
        </div>
      </PageLayoutContent>
    </PageLayout>
  )
}
```

### Example 3: Schedule Table

```tsx
export default function SchedulePage() {
  const { data, isLoading } = useSWR('/api/schedule')
  
  if (isLoading) {
    return <PageSkeleton variant="table" itemCount={10} />
  }
  
  return (
    <PageLayout>
      <PageLayoutContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Class</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(row => (
              <TableRow key={row.id}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.time}</TableCell>
                <TableCell>{row.class}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </PageLayoutContent>
    </PageLayout>
  )
}
```

---

## 🚀 Benefits

### Before Standardization:
- ❌ Inconsistent loading experience
- ❌ Content flash (render một phần trước)
- ❌ Layout shift khi load xong
- ❌ Confusing UX (mỗi page khác nhau)

### After Standardization:
- ✅ Consistent loading experience
- ✅ No content flash
- ✅ No layout shift
- ✅ Professional UX
- ✅ Easier maintenance (1 component thay vì nhiều custom skeletons)

---

## 📞 Next Steps

1. ✅ Create PageSkeleton component
2. ⏳ Update all pages to use PageSkeleton
3. ⏳ Test all loading states
4. ⏳ Document patterns for new pages
5. ⏳ Train team on new patterns

---

**Status**: 🟡 In Progress  
**Priority**: 🔴 High  
**Impact**: 🟢 High (affects all pages)

