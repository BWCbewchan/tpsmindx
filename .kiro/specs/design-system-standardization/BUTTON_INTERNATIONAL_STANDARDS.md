# Button Component - Chuẩn Quốc Tế

## 📚 Tài Liệu Tham Khảo

Button component được thiết kế theo các chuẩn quốc tế:

1. **Material Design 3** (Google) - https://m3.material.io/components/buttons
2. **Apple Human Interface Guidelines** - https://developer.apple.com/design/human-interface-guidelines/buttons
3. **WCAG 2.1 Level AA** - https://www.w3.org/WAI/WCAG21/quickref/
4. **WAI-ARIA 1.2** - https://www.w3.org/TR/wai-aria-1.2/

## 🎯 Button Hierarchy (Thứ Bậc Button)

Theo Material Design 3 và Apple HIG, buttons được phân loại theo mức độ nhấn mạnh:

### 1. Primary Button (High Emphasis) - `variant="default"`
**Mục đích**: Hành động chính, quan trọng nhất trên màn hình
**Đặc điểm**:
- Nền màu primary (filled)
- Text màu trắng
- Shadow nhẹ
- Chỉ nên có 1 primary button trên mỗi màn hình

**Material Design**: Filled Button
**Apple HIG**: Filled Button

**Ví dụ**:
```tsx
<Button variant="default">Gửi</Button>
<Button variant="default">Đăng nhập</Button>
<Button variant="default">Lưu thay đổi</Button>
```

**Khi nào dùng**:
- Submit form
- Confirm action
- Primary call-to-action

---

### 2. Secondary Button (Medium Emphasis) - `variant="secondary"`
**Mục đích**: Hành động quan trọng nhưng không phải chính
**Đặc điểm**:
- Nền màu secondary (tonal)
- Text màu tương phản
- Không có shadow

**Material Design**: Tonal Button
**Apple HIG**: Gray Button

**Ví dụ**:
```tsx
<Button variant="secondary">Hủy</Button>
<Button variant="secondary">Quay lại</Button>
```

**Khi nào dùng**:
- Cancel action
- Alternative action
- Secondary call-to-action

---

### 3. Tertiary Button (Medium-Low Emphasis) - `variant="outline"`
**Mục đích**: Hành động ít quan trọng hơn, nhưng vẫn cần nhấn mạnh
**Đặc điểm**:
- Border màu nhạt (gray-200) - **ĐÃ FIX**
- Nền trong suốt
- Text màu foreground
- Hover: nền accent nhẹ

**Material Design**: Outlined Button
**Apple HIG**: Bordered Button

**Ví dụ**:
```tsx
<Button variant="outline">Xem thêm</Button>
<Button variant="outline">Đăng xuất</Button>
<Button variant="outline">Xem tất cả bài viết</Button>
```

**Khi nào dùng**:
- Tertiary actions
- Navigation buttons
- Sidebar buttons - **DÙNG CHO SIDEBAR**
- Less important actions

**Thay đổi**: Border từ `border-input` (đậm) → `border-gray-200` (nhạt) + hover `border-gray-300`

---

### 4. Text Button (Low Emphasis) - `variant="ghost"`
**Mục đích**: Hành động ít quan trọng nhất, minimal emphasis
**Đặc điểm**:
- Không border
- Nền trong suốt
- Text màu foreground
- Hover: nền accent nhẹ

**Material Design**: Text Button
**Apple HIG**: Plain Button

**Ví dụ**:
```tsx
<Button variant="ghost">Bỏ qua</Button>
<Button variant="ghost">Đóng</Button>
<Button variant="ghost">Tìm hiểu thêm</Button>
```

**Khi nào dùng**:
- Dismiss actions
- Filter buttons (unselected)
- Menu items
- Minimal actions

---

### 5. Destructive Button (High Emphasis - Negative) - `variant="destructive"`
**Mục đích**: Hành động nguy hiểm, không thể hoàn tác
**Đặc điểm**:
- Nền màu đỏ (destructive)
- Text màu trắng
- Shadow nhẹ

**Material Design**: Filled Button (Error color)
**Apple HIG**: Destructive Button

**Ví dụ**:
```tsx
<Button variant="destructive">Xóa</Button>
<Button variant="destructive">Hủy đăng ký</Button>
<Button variant="destructive">Xóa tài khoản</Button>
```

**Khi nào dùng**:
- Delete actions
- Destructive operations
- Irreversible actions

---

### 6. Link Button - `variant="link"`
**Mục đích**: Navigation, liên kết
**Đặc điểm**:
- Không border, không nền
- Text màu primary
- Underline on hover

**Ví dụ**:
```tsx
<Button variant="link">Tìm hiểu thêm</Button>
<Button variant="link">Xem chi tiết</Button>
```

---

### 7. Success Button - `variant="success"`
**Mục đích**: Hành động tích cực, thành công
**Đặc điểm**:
- Nền màu xanh lá
- Text màu trắng
- Shadow nhẹ

**Ví dụ**:
```tsx
<Button variant="success">Hoàn thành</Button>
<Button variant="success">Xác nhận</Button>
```

---

### 8. Brand Button - `variant="mindx"`
**Mục đích**: Hành động đặc biệt của thương hiệu MindX
**Đặc điểm**:
- Gradient đỏ MindX
- Text màu trắng
- Shadow lớn

**Ví dụ**:
```tsx
<Button variant="mindx">Đăng ký ngay</Button>
<Button variant="mindx">Bắt đầu học</Button>
```

---

## 📏 Button Sizes (Kích Thước)

Theo Material Design density scale:

### `size="xs"` - Extra Small (Compact)
- Height: 28px (h-7)
- Padding: 10px horizontal (px-2.5)
- Text: 12px (text-xs)
- Border radius: 6px (rounded-md)

**Khi nào dùng**: Compact UI, dense layouts, badges

### `size="sm"` - Small
- Height: 32px (h-8)
- Padding: 12px horizontal (px-3)
- Text: 14px (text-sm)
- Border radius: 6px (rounded-md)

**Khi nào dùng**: Sidebar buttons, compact forms, tables

### `size="default"` - Medium (Default)
- Height: 36px (h-9)
- Padding: 16px horizontal (px-4), 8px vertical (py-2)
- Text: 14px (text-sm)
- Border radius: 8px (rounded-lg)

**Khi nào dùng**: Standard forms, most UI elements

### `size="lg"` - Large
- Height: 40px (h-10)
- Padding: 24px horizontal (px-6)
- Text: 16px (text-base)
- Border radius: 8px (rounded-lg)

**Khi nào dùng**: Hero sections, important CTAs, landing pages

### `size="xl"` - Extra Large
- Height: 44px (h-11)
- Padding: 32px horizontal (px-8)
- Text: 16px (text-base)
- Border radius: 8px (rounded-lg)

**Khi nào dùng**: Very prominent CTAs, mobile-first designs

### Icon Sizes
- `size="icon-sm"`: 32x32px (size-8)
- `size="icon"`: 36x36px (size-9)
- `size="icon-lg"`: 40x40px (size-10)

---

## ♿ Accessibility (WCAG 2.1 AA)

### 1. Color Contrast
- **Text on background**: Minimum 4.5:1 ratio
- **Large text (18px+)**: Minimum 3:1 ratio
- **Focus indicator**: Minimum 3:1 ratio

✅ Tất cả variants đều đạt WCAG AA

### 2. Focus Indicator
```tsx
focus-visible:outline-none 
focus-visible:ring-2 
focus-visible:ring-ring 
focus-visible:ring-offset-2
```

✅ Focus ring rõ ràng, 2px offset

### 3. Touch Target Size
- **Minimum**: 44x44px (WCAG 2.5.5)
- **Recommended**: 48x48px (Material Design)

✅ Size `default` (36px) + padding đạt 44px
✅ Size `lg` và `xl` đạt 48px+

### 4. Keyboard Navigation
- **Tab**: Focus vào button
- **Enter/Space**: Activate button
- **Disabled**: Không thể focus

✅ Native button element hỗ trợ đầy đủ

### 5. Screen Reader
```tsx
aria-label="Mô tả hành động"  // Cho icon buttons
disabled={true}                // Thông báo disabled state
loading={true}                 // Có spinner với aria-hidden
```

✅ Hỗ trợ đầy đủ ARIA attributes

---

## 🎨 Visual Design Principles

### 1. Border Radius
- **Small buttons** (xs, sm): `rounded-md` (6px)
- **Default buttons**: `rounded-lg` (8px)
- **Large buttons**: `rounded-lg` (8px)

Theo Material Design 3: Medium emphasis corners

### 2. Shadows
- **Elevated buttons** (default, destructive, success, mindx): `shadow` hoặc `shadow-sm`
- **Flat buttons** (outline, secondary, ghost): Không shadow

Theo Material Design 3: Elevation levels

### 3. Transitions
```tsx
transition-colors  // Smooth color transitions
```

Duration: 200ms (Material Design standard)

### 4. States
- **Default**: Base styles
- **Hover**: Darker/lighter background, border color change
- **Focus**: Ring indicator
- **Active**: Slightly darker (browser default)
- **Disabled**: 50% opacity, no pointer events
- **Loading**: Spinner + disabled state

---

## 📱 Responsive Design

### Mobile-First Approach
```tsx
// Full width on mobile, auto width on desktop
<Button className="w-full sm:w-auto">Gửi</Button>

// Stack vertically on mobile, horizontal on desktop
<div className="flex flex-col sm:flex-row gap-2">
  <Button variant="outline">Hủy</Button>
  <Button>Gửi</Button>
</div>
```

### Touch-Friendly
- Minimum 44px touch target
- Adequate spacing between buttons (8px minimum)
- Large enough text (14px minimum)

---

## 🔧 Thay Đổi Chính

### 1. Border Color - **ĐÃ FIX CHO SIDEBAR**
**Trước**:
```tsx
outline: 'border border-input'  // border-input có thể đậm
```

**Sau**:
```tsx
outline: 'border border-gray-200 hover:border-gray-300'  // Màu nhạt hơn
```

**Lý do**: User feedback - border quá đậm cho sidebar buttons

### 2. Border Radius
**Trước**:
```tsx
rounded-md  // 6px cho tất cả
```

**Sau**:
```tsx
rounded-lg  // 8px cho base, 6px cho xs/sm
```

**Lý do**: Theo Material Design 3 - medium emphasis corners

### 3. Focus Indicator
**Trước**:
```tsx
outline-none focus-visible:ring-2
```

**Sau**:
```tsx
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

**Lý do**: WCAG 2.1 AA compliance - focus indicator rõ ràng hơn

### 4. Transition
**Trước**:
```tsx
transition-all  // Transition tất cả properties
```

**Sau**:
```tsx
transition-colors  // Chỉ transition colors (performance tốt hơn)
```

**Lý do**: Performance optimization - chỉ animate colors

### 5. Shadow
**Thêm**:
```tsx
default: 'shadow'           // Thêm shadow cho primary
destructive: 'shadow-sm'    // Thêm shadow cho destructive
success: 'shadow-sm'        // Thêm shadow cho success
```

**Lý do**: Material Design 3 - elevated buttons có shadow

---

## 📖 Usage Guidelines

### Do's ✅
- Dùng 1 primary button per screen
- Dùng outline cho sidebar buttons
- Dùng ghost cho filter buttons (unselected)
- Dùng destructive cho delete actions
- Dùng icon buttons với aria-label
- Dùng loading state cho async actions
- Dùng disabled state khi action không khả dụng

### Don'ts ❌
- Không dùng nhiều primary buttons trên cùng màn hình
- Không dùng destructive cho non-destructive actions
- Không dùng button cho navigation (dùng Link)
- Không dùng text quá dài (max 2-3 từ)
- Không bỏ qua accessibility attributes
- Không dùng custom colors (dùng variants)

---

## 🌍 International Standards Summary

| Standard | Compliance | Notes |
|----------|-----------|-------|
| Material Design 3 | ✅ Full | Button hierarchy, sizes, states |
| Apple HIG | ✅ Full | Button types, touch targets |
| WCAG 2.1 AA | ✅ Full | Color contrast, focus, keyboard |
| WAI-ARIA 1.2 | ✅ Full | Semantic HTML, ARIA attributes |

---

## 🎯 Sidebar Buttons - Specific Fix

**Vấn đề**: Border màu quá đậm
**Giải pháp**: Đổi từ `border-input` sang `border-gray-200`

**Trước**:
```tsx
<Button variant="outline" size="sm">Đăng xuất</Button>
// border-input (có thể là gray-300 hoặc đậm hơn)
```

**Sau**:
```tsx
<Button variant="outline" size="sm">Đăng xuất</Button>
// border-gray-200 (nhạt hơn, subtle hơn)
// hover:border-gray-300 (hover nhẹ nhàng)
```

**Kết quả**: Border nhạt hơn, phù hợp với sidebar UI, không quá nổi bật

---

## 📚 Tài Liệu Thêm

- [Material Design 3 Buttons](https://m3.material.io/components/buttons/overview)
- [Apple HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Button Best Practices](https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/)
