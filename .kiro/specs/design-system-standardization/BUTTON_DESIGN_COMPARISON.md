# So Sánh Thiết Kế Button

## 🎨 Button Cũ (Trước Migration)

### Button "Đăng xuất" (Sidebar)
```tsx
className="group flex w-full items-center justify-center gap-2 
  rounded-lg          // Bo góc 8px
  border-2            // Border dày 2px
  border-gray-200     // Border màu xám nhạt
  bg-white            // Nền trắng
  px-3 py-2           // Padding: 12px ngang, 8px dọc
  text-xs             // Text size 12px (0.75rem)
  font-semibold       // Font weight 600
  text-gray-700       // Text màu xám đậm
  transition-all duration-300
  hover:border-[#a1001f]  // Hover: border đỏ MindX
  hover:bg-[#a1001f]      // Hover: nền đỏ MindX
  hover:text-white        // Hover: text trắng
  hover:shadow-md"
```

**Đặc điểm**:
- ✅ Border dày (2px) rõ ràng
- ✅ Text nhỏ (xs = 12px)
- ✅ Padding vừa phải (px-3 py-2)
- ✅ Bo góc vừa (rounded-lg = 8px)
- ✅ Hover effect mạnh (đổi màu hoàn toàn)

### Button "Xem tất cả bài viết" (Slider Sidebar)
```tsx
className="flex items-center justify-center gap-2 w-full 
  py-3 px-4           // Padding: 16px ngang, 12px dọc
  bg-white            // Nền trắng
  hover:bg-gray-900   // Hover: nền đen
  text-gray-900       // Text đen
  hover:text-white    // Hover: text trắng
  font-bold           // Font weight 700
  rounded-xl          // Bo góc 12px
  transition-all duration-200
  border border-gray-200
  hover:border-gray-900
  shadow-sm
  hover:shadow-md"
```

**Đặc điểm**:
- ✅ Border mỏng (1px)
- ✅ Text bold
- ✅ Padding lớn hơn (py-3 px-4)
- ✅ Bo góc lớn (rounded-xl = 12px)
- ✅ Hover effect mạnh (đổi sang đen)

### Filter Buttons (Truyenthong Page)
```tsx
// Selected
className="px-4 py-2 rounded-xl text-sm font-semibold
  bg-gray-900 text-white shadow-md"

// Unselected  
className="px-4 py-2 rounded-xl text-sm font-semibold
  bg-transparent text-gray-600 hover:bg-gray-100"
```

**Đặc điểm**:
- ✅ Text size sm (14px)
- ✅ Padding vừa (px-4 py-2)
- ✅ Bo góc lớn (rounded-xl = 12px)
- ✅ Selected: nền đen, unselected: trong suốt

## 🆕 Button Mới (Sau Migration - Hiện tại)

### Button Component Variants

```tsx
// Base styles
"rounded-md text-sm font-medium"

// Sizes
xs: 'h-7 px-2 text-xs'      // Height 28px, padding 8px, text 12px
sm: 'h-8 px-3'               // Height 32px, padding 12px, text 14px (inherit)
default: 'h-9 px-4'          // Height 36px, padding 16px, text 14px
lg: 'h-10 px-6 text-base'    // Height 40px, padding 24px, text 16px

// Variants
outline: 'border border-input bg-background hover:bg-accent'
ghost: 'hover:bg-accent hover:text-accent-foreground'
default: 'bg-primary text-primary-foreground hover:bg-primary/90'
```

**Đặc điểm**:
- ⚠️ Border mỏng (1px) - User muốn dày hơn
- ⚠️ Text size sm (14px) - User muốn nhỏ hơn (12px)
- ⚠️ Bo góc nhỏ (rounded-md = 6px) - User muốn lớn hơn (8-12px)
- ⚠️ Hover effect nhẹ (chỉ đổi opacity/màu nhạt)

## 🎯 Vấn Đề User Báo Cáo

1. **Border quá mỏng**: Button outline hiện tại dùng `border` (1px), user muốn `border-2` (2px)
2. **Text size hơi to**: Button hiện tại dùng `text-sm` (14px), user muốn `text-xs` (12px)
3. **Bo góc**: Button hiện tại dùng `rounded-md` (6px), user muốn `rounded-lg` (8px) hoặc `rounded-xl` (12px)

## 💡 Giải Pháp

### Option 1: Tạo Custom Variant Mới
Tạo variant `outline-bold` với border dày hơn:

```tsx
variants: {
  variant: {
    // ... existing variants
    'outline-bold': 'border-2 border-gray-200 bg-white hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white shadow-sm hover:shadow-md',
  }
}
```

### Option 2: Điều Chỉnh Variant Outline Hiện Tại
Thay đổi `outline` variant để match thiết kế cũ:

```tsx
outline: 'border-2 border-gray-200 bg-white hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white transition-all duration-300'
```

### Option 3: Tạo Size Mới
Tạo size phù hợp với thiết kế cũ:

```tsx
sizes: {
  // ... existing sizes
  'sidebar': 'h-8 px-3 py-2 text-xs rounded-lg',  // Cho sidebar buttons
  'filter': 'h-9 px-4 py-2 text-sm rounded-xl',   // Cho filter buttons
}
```

### Option 4: Override Với className
Giữ nguyên Button component, override với className:

```tsx
<Button 
  variant="outline" 
  size="sm"
  className="border-2 text-xs rounded-lg hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white"
>
  Đăng xuất
</Button>
```

## 🤔 Câu Hỏi Cho User

1. **Border**: Bạn muốn tất cả outline buttons có border dày (2px), hay chỉ một số buttons đặc biệt?

2. **Text size**: Bạn muốn text size mặc định là `xs` (12px) thay vì `sm` (14px)?

3. **Bo góc**: Bạn muốn bo góc là `rounded-lg` (8px) hay `rounded-xl` (12px)?

4. **Hover effect**: Bạn có muốn giữ hover effect mạnh (đổi màu hoàn toàn) như button cũ không?

5. **Consistency**: Bạn muốn tất cả buttons trong website có cùng style, hay mỗi loại button (sidebar, filter, form) có style riêng?

## 📋 Các Loại Button Đang Dùng Trong Website

### 1. Sidebar Buttons
- **Vị trí**: Sidebar navigation, user profile
- **Style cũ**: Border 2px, text xs, rounded-lg, hover đổi màu đỏ
- **Ví dụ**: "Đăng xuất", "Xem tất cả bài viết"

### 2. Filter Buttons
- **Vị trí**: Truyenthong page, danh sách
- **Style cũ**: Text sm, rounded-xl, selected = đen, unselected = ghost
- **Ví dụ**: "Tất cả", "Tin tức", "Chính sách"

### 3. Form Buttons
- **Vị trí**: Login, forms, modals
- **Style cũ**: Padding lớn, text base, rounded-lg, màu MindX
- **Ví dụ**: "Đăng nhập", "Gửi", "Hủy"

### 4. Navigation Buttons
- **Vị trí**: 404 page, navigation
- **Style cũ**: Padding lớn, gradient MindX, shadow
- **Ví dụ**: "Về trang chủ", "Quay lại"

### 5. Action Buttons
- **Vị trí**: Tables, cards, lists
- **Style cũ**: Icon + text, size sm, outline hoặc ghost
- **Ví dụ**: "Chỉnh sửa", "Xóa", "Xem chi tiết"

## 🎨 Đề Xuất Thiết Kế Mới

### Variant: outline-sidebar
```tsx
'outline-sidebar': 'border-2 border-gray-200 bg-white text-gray-700 hover:border-[#a1001f] hover:bg-[#a1001f] hover:text-white shadow-sm hover:shadow-md transition-all duration-300'
```

### Variant: filter
```tsx
'filter': 'rounded-xl text-sm font-semibold data-[selected=true]:bg-gray-900 data-[selected=true]:text-white data-[selected=false]:bg-transparent data-[selected=false]:text-gray-600 data-[selected=false]:hover:bg-gray-100'
```

### Size: compact
```tsx
'compact': 'h-8 px-3 py-2 text-xs rounded-lg'
```

Bạn muốn thiết kế button như thế nào? Tôi sẽ cập nhật Button component theo ý bạn! 🎨
