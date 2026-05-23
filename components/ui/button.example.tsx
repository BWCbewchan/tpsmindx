/**
 * Button Component Examples
 * 
 * Demonstrates all button variants, sizes, and states with Vietnamese content.
 * All text follows sentence case as per design system standards.
 */

import { Button } from './button'
import { Icon } from './primitives/icon'
import { Stack } from './primitives/stack'
import { Flex } from './primitives/flex'
import {
  Check,
  X,
  ChevronRight,
  Download,
  Upload,
  Save,
  Trash2,
  Edit,
  Plus,
  Search,
  ArrowRight,
} from 'lucide-react'

export function ButtonExamples() {
  return (
    <div className="space-y-12 p-8">
      {/* Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Các biến thể button</h2>
        <Flex gap="md" wrap="wrap">
          <Button variant="default">Mặc định</Button>
          <Button variant="secondary">Phụ</Button>
          <Button variant="outline">Viền</Button>
          <Button variant="ghost">Trong suốt</Button>
          <Button variant="link">Liên kết</Button>
          <Button variant="destructive">Xóa</Button>
          <Button variant="success">Thành công</Button>
          <Button variant="mindx">MindX</Button>
        </Flex>
      </section>

      {/* Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Kích thước button</h2>
        <Flex gap="md" align="center" wrap="wrap">
          <Button size="xs">Rất nhỏ</Button>
          <Button size="sm">Nhỏ</Button>
          <Button size="default">Mặc định</Button>
          <Button size="lg">Lớn</Button>
        </Flex>
      </section>

      {/* States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Trạng thái button</h2>
        <Flex gap="md" wrap="wrap">
          <Button>Bình thường</Button>
          <Button disabled>Vô hiệu hóa</Button>
          <Button loading>Đang tải</Button>
        </Flex>
      </section>

      {/* With Icons - Left Position (Default) */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button với icon (trái - mặc định)</h2>
        <Flex gap="md" wrap="wrap">
          <Button>
            <Icon icon={Check} size="sm" />
            Xác nhận
          </Button>
          <Button variant="secondary">
            <Icon icon={Save} size="sm" />
            Lưu thay đổi
          </Button>
          <Button variant="outline">
            <Icon icon={Download} size="sm" />
            Tải xuống
          </Button>
          <Button variant="destructive">
            <Icon icon={Trash2} size="sm" />
            Xóa
          </Button>
          <Button variant="success">
            <Icon icon={Plus} size="sm" />
            Thêm mới
          </Button>
        </Flex>
      </section>

      {/* With Icons - Right Position (Directional) */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button với icon (phải - hướng)</h2>
        <Flex gap="md" wrap="wrap">
          <Button>
            Tiếp theo
            <Icon icon={ChevronRight} size="sm" />
          </Button>
          <Button variant="secondary">
            Xem thêm
            <Icon icon={ArrowRight} size="sm" />
          </Button>
          <Button variant="outline">
            Tải lên
            <Icon icon={Upload} size="sm" />
          </Button>
        </Flex>
      </section>

      {/* Icon Only Buttons */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button chỉ có icon</h2>
        <Flex gap="md" align="center" wrap="wrap">
          <Button size="icon-sm" variant="outline" aria-label="Chỉnh sửa">
            <Icon icon={Edit} size="sm" />
          </Button>
          <Button size="icon" variant="outline" aria-label="Tìm kiếm">
            <Icon icon={Search} size="sm" />
          </Button>
          <Button size="icon-lg" variant="outline" aria-label="Xóa">
            <Icon icon={Trash2} size="md" />
          </Button>
        </Flex>
      </section>

      {/* Loading States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Trạng thái đang tải</h2>
        <Flex gap="md" wrap="wrap">
          <Button loading>Đang gửi</Button>
          <Button variant="secondary" loading>Đang lưu</Button>
          <Button variant="outline" loading>Đang tải</Button>
          <Button variant="success" loading>Đang xử lý</Button>
        </Flex>
      </section>

      {/* Form Button Patterns */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Mẫu button trong form</h2>
        
        <div className="space-y-6">
          {/* Standard form buttons - Cancel left, Submit right */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Mẫu chuẩn: Hủy (trái) + Gửi (phải)</p>
            <Flex gap="md" justify="end">
              <Button variant="outline">Hủy</Button>
              <Button>Gửi</Button>
            </Flex>
          </div>

          {/* Save form */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Form lưu</p>
            <Flex gap="md" justify="end">
              <Button variant="outline">Hủy</Button>
              <Button variant="success">
                <Icon icon={Save} size="sm" />
                Lưu
              </Button>
            </Flex>
          </div>

          {/* Delete confirmation */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Xác nhận xóa: Xóa (trái) + Hủy (phải)</p>
            <Flex gap="md" justify="end">
              <Button variant="destructive">
                <Icon icon={Trash2} size="sm" />
                Xóa
              </Button>
              <Button variant="outline">Hủy</Button>
            </Flex>
          </div>
        </div>
      </section>

      {/* Common Actions */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Hành động thường dùng</h2>
        <Stack gap="md">
          <Flex gap="md" wrap="wrap">
            <Button>Gửi</Button>
            <Button>Lưu</Button>
            <Button>Hủy</Button>
            <Button>Xóa</Button>
            <Button>Chỉnh sửa</Button>
            <Button>Thêm</Button>
            <Button>Cập nhật</Button>
            <Button>Tạo</Button>
            <Button>Đóng</Button>
            <Button>Mở</Button>
          </Flex>
          <Flex gap="md" wrap="wrap">
            <Button>Tải xuống</Button>
            <Button>Tải lên</Button>
            <Button>Tìm kiếm</Button>
            <Button>Lọc</Button>
            <Button>Sắp xếp</Button>
            <Button>Xem</Button>
            <Button>In</Button>
            <Button>Chia sẻ</Button>
            <Button>Sao chép</Button>
            <Button>Làm mới</Button>
          </Flex>
        </Stack>
      </section>

      {/* MindX Brand Buttons */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Button thương hiệu MindX</h2>
        <Flex gap="md" wrap="wrap">
          <Button variant="mindx" size="lg">
            Đăng ký ngay
          </Button>
          <Button variant="mindx">
            Tìm hiểu thêm
            <Icon icon={ArrowRight} size="sm" />
          </Button>
          <Button variant="mindx" size="sm">
            Bắt đầu học
          </Button>
        </Flex>
      </section>

      {/* Responsive Button Groups */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Nhóm button responsive</h2>
        <div className="space-y-4">
          {/* Desktop: horizontal, Mobile: vertical */}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto">Hủy</Button>
            <Button className="w-full sm:w-auto">Gửi biểu mẫu</Button>
          </div>
        </div>
      </section>

      {/* Accessibility Examples */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Ví dụ về khả năng tiếp cận</h2>
        <Flex gap="md" wrap="wrap">
          <Button aria-label="Đóng hộp thoại">
            <Icon icon={X} size="sm" />
          </Button>
          <Button aria-label="Xác nhận hành động">
            <Icon icon={Check} size="sm" />
            Xác nhận
          </Button>
          <Button disabled aria-label="Chức năng không khả dụng">
            Không khả dụng
          </Button>
        </Flex>
      </section>
    </div>
  )
}
