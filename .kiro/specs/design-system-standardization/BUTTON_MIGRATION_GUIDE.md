# Hướng Dẫn Migration Button Components

## Vấn Đề Hiện Tại

Các button trong ứng dụng đang có những vấn đề sau:

### 1. Không Nhất Quán (Inconsistent)
- Button "Xem tất cả bài viết": hover → màu xanh đen (gray-900)
- Button "Đăng xuất": hover → màu đỏ (#a1001f)
- Mỗi button có styling riêng, không theo design system

### 2. Không Tái Sử Dụng (Not Reusable)
- Mỗi button được viết inline với className dài
- Duplicate code ở nhiều nơi
- Khó maintain và update

### 3. Không Theo Design System
- Không sử dụng component Button đã chuẩn hóa
- Không sử dụng design tokens
- Không có variants nhất quán

## Giải Pháp: Sử dụng Button Component Chuẩn Hóa

### Button Component Đã Có

Component Button đã được chuẩn hóa với các variants:

```typescript
// components/ui/button.tsx
<Button variant="default">Mặc định</Button>
<Button variant="destructive">Xóa/Đăng xuất</Button>
<Button variant="outline">Viền</Button>
<Button variant="secondary">Phụ</Button>
<Button variant="ghost">Trong suốt</Button>
<Button variant="link">Liên kết</Button>
<Button variant="success">Thành công</Button>
<Button variant="mindx">MindX Brand</Button>
```

### Sizes Available

```typescript
<Button size="xs">Rất nhỏ</Button>
<Button size="sm">Nhỏ</Button>
<Button size="default">Mặc định</Button>
<Button size="lg">Lớn</Button>
```

## Migration Examples

### Example 1: Button "Đăng xuất"

**Trước (Inconsistent):**
```tsx
<button
  className="group flex w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-all duration-300 hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a1001f] focus-visible:ring-offset-2"
  onClick={() => {
    closeSidebarOnMobile()
    logout()
  }}
>
  <LogOut className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
  <span>Đăng Xuất</span>
</button>
```

**Sau (Consistent với Design System):**
```tsx
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
import { LogOut } from 'lucide-react'

<Button
  variant="outline"
  size="sm"
  className="w-full"
  onClick={() => {
    closeSidebarOnMobile()
    logout()
  }}
>
  <Icon icon={LogOut} size="sm" />
  Đăng xuất
</Button>
```

**Hoặc nếu muốn nhấn mạnh action nguy hiểm:**
```tsx
<Button
  variant="destructive"
  size="sm"
  className="w-full"
  onClick={() => {
    closeSidebarOnMobile()
    logout()
  }}
>
  <Icon icon={LogOut} size="sm" />
  Đăng xuất
</Button>
```

### Example 2: Button "Xem tất cả bài viết"

**Trước (Inconsistent):**
```tsx
<Link
  href="/user/truyenthong"
  className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white hover:bg-gray-900 text-gray-900 hover:text-white font-bold rounded-xl transition-all duration-200 border border-gray-200 hover:border-gray-900 shadow-sm hover:shadow-md group"
>
  <span>Xem tất cả bài viết</span>
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
    <path d="M5 12h14"/>
    <path d="m12 5 7 7-7 7"/>
  </svg>
</Link>
```

**Sau (Consistent với Design System):**
```tsx
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
import { ArrowRight } from 'lucide-react'

<Button
  variant="outline"
  className="w-full"
  asChild
>
  <Link href="/user/truyenthong">
    Xem tất cả bài viết
    <Icon icon={ArrowRight} size="sm" />
  </Link>
</Button>
```

**Hoặc sử dụng variant default:**
```tsx
<Button
  variant="default"
  className="w-full"
  asChild
>
  <Link href="/user/truyenthong">
    Xem tất cả bài viết
    <Icon icon={ArrowRight} size="sm" />
  </Link>
</Button>
```

## Quy Tắc Chọn Variant

### 1. `variant="default"` (Primary Action)
- Hành động chính, quan trọng nhất
- Ví dụ: "Gửi", "Lưu", "Đăng ký", "Thanh toán"

### 2. `variant="destructive"` (Dangerous Action)
- Hành động nguy hiểm, không thể hoàn tác
- Ví dụ: "Xóa", "Đăng xuất", "Hủy đăng ký"

### 3. `variant="outline"` (Secondary Action)
- Hành động phụ, ít quan trọng hơn
- Ví dụ: "Hủy", "Quay lại", "Xem thêm"

### 4. `variant="ghost"` (Tertiary Action)
- Hành động không nổi bật
- Ví dụ: Icon buttons, menu items

### 5. `variant="link"` (Navigation)
- Liên kết, điều hướng
- Ví dụ: "Tìm hiểu thêm", "Xem chi tiết"

### 6. `variant="mindx"` (Brand Action)
- Hành động đặc biệt của MindX
- Ví dụ: "Đăng ký ngay", "Bắt đầu học"

## Icon Placement Rules

### Icon ở Bên Trái (Default)
```tsx
<Button>
  <Icon icon={Save} size="sm" />
  Lưu thay đổi
</Button>
```

### Icon ở Bên Phải (Directional)
```tsx
<Button>
  Tiếp theo
  <Icon icon={ArrowRight} size="sm" />
</Button>
```

## Migration Checklist

Khi migrate button, kiểm tra:

- [ ] Sử dụng component `Button` từ `@/components/ui/button`
- [ ] Chọn variant phù hợp với action
- [ ] Sử dụng `Icon` component thay vì SVG inline
- [ ] Icon ở trái (default) hoặc phải (directional)
- [ ] Text sử dụng tiếng Việt với sentence case
- [ ] Sử dụng `asChild` prop cho Link components
- [ ] Xóa inline className dài, chỉ giữ className cần thiết

## Common Patterns

### Pattern 1: Button với Link
```tsx
<Button variant="outline" asChild>
  <Link href="/path">Xem chi tiết</Link>
</Button>
```

### Pattern 2: Button với Icon
```tsx
<Button variant="default">
  <Icon icon={Check} size="sm" />
  Xác nhận
</Button>
```

### Pattern 3: Button Loading
```tsx
<Button loading>Đang tải</Button>
```

### Pattern 4: Button Disabled
```tsx
<Button disabled>Không khả dụng</Button>
```

### Pattern 5: Full Width Button
```tsx
<Button className="w-full">Gửi</Button>
```

## Benefits of Migration

### 1. Consistency (Nhất quán)
- Tất cả buttons có giao diện và hành vi giống nhau
- Hover states nhất quán
- Focus states nhất quán

### 2. Maintainability (Dễ bảo trì)
- Thay đổi một lần ở Button component
- Tự động áp dụng cho tất cả buttons
- Ít code hơn, dễ đọc hơn

### 3. Accessibility (Khả năng tiếp cận)
- Focus rings chuẩn
- Keyboard navigation
- Screen reader support

### 4. Performance (Hiệu suất)
- Ít CSS duplicate
- Tối ưu hóa bundle size

## Next Steps

1. Identify tất cả buttons trong ứng dụng
2. Phân loại theo variant phù hợp
3. Migrate từng button một
4. Test hover, focus, disabled states
5. Verify Vietnamese content

## Files Cần Migration

### ✅ Đã Hoàn Thành
1. ✅ `components/sidebar.tsx` - Button "Đăng xuất" (đã refactor + thêm imports)
2. ✅ `components/slider-sidebar.tsx` - Button "Xem tất cả bài viết" (đã refactor)

### 🔄 Đang Thực Hiện
3. `app/user/truyenthong/page.tsx` - Filter buttons (7 buttons: Tất cả, Tin tức, Chính sách, Sự kiện, Đào tạo, Báo cáo, Thông báo)
4. `app/not-found.tsx` - 2 buttons: "Về trang Admin/của tôi/đăng nhập", "Quay lại"
5. `app/login/page.tsx` - 3 buttons: "Giáo viên", "Quản lý", "Đăng nhập", toggle password button

### ⏳ Chưa Thực Hiện
6. `app/user/dang-ky-lich-lam-viec/page.tsx` - Calendar navigation buttons, action buttons
7. `app/analytics/page.tsx` - Retry buttons
8. `app/lichgiaovien/page.tsx` - Teacher selection buttons, region/program filters
9. `app/rawdata/page.tsx` - Search button, modal close button
10. `app/training-test/page.tsx` - Fetch data button
11. `app/checkdatasource/page.tsx` - Navigation buttons, submit button
12. `app/public/training-detail/[code]/page.tsx` - Tab buttons
13. `app/test-teachers/page.tsx` - Test button
14. `app/course-links-test/page.tsx` - Fetch button

### 📝 Không Cần Migration (Example Files)
- `components/ui/button.example.tsx` - Example file
- `components/ui/primitives/*.example.tsx` - Example files
- `components/RichTextEditor.tsx` - Editor controls (special case)
- `components/ImageLightbox.tsx` - Lightbox controls (special case)
- `components/ConfirmDialog.tsx` - Dialog component (already styled)

## Support

Nếu có câu hỏi về việc chọn variant hoặc migration, tham khảo:
- `components/ui/button.example.tsx` - 100+ button examples
- `components/ui/button.tsx` - Button component source
- Design system documentation
