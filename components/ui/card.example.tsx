/**
 * Card Component Examples
 * 
 * Demonstrates all card variants, padding sizes, and composition patterns
 * with Vietnamese content following design system standards.
 */

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card'
import { Button } from './button'
import { Icon } from './primitives/icon'
import { Grid } from './primitives/grid'
import { Stack } from './primitives/stack'
import { Flex } from './primitives/flex'
import { Text } from './primitives/text'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Star,
  Heart,
  Share2,
  MoreVertical,
} from 'lucide-react'

export function CardExamples() {
  return (
    <div className="space-y-12 p-8">
      {/* Basic Card */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Card cơ bản</h2>
        <Card>
          <CardHeader>
            <CardTitle>Tiêu đề card</CardTitle>
            <CardDescription>Mô tả ngắn gọn về nội dung card</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Đây là nội dung chính của card. Bạn có thể đặt bất kỳ nội dung nào ở đây.</p>
          </CardContent>
          <CardFooter>
            <Button>Xem thêm</Button>
          </CardFooter>
        </Card>
      </section>

      {/* Card Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Các biến thể card</h2>
        <Grid cols={2} gap="lg">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Mặc định</CardTitle>
              <CardDescription>Card với viền và bóng nhẹ</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Đây là card mặc định với shadow-sm</p>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardHeader>
              <CardTitle>Viền đậm</CardTitle>
              <CardDescription>Card với viền 2px</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card này có viền đậm hơn</p>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardHeader>
              <CardTitle>Nổi bật</CardTitle>
              <CardDescription>Card với bóng lớn</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card này có shadow-lg để tạo hiệu ứng nổi</p>
            </CardContent>
          </Card>

          <Card variant="interactive">
            <CardHeader>
              <CardTitle>Tương tác</CardTitle>
              <CardDescription>Card có thể nhấp</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Di chuột vào để xem hiệu ứng hover</p>
            </CardContent>
          </Card>
        </Grid>
      </section>

      {/* Padding Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Kích thước padding</h2>
        <Grid cols={3} gap="lg">
          <Card padding="sm">
            <CardContent>
              <Text weight="semibold">Padding nhỏ (16px)</Text>
              <Text size="sm" color="secondary">Phù hợp cho card nhỏ gọn</Text>
            </CardContent>
          </Card>

          <Card padding="md">
            <CardContent>
              <Text weight="semibold">Padding trung bình (24px)</Text>
              <Text size="sm" color="secondary">Padding mặc định</Text>
            </CardContent>
          </Card>

          <Card padding="lg">
            <CardContent>
              <Text weight="semibold">Padding lớn (32px)</Text>
              <Text size="sm" color="secondary">Phù hợp cho card quan trọng</Text>
            </CardContent>
          </Card>
        </Grid>
      </section>

      {/* User Profile Card */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Card hồ sơ người dùng</h2>
        <Card variant="elevated" className="max-w-md">
          <CardHeader>
            <Flex gap="md" align="center">
              <div className="size-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                NV
              </div>
              <Stack gap="xs">
                <CardTitle>Nguyễn Văn An</CardTitle>
                <CardDescription>Học viên MindX</CardDescription>
              </Stack>
            </Flex>
          </CardHeader>
          <CardContent>
            <Stack gap="sm">
              <Flex gap="sm" align="center">
                <Icon icon={Mail} size="sm" className="text-gray-500" />
                <Text size="sm">nguyenvanan@email.com</Text>
              </Flex>
              <Flex gap="sm" align="center">
                <Icon icon={Phone} size="sm" className="text-gray-500" />
                <Text size="sm">0123 456 789</Text>
              </Flex>
              <Flex gap="sm" align="center">
                <Icon icon={MapPin} size="sm" className="text-gray-500" />
                <Text size="sm">Hà Nội, Việt Nam</Text>
              </Flex>
            </Stack>
          </CardContent>
          <CardFooter>
            <Flex gap="sm" className="w-full">
              <Button className="flex-1">Xem hồ sơ</Button>
              <Button variant="outline" className="flex-1">Nhắn tin</Button>
            </Flex>
          </CardFooter>
        </Card>
      </section>

      {/* Course Card */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Card khóa học</h2>
        <Grid cols={3} gap="lg">
          <Card variant="interactive">
            <div className="h-40 bg-gradient-to-br from-blue-500 to-blue-600 rounded-t-xl -m-6 mb-0" />
            <CardHeader className="mt-4">
              <CardTitle>Lập trình Web cơ bản</CardTitle>
              <CardDescription>HTML, CSS, JavaScript</CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap="sm">
                <Flex gap="sm" align="center">
                  <Icon icon={Calendar} size="sm" className="text-gray-500" />
                  <Text size="sm">12 tuần</Text>
                </Flex>
                <Flex gap="sm" align="center">
                  <Icon icon={User} size="sm" className="text-gray-500" />
                  <Text size="sm">156 học viên</Text>
                </Flex>
                <Flex gap="sm" align="center">
                  <Icon icon={Star} size="sm" className="text-yellow-500" />
                  <Text size="sm">4.8 (89 đánh giá)</Text>
                </Flex>
              </Stack>
            </CardContent>
            <CardFooter>
              <Button variant="mindx" className="w-full">Đăng ký ngay</Button>
            </CardFooter>
          </Card>

          <Card variant="interactive">
            <div className="h-40 bg-gradient-to-br from-purple-500 to-purple-600 rounded-t-xl -m-6 mb-0" />
            <CardHeader className="mt-4">
              <CardTitle>Python cho người mới</CardTitle>
              <CardDescription>Lập trình Python từ đầu</CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap="sm">
                <Flex gap="sm" align="center">
                  <Icon icon={Calendar} size="sm" className="text-gray-500" />
                  <Text size="sm">10 tuần</Text>
                </Flex>
                <Flex gap="sm" align="center">
                  <Icon icon={User} size="sm" className="text-gray-500" />
                  <Text size="sm">203 học viên</Text>
                </Flex>
                <Flex gap="sm" align="center">
                  <Icon icon={Star} size="sm" className="text-yellow-500" />
                  <Text size="sm">4.9 (124 đánh giá)</Text>
                </Flex>
              </Stack>
            </CardContent>
            <CardFooter>
              <Button variant="mindx" className="w-full">Đăng ký ngay</Button>
            </CardFooter>
          </Card>

          <Card variant="interactive">
            <div className="h-40 bg-gradient-to-br from-green-500 to-green-600 rounded-t-xl -m-6 mb-0" />
            <CardHeader className="mt-4">
              <CardTitle>React nâng cao</CardTitle>
              <CardDescription>Xây dựng ứng dụng React</CardDescription>
            </CardHeader>
            <CardContent>
              <Stack gap="sm">
                <Flex gap="sm" align="center">
                  <Icon icon={Calendar} size="sm" className="text-gray-500" />
                  <Text size="sm">16 tuần</Text>
                </Flex>
                <Flex gap="sm" align="center">
                  <Icon icon={User} size="sm" className="text-gray-500" />
                  <Text size="sm">98 học viên</Text>
                </Flex>
                <Flex gap="sm" align="center">
                  <Icon icon={Star} size="sm" className="text-yellow-500" />
                  <Text size="sm">5.0 (67 đánh giá)</Text>
                </Flex>
              </Stack>
            </CardContent>
            <CardFooter>
              <Button variant="mindx" className="w-full">Đăng ký ngay</Button>
            </CardFooter>
          </Card>
        </Grid>
      </section>

      {/* Blog Post Card */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Card bài viết blog</h2>
        <Card variant="default" className="max-w-2xl">
          <CardHeader>
            <Flex justify="between" align="start">
              <Stack gap="sm">
                <CardTitle>10 mẹo học lập trình hiệu quả</CardTitle>
                <CardDescription>
                  Khám phá những phương pháp học tập đã được chứng minh giúp bạn tiến bộ nhanh hơn
                </CardDescription>
              </Stack>
              <Button variant="ghost" size="icon">
                <Icon icon={MoreVertical} size="sm" />
              </Button>
            </Flex>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Học lập trình không chỉ là ghi nhớ cú pháp mà còn là phát triển tư duy logic và kỹ năng giải quyết vấn đề. 
              Trong bài viết này, chúng tôi sẽ chia sẻ 10 mẹo đã được kiểm chứng...
            </p>
            <Flex gap="sm" align="center" className="text-sm text-gray-500">
              <Icon icon={Clock} size="sm" />
              <span>5 phút đọc</span>
              <span>•</span>
              <span>15/01/2024</span>
            </Flex>
          </CardContent>
          <CardFooter>
            <Flex justify="between" className="w-full">
              <Flex gap="sm">
                <Button variant="ghost" size="sm">
                  <Icon icon={Heart} size="sm" />
                  <span>128</span>
                </Button>
                <Button variant="ghost" size="sm">
                  <Icon icon={Share2} size="sm" />
                  Chia sẻ
                </Button>
              </Flex>
              <Button variant="link" size="sm">
                Đọc thêm
              </Button>
            </Flex>
          </CardFooter>
        </Card>
      </section>

      {/* Stats Cards */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Card thống kê</h2>
        <Grid cols={4} gap="lg">
          <Card variant="outlined" padding="md">
            <CardContent>
              <Stack gap="sm">
                <Text size="sm" color="secondary">Tổng học viên</Text>
                <Text size="xl" weight="bold">1,234</Text>
                <Text size="sm" color="success">+12% so với tháng trước</Text>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" padding="md">
            <CardContent>
              <Stack gap="sm">
                <Text size="sm" color="secondary">Khóa học</Text>
                <Text size="xl" weight="bold">48</Text>
                <Text size="sm" color="success">+3 khóa mới</Text>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" padding="md">
            <CardContent>
              <Stack gap="sm">
                <Text size="sm" color="secondary">Giảng viên</Text>
                <Text size="xl" weight="bold">24</Text>
                <Text size="sm" color="secondary">Đang hoạt động</Text>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" padding="md">
            <CardContent>
              <Stack gap="sm">
                <Text size="sm" color="secondary">Đánh giá</Text>
                <Text size="xl" weight="bold">4.9</Text>
                <Text size="sm" color="success">⭐⭐⭐⭐⭐</Text>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </section>

      {/* Card without Header/Footer */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Card đơn giản</h2>
        <Grid cols={3} gap="lg">
          <Card>
            <CardContent>
              <Text weight="semibold">Chỉ có nội dung</Text>
              <Text size="sm" color="secondary" className="mt-2">
                Card này không có header hoặc footer
              </Text>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent>
              <Text weight="semibold">Card nổi bật</Text>
              <Text size="sm" color="secondary" className="mt-2">
                Với shadow lớn hơn
              </Text>
            </CardContent>
          </Card>

          <Card variant="interactive">
            <CardContent>
              <Text weight="semibold">Card tương tác</Text>
              <Text size="sm" color="secondary" className="mt-2">
                Hover để xem hiệu ứng
              </Text>
            </CardContent>
          </Card>
        </Grid>
      </section>
    </div>
  )
}
