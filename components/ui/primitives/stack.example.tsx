/**
 * Stack Component Usage Examples
 * 
 * The Stack component is a vertical layout primitive that provides consistent
 * spacing between child elements. It's built on flexbox with flex-col direction.
 */

import { Stack } from './stack'

// Example 1: Basic usage with default gap (md) and align (stretch)
export function BasicStackExample() {
  return (
    <Stack className="p-4 bg-gray-100 rounded-md">
      <div className="bg-white p-2 rounded">Item 1</div>
      <div className="bg-white p-2 rounded">Item 2</div>
      <div className="bg-white p-2 rounded">Item 3</div>
    </Stack>
  )
}

// Example 2: Stack with different gap sizes
export function StackGapVariantsExample() {
  return (
    <div className="space-y-8">
      <Stack gap="none" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2">No gap</div>
        <div className="bg-white p-2">No gap</div>
      </Stack>

      <Stack gap="xs" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Extra small gap (4px)</div>
        <div className="bg-white p-2 rounded">Extra small gap (4px)</div>
      </Stack>

      <Stack gap="sm" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Small gap (8px)</div>
        <div className="bg-white p-2 rounded">Small gap (8px)</div>
      </Stack>

      <Stack gap="md" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Medium gap (16px) - Default</div>
        <div className="bg-white p-2 rounded">Medium gap (16px) - Default</div>
      </Stack>

      <Stack gap="lg" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Large gap (24px)</div>
        <div className="bg-white p-2 rounded">Large gap (24px)</div>
      </Stack>

      <Stack gap="xl" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Extra large gap (32px)</div>
        <div className="bg-white p-2 rounded">Extra large gap (32px)</div>
      </Stack>
    </div>
  )
}

// Example 3: Stack with different align variants
export function StackAlignVariantsExample() {
  return (
    <div className="space-y-8">
      <Stack align="start" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded w-1/2">Align start</div>
        <div className="bg-white p-2 rounded w-1/3">Align start</div>
      </Stack>

      <Stack align="center" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded w-1/2">Align center</div>
        <div className="bg-white p-2 rounded w-1/3">Align center</div>
      </Stack>

      <Stack align="end" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded w-1/2">Align end</div>
        <div className="bg-white p-2 rounded w-1/3">Align end</div>
      </Stack>

      <Stack align="stretch" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Align stretch (default)</div>
        <div className="bg-white p-2 rounded">Align stretch (default)</div>
      </Stack>
    </div>
  )
}

// Example 4: Form layout using Stack
export function FormStackExample() {
  return (
    <Stack gap="lg" className="max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold">Đăng ký tài khoản</h2>
      
      <Stack gap="xs">
        <label className="text-sm font-medium">Họ và tên</label>
        <input
          type="text"
          placeholder="nhập họ và tên của bạn"
          className="px-3 py-2 border border-gray-300 rounded-md"
        />
      </Stack>

      <Stack gap="xs">
        <label className="text-sm font-medium">Địa chỉ email</label>
        <input
          type="email"
          placeholder="nhập email của bạn"
          className="px-3 py-2 border border-gray-300 rounded-md"
        />
      </Stack>

      <Stack gap="xs">
        <label className="text-sm font-medium">Mật khẩu</label>
        <input
          type="password"
          placeholder="nhập mật khẩu"
          className="px-3 py-2 border border-gray-300 rounded-md"
        />
      </Stack>

      <div className="flex justify-end gap-2 pt-4">
        <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">
          Hủy
        </button>
        <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md">
          Đăng ký
        </button>
      </div>
    </Stack>
  )
}

// Example 5: Card content layout using Stack
export function CardContentStackExample() {
  return (
    <div className="max-w-sm border border-gray-200 rounded-lg overflow-hidden">
      <Stack gap="none">
        <div className="h-48 bg-gradient-to-r from-blue-500 to-purple-600" />
        
        <Stack gap="md" className="p-6">
          <Stack gap="xs">
            <h3 className="text-xl font-bold">Tiêu đề bài viết</h3>
            <p className="text-sm text-gray-500">15/01/2024</p>
          </Stack>

          <p className="text-gray-600">
            Đây là mô tả ngắn về nội dung bài viết. Stack component giúp tạo
            khoảng cách nhất quán giữa các phần tử.
          </p>

          <Stack gap="sm">
            <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              Công nghệ
            </span>
            <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
              Thiết kế
            </span>
          </Stack>
        </Stack>
      </Stack>
    </div>
  )
}

// Example 6: Nested Stacks for complex layouts
export function NestedStackExample() {
  return (
    <Stack gap="lg" className="max-w-2xl p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold">Thông tin khóa học</h2>

      <Stack gap="md">
        <Stack gap="xs">
          <h3 className="text-lg font-semibold">Mô tả</h3>
          <p className="text-gray-600">
            Khóa học lập trình web toàn diện với Next.js và React
          </p>
        </Stack>

        <Stack gap="xs">
          <h3 className="text-lg font-semibold">Thời lượng</h3>
          <p className="text-gray-600">12 tuần</p>
        </Stack>

        <Stack gap="xs">
          <h3 className="text-lg font-semibold">Học phí</h3>
          <p className="text-gray-600">5.000.000₫</p>
        </Stack>
      </Stack>

      <button className="self-start px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
        Đăng ký ngay
      </button>
    </Stack>
  )
}

// Example 7: Stack with custom className
export function CustomStyledStackExample() {
  return (
    <Stack
      gap="md"
      align="center"
      className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8"
    >
      <h1 className="text-4xl font-bold text-gray-900">Chào mừng</h1>
      <p className="text-lg text-gray-600 text-center max-w-md">
        Stack component kết hợp với custom className để tạo layout phức tạp
      </p>
      <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        Bắt đầu
      </button>
    </Stack>
  )
}
