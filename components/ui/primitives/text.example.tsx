/**
 * Text Component Usage Examples
 * 
 * The Text component is a primitive typography component with consistent styling.
 * It follows the 1.250 (Major Third) typography scale for mathematical consistency.
 */

import { Text } from './text'

// Example 1: Basic usage with different sizes
export function TextSizesExample() {
  return (
    <div className="space-y-2">
      <Text size="xs">Extra small text (10.24px)</Text>
      <Text size="sm">Small text (12.8px)</Text>
      <Text size="base">Base text (16px)</Text>
      <Text size="lg">Large text (20px)</Text>
      <Text size="xl">Extra large text (25px)</Text>
    </div>
  )
}

// Example 2: Different font weights
export function TextWeightsExample() {
  return (
    <div className="space-y-2">
      <Text weight="light">Light weight text</Text>
      <Text weight="normal">Normal weight text</Text>
      <Text weight="medium">Medium weight text</Text>
      <Text weight="semibold">Semibold weight text</Text>
      <Text weight="bold">Bold weight text</Text>
    </div>
  )
}

// Example 3: Different color variants
export function TextColorsExample() {
  return (
    <div className="space-y-2">
      <Text color="primary">Primary text color</Text>
      <Text color="secondary">Secondary text color</Text>
      <Text color="muted">Muted text color</Text>
      <Text color="disabled">Disabled text color</Text>
      <Text color="error">Error text color</Text>
      <Text color="success">Success text color</Text>
      <Text color="warning">Warning text color</Text>
      <Text color="info">Info text color</Text>
    </div>
  )
}

// Example 4: Combining variants
export function TextCombinedExample() {
  return (
    <div className="space-y-2">
      <Text size="lg" weight="bold" color="primary">
        Tiêu đề lớn và đậm
      </Text>
      <Text size="sm" weight="medium" color="secondary">
        Văn bản phụ nhỏ hơn
      </Text>
      <Text size="xs" color="muted">
        Văn bản gợi ý rất nhỏ
      </Text>
    </div>
  )
}

// Example 5: Polymorphic rendering with asChild
export function TextPolymorphicExample() {
  return (
    <div className="space-y-2">
      <Text asChild size="lg" weight="semibold">
        <a href="/link" className="hover:underline">
          Liên kết với kiểu chữ tùy chỉnh
        </a>
      </Text>
      <Text asChild color="error">
        <label htmlFor="email">Địa chỉ email *</label>
      </Text>
    </div>
  )
}

// Example 6: Vietnamese content examples
export function TextVietnameseExample() {
  return (
    <div className="space-y-4">
      <div>
        <Text size="lg" weight="bold" color="primary">
          Chào mừng đến với MindX
        </Text>
        <Text size="sm" color="secondary">
          Nền tảng học lập trình hàng đầu Việt Nam
        </Text>
      </div>
      
      <div>
        <Text color="success">Cập nhật hồ sơ thành công</Text>
        <Text color="error">Email là bắt buộc</Text>
        <Text color="warning">Mật khẩu phải có ít nhất 8 ký tự</Text>
        <Text color="info">Vui lòng kiểm tra email của bạn</Text>
      </div>
      
      <div>
        <Text size="xs" color="muted">
          Chúng tôi sẽ không bao giờ chia sẻ email của bạn
        </Text>
      </div>
    </div>
  )
}

// Example 7: Form field labels and helper text
export function TextFormExample() {
  return (
    <div className="space-y-4">
      <div>
        <Text weight="medium" className="mb-1">
          Địa chỉ email
        </Text>
        <input
          type="email"
          placeholder="nhập email của bạn"
          className="w-full px-3 py-2 border rounded"
        />
        <Text size="sm" color="muted" className="mt-1">
          Chúng tôi sẽ gửi mã xác nhận đến email này
        </Text>
      </div>
      
      <div>
        <Text weight="medium" className="mb-1">
          Mật khẩu
          <Text color="error" className="ml-1">*</Text>
        </Text>
        <input
          type="password"
          className="w-full px-3 py-2 border rounded"
        />
        <Text size="sm" color="error" className="mt-1">
          Mật khẩu phải có ít nhất 8 ký tự
        </Text>
      </div>
    </div>
  )
}

// Example 8: Empty state messages
export function TextEmptyStateExample() {
  return (
    <div className="text-center py-12">
      <Text size="lg" weight="medium" color="secondary">
        Không tìm thấy mục nào
      </Text>
      <Text size="sm" color="muted" className="mt-2">
        Thử điều chỉnh bộ lọc của bạn hoặc tìm kiếm từ khóa khác
      </Text>
    </div>
  )
}

// Example 9: Using Text with custom className
export function TextCustomClassExample() {
  return (
    <div className="space-y-2">
      <Text className="uppercase tracking-wide">
        Văn bản viết hoa
      </Text>
      <Text className="italic">
        Văn bản in nghiêng
      </Text>
      <Text className="underline">
        Văn bản gạch chân
      </Text>
      <Text className="line-through">
        Văn bản gạch ngang
      </Text>
    </div>
  )
}

// Example 10: Composing Text in complex components
export function TextComposedExample() {
  return (
    <div className="border rounded-lg p-6">
      <Text size="xl" weight="bold" className="mb-2">
        Khóa học lập trình Web
      </Text>
      <Text color="secondary" className="mb-4">
        Học HTML, CSS, JavaScript từ cơ bản đến nâng cao
      </Text>
      <div className="flex items-center gap-4">
        <Text size="lg" weight="bold" color="primary">
          1.234.567₫
        </Text>
        <Text size="sm" color="muted" className="line-through">
          2.000.000₫
        </Text>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Text size="sm" color="success">
          ✓ Còn hàng
        </Text>
        <Text size="sm" color="muted">
          •
        </Text>
        <Text size="sm" color="muted">
          15 học viên đã đăng ký
        </Text>
      </div>
    </div>
  )
}
