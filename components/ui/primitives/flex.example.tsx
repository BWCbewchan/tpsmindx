/**
 * Flex Component Usage Examples
 * 
 * The Flex component is a horizontal layout primitive that provides consistent
 * spacing and alignment between child elements. It's built on flexbox with
 * flex-row direction (default).
 */

import { Flex } from './flex'

// Example 1: Basic usage with default settings (gap: md, align: center, justify: start, wrap: nowrap)
export function BasicFlexExample() {
  return (
    <Flex className="p-4 bg-gray-100 rounded-md">
      <div className="bg-white p-2 rounded">Item 1</div>
      <div className="bg-white p-2 rounded">Item 2</div>
      <div className="bg-white p-2 rounded">Item 3</div>
    </Flex>
  )
}

// Example 2: Flex with different gap sizes
export function FlexGapVariantsExample() {
  return (
    <div className="space-y-4">
      <Flex gap="none" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">No gap</div>
        <div className="bg-white p-2 rounded">No gap</div>
      </Flex>

      <Flex gap="xs" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Extra small gap (4px)</div>
        <div className="bg-white p-2 rounded">Extra small gap (4px)</div>
      </Flex>

      <Flex gap="sm" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Small gap (8px)</div>
        <div className="bg-white p-2 rounded">Small gap (8px)</div>
      </Flex>

      <Flex gap="md" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Medium gap (16px) - Default</div>
        <div className="bg-white p-2 rounded">Medium gap (16px) - Default</div>
      </Flex>

      <Flex gap="lg" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Large gap (24px)</div>
        <div className="bg-white p-2 rounded">Large gap (24px)</div>
      </Flex>

      <Flex gap="xl" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Extra large gap (32px)</div>
        <div className="bg-white p-2 rounded">Extra large gap (32px)</div>
      </Flex>
    </div>
  )
}

// Example 3: Flex with different align variants
export function FlexAlignVariantsExample() {
  return (
    <div className="space-y-4">
      <Flex align="start" className="p-4 bg-gray-100 rounded-md h-24">
        <div className="bg-white p-2 rounded">Align start</div>
        <div className="bg-white p-4 rounded">Taller item</div>
        <div className="bg-white p-2 rounded">Align start</div>
      </Flex>

      <Flex align="center" className="p-4 bg-gray-100 rounded-md h-24">
        <div className="bg-white p-2 rounded">Align center (default)</div>
        <div className="bg-white p-4 rounded">Taller item</div>
        <div className="bg-white p-2 rounded">Align center (default)</div>
      </Flex>

      <Flex align="end" className="p-4 bg-gray-100 rounded-md h-24">
        <div className="bg-white p-2 rounded">Align end</div>
        <div className="bg-white p-4 rounded">Taller item</div>
        <div className="bg-white p-2 rounded">Align end</div>
      </Flex>

      <Flex align="stretch" className="p-4 bg-gray-100 rounded-md h-24">
        <div className="bg-white p-2 rounded">Align stretch</div>
        <div className="bg-white p-4 rounded">Taller item</div>
        <div className="bg-white p-2 rounded">Align stretch</div>
      </Flex>

      <Flex align="baseline" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded text-xs">Small text</div>
        <div className="bg-white p-2 rounded text-2xl">Large text</div>
        <div className="bg-white p-2 rounded text-base">Normal text</div>
      </Flex>
    </div>
  )
}

// Example 4: Flex with different justify variants
export function FlexJustifyVariantsExample() {
  return (
    <div className="space-y-4">
      <Flex justify="start" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Justify start (default)</div>
        <div className="bg-white p-2 rounded">Item 2</div>
      </Flex>

      <Flex justify="center" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Justify center</div>
        <div className="bg-white p-2 rounded">Item 2</div>
      </Flex>

      <Flex justify="end" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Justify end</div>
        <div className="bg-white p-2 rounded">Item 2</div>
      </Flex>

      <Flex justify="between" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Justify between</div>
        <div className="bg-white p-2 rounded">Item 2</div>
      </Flex>

      <Flex justify="around" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Justify around</div>
        <div className="bg-white p-2 rounded">Item 2</div>
        <div className="bg-white p-2 rounded">Item 3</div>
      </Flex>

      <Flex justify="evenly" className="p-4 bg-gray-100 rounded-md">
        <div className="bg-white p-2 rounded">Justify evenly</div>
        <div className="bg-white p-2 rounded">Item 2</div>
        <div className="bg-white p-2 rounded">Item 3</div>
      </Flex>
    </div>
  )
}

// Example 5: Flex with different wrap variants
export function FlexWrapVariantsExample() {
  return (
    <div className="space-y-4">
      <Flex wrap="nowrap" className="p-4 bg-gray-100 rounded-md w-64">
        <div className="bg-white p-2 rounded whitespace-nowrap">No wrap (default)</div>
        <div className="bg-white p-2 rounded whitespace-nowrap">Item 2</div>
        <div className="bg-white p-2 rounded whitespace-nowrap">Item 3</div>
        <div className="bg-white p-2 rounded whitespace-nowrap">Item 4</div>
      </Flex>

      <Flex wrap="wrap" className="p-4 bg-gray-100 rounded-md w-64">
        <div className="bg-white p-2 rounded">Wrap</div>
        <div className="bg-white p-2 rounded">Item 2</div>
        <div className="bg-white p-2 rounded">Item 3</div>
        <div className="bg-white p-2 rounded">Item 4</div>
        <div className="bg-white p-2 rounded">Item 5</div>
        <div className="bg-white p-2 rounded">Item 6</div>
      </Flex>

      <Flex wrap="wrap-reverse" className="p-4 bg-gray-100 rounded-md w-64">
        <div className="bg-white p-2 rounded">Wrap reverse</div>
        <div className="bg-white p-2 rounded">Item 2</div>
        <div className="bg-white p-2 rounded">Item 3</div>
        <div className="bg-white p-2 rounded">Item 4</div>
        <div className="bg-white p-2 rounded">Item 5</div>
        <div className="bg-white p-2 rounded">Item 6</div>
      </Flex>
    </div>
  )
}

// Example 6: Button group using Flex
export function ButtonGroupFlexExample() {
  return (
    <Flex gap="sm" justify="end" className="p-4 bg-white rounded-lg shadow-md">
      <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">
        Hủy
      </button>
      <button className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md">
        Lưu
      </button>
    </Flex>
  )
}

// Example 7: Navigation bar using Flex
export function NavbarFlexExample() {
  return (
    <Flex justify="between" align="center" className="p-4 bg-white shadow-md">
      <Flex gap="md" align="center">
        <div className="text-xl font-bold text-blue-600">MindX</div>
        <Flex gap="sm">
          <a href="#" className="text-gray-600 hover:text-gray-900">Trang chủ</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Khóa học</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Giới thiệu</a>
          <a href="#" className="text-gray-600 hover:text-gray-900">Liên hệ</a>
        </Flex>
      </Flex>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
        Đăng nhập
      </button>
    </Flex>
  )
}

// Example 8: Card with icon and text using Flex
export function IconTextFlexExample() {
  return (
    <div className="space-y-4 max-w-md">
      <Flex gap="sm" align="start" className="p-4 bg-white rounded-lg shadow-sm">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-blue-600">📧</span>
        </div>
        <div>
          <h3 className="font-semibold">Địa chỉ email</h3>
          <p className="text-sm text-gray-600">contact@mindx.edu.vn</p>
        </div>
      </Flex>

      <Flex gap="sm" align="start" className="p-4 bg-white rounded-lg shadow-sm">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-green-600">📞</span>
        </div>
        <div>
          <h3 className="font-semibold">Số điện thoại</h3>
          <p className="text-sm text-gray-600">024 1234 5678</p>
        </div>
      </Flex>

      <Flex gap="sm" align="start" className="p-4 bg-white rounded-lg shadow-sm">
        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-purple-600">📍</span>
        </div>
        <div>
          <h3 className="font-semibold">Địa chỉ</h3>
          <p className="text-sm text-gray-600">Hà Nội, Việt Nam</p>
        </div>
      </Flex>
    </div>
  )
}

// Example 9: Stats cards using Flex
export function StatsFlexExample() {
  return (
    <Flex gap="md" wrap="wrap" className="p-4">
      <div className="flex-1 min-w-[200px] p-6 bg-white rounded-lg shadow-md">
        <Flex justify="between" align="start">
          <div>
            <p className="text-sm text-gray-600">Tổng học viên</p>
            <p className="text-3xl font-bold text-gray-900">1,234</p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">👥</span>
          </div>
        </Flex>
      </div>

      <div className="flex-1 min-w-[200px] p-6 bg-white rounded-lg shadow-md">
        <Flex justify="between" align="start">
          <div>
            <p className="text-sm text-gray-600">Khóa học</p>
            <p className="text-3xl font-bold text-gray-900">42</p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📚</span>
          </div>
        </Flex>
      </div>

      <div className="flex-1 min-w-[200px] p-6 bg-white rounded-lg shadow-md">
        <Flex justify="between" align="start">
          <div>
            <p className="text-sm text-gray-600">Giảng viên</p>
            <p className="text-3xl font-bold text-gray-900">18</p>
          </div>
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">👨‍🏫</span>
          </div>
        </Flex>
      </div>
    </Flex>
  )
}

// Example 10: Complex layout combining multiple Flex properties
export function ComplexFlexExample() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Flex justify="between" align="center" className="mb-6">
        <h1 className="text-2xl font-bold">Danh sách khóa học</h1>
        <Flex gap="sm">
          <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
            Lọc
          </button>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Thêm mới
          </button>
        </Flex>
      </Flex>

      <Flex gap="md" wrap="wrap">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex-1 min-w-[280px] p-4 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md mb-4" />
            <h3 className="font-semibold mb-2">Khóa học {i}</h3>
            <p className="text-sm text-gray-600 mb-4">
              Mô tả ngắn về khóa học này
            </p>
            <Flex justify="between" align="center">
              <span className="text-sm text-gray-500">12 tuần</span>
              <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                Xem chi tiết
              </button>
            </Flex>
          </div>
        ))}
      </Flex>
    </div>
  )
}
