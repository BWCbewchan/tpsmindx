/**
 * Badge Component Examples
 * 
 * Demonstrates all badge variants and sizes with Vietnamese content.
 */

import { Badge } from './badge'
import { Stack } from './primitives/stack'
import { Flex } from './primitives/flex'
import { Text } from './primitives/text'
import { Icon } from './primitives/icon'
import { Check, X, AlertCircle, Info, Star, Clock } from 'lucide-react'

export function BadgeExamples() {
  return (
    <div className="space-y-12 p-8">
      {/* Badge Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Các biến thể badge</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="default">Mặc định</Badge>
          <Badge variant="info">Phụ</Badge>
          <Badge variant="outline">Viền</Badge>
          <Badge variant="danger">Lỗi</Badge>
          <Badge variant="success">Thành công</Badge>
          <Badge variant="warning">Cảnh báo</Badge>
          <Badge variant="info">Thông tin</Badge>
        </Flex>
      </section>

      {/* Badge Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Kích thước badge</h2>
        <Flex gap="md" align="center" wrap="wrap">
          <Badge size="sm">Nhỏ</Badge>
          <Badge size="md">Trung bình</Badge>
          <Badge size="lg">Lớn</Badge>
        </Flex>
      </section>

      {/* Status Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge trạng thái</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="success">
            <Icon icon={Check} size="xs" />
            Hoàn thành
          </Badge>
          <Badge variant="warning">
            <Icon icon={Clock} size="xs" />
            Đang chờ
          </Badge>
          <Badge variant="danger">
            <Icon icon={X} size="xs" />
            Thất bại
          </Badge>
          <Badge variant="info">
            <Icon icon={Info} size="xs" />
            Đang xử lý
          </Badge>
        </Flex>
      </section>

      {/* Category Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge danh mục</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="outline">Lập trình</Badge>
          <Badge variant="outline">Thiết kế</Badge>
          <Badge variant="outline">Marketing</Badge>
          <Badge variant="outline">Kinh doanh</Badge>
          <Badge variant="outline">Ngôn ngữ</Badge>
        </Flex>
      </section>

      {/* Priority Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge độ ưu tiên</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="danger">Cao</Badge>
          <Badge variant="warning">Trung bình</Badge>
          <Badge variant="success">Thấp</Badge>
        </Flex>
      </section>

      {/* Count Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge đếm số</h2>
        <Flex gap="md" wrap="wrap">
          <div className="relative">
            <button className="px-4 py-2 bg-gray-100 rounded">
              Thông báo
            </button>
            <Badge 
              variant="danger" 
              size="sm" 
              className="absolute -top-2 -right-2"
            >
              5
            </Badge>
          </div>
          <div className="relative">
            <button className="px-4 py-2 bg-gray-100 rounded">
              Tin nhắn
            </button>
            <Badge 
              variant="info" 
              size="sm" 
              className="absolute -top-2 -right-2"
            >
              12
            </Badge>
          </div>
          <div className="relative">
            <button className="px-4 py-2 bg-gray-100 rounded">
              Giỏ hàng
            </button>
            <Badge 
              variant="success" 
              size="sm" 
              className="absolute -top-2 -right-2"
            >
              3
            </Badge>
          </div>
        </Flex>
      </section>

      {/* Rating Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge đánh giá</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="warning">
            <Icon icon={Star} size="xs" />
            4.8
          </Badge>
          <Badge variant="warning">
            <Icon icon={Star} size="xs" />
            5.0
          </Badge>
          <Badge variant="warning">
            <Icon icon={Star} size="xs" />
            4.5
          </Badge>
        </Flex>
      </section>

      {/* Product Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge sản phẩm</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="danger">Mới</Badge>
          <Badge variant="warning">Nổi bật</Badge>
          <Badge variant="success">Giảm giá</Badge>
          <Badge variant="info">Bán chạy</Badge>
          <Badge variant="outline">Hết hàng</Badge>
        </Flex>
      </section>

      {/* User Role Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge vai trò</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="default">Quản trị viên</Badge>
          <Badge variant="info">Giảng viên</Badge>
          <Badge variant="outline">Học viên</Badge>
          <Badge variant="info">Khách</Badge>
        </Flex>
      </section>

      {/* Course Status Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge trạng thái khóa học</h2>
        <Stack gap="md">
          <Flex gap="md" align="center">
            <Text weight="medium" className="w-32">Đang học:</Text>
            <Badge variant="info">Đang tiến hành</Badge>
          </Flex>
          <Flex gap="md" align="center">
            <Text weight="medium" className="w-32">Hoàn thành:</Text>
            <Badge variant="success">Đã hoàn thành</Badge>
          </Flex>
          <Flex gap="md" align="center">
            <Text weight="medium" className="w-32">Chưa bắt đầu:</Text>
            <Badge variant="outline">Chưa bắt đầu</Badge>
          </Flex>
          <Flex gap="md" align="center">
            <Text weight="medium" className="w-32">Quá hạn:</Text>
            <Badge variant="danger">Quá hạn</Badge>
          </Flex>
        </Stack>
      </section>

      {/* Payment Status Badges */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge trạng thái thanh toán</h2>
        <Flex gap="md" wrap="wrap">
          <Badge variant="success">Đã thanh toán</Badge>
          <Badge variant="warning">Đang chờ</Badge>
          <Badge variant="danger">Thất bại</Badge>
          <Badge variant="info">Đang xử lý</Badge>
          <Badge variant="outline">Hoàn tiền</Badge>
        </Flex>
      </section>

      {/* Badge in Lists */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Badge trong danh sách</h2>
        <Stack gap="md">
          <Flex justify="between" align="center" className="p-4 border rounded">
            <Text>Khóa học lập trình Web</Text>
            <Badge variant="success">Đang hoạt động</Badge>
          </Flex>
          <Flex justify="between" align="center" className="p-4 border rounded">
            <Text>Khóa học Python cơ bản</Text>
            <Badge variant="warning">Sắp bắt đầu</Badge>
          </Flex>
          <Flex justify="between" align="center" className="p-4 border rounded">
            <Text>Khóa học React nâng cao</Text>
            <Badge variant="outline">Đã kết thúc</Badge>
          </Flex>
        </Stack>
      </section>

      {/* Badge Combinations */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Kết hợp nhiều badge</h2>
        <Stack gap="md">
          <Flex gap="sm" wrap="wrap">
            <Badge variant="default">JavaScript</Badge>
            <Badge variant="default">React</Badge>
            <Badge variant="default">TypeScript</Badge>
            <Badge variant="default">Next.js</Badge>
          </Flex>
          <Flex gap="sm" wrap="wrap">
            <Badge variant="outline">Cơ bản</Badge>
            <Badge variant="outline">12 tuần</Badge>
            <Badge variant="outline">156 học viên</Badge>
            <Badge variant="warning">
              <Icon icon={Star} size="xs" />
              4.8
            </Badge>
          </Flex>
        </Stack>
      </section>
    </div>
  )
}
