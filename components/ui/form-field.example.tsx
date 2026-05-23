/**
 * FormField Component Examples
 * 
 * Demonstrates form field patterns with Vietnamese content following design system standards.
 */

import { FormField } from './form-field'
import { Input } from './primitives/input'
import { Button } from './button'
import { Stack } from './primitives/stack'
import { Flex } from './primitives/flex'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './card'

export function FormFieldExamples() {
  return (
    <div className="space-y-12 p-8 max-w-4xl">
      {/* Basic Form Fields */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Form field cơ bản</h2>
        <Stack gap="lg">
          <FormField label="Họ và tên">
            <Input placeholder="nhập họ và tên của bạn" />
          </FormField>

          <FormField label="Địa chỉ email">
            <Input type="email" placeholder="nhập email của bạn" />
          </FormField>

          <FormField label="Số điện thoại">
            <Input type="tel" placeholder="nhập số điện thoại" />
          </FormField>
        </Stack>
      </section>

      {/* Required Fields */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Trường bắt buộc</h2>
        <Stack gap="lg">
          <FormField label="Địa chỉ email" required>
            <Input type="email" placeholder="nhập email của bạn" />
          </FormField>

          <FormField label="Mật khẩu" required>
            <Input type="password" placeholder="nhập mật khẩu" />
          </FormField>

          <FormField label="Xác nhận mật khẩu" required>
            <Input type="password" placeholder="nhập lại mật khẩu" />
          </FormField>
        </Stack>
      </section>

      {/* Fields with Errors */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Trường có lỗi</h2>
        <Stack gap="lg">
          <FormField 
            label="Địa chỉ email" 
            required 
            error="Email là bắt buộc"
          >
            <Input type="email" error placeholder="nhập email của bạn" />
          </FormField>

          <FormField 
            label="Mật khẩu" 
            required 
            error="Mật khẩu phải có ít nhất 8 ký tự"
          >
            <Input type="password" error />
          </FormField>

          <FormField 
            label="Số điện thoại" 
            error="Số điện thoại không hợp lệ"
          >
            <Input type="tel" error value="123" />
          </FormField>

          <FormField 
            label="Tuổi" 
            error="Tuổi phải từ 18 đến 100"
          >
            <Input type="number" error value="15" />
          </FormField>
        </Stack>
      </section>

      {/* Fields with Helper Text */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Trường có văn bản hướng dẫn</h2>
        <Stack gap="lg">
          <FormField 
            label="Địa chỉ email" 
            helperText="Chúng tôi sẽ không bao giờ chia sẻ email của bạn"
          >
            <Input type="email" placeholder="nhập email của bạn" />
          </FormField>

          <FormField 
            label="Mật khẩu" 
            helperText="Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số"
          >
            <Input type="password" placeholder="nhập mật khẩu" />
          </FormField>

          <FormField 
            label="Tên người dùng" 
            helperText="Chỉ sử dụng chữ cái, số và dấu gạch dưới"
          >
            <Input placeholder="nhập tên người dùng" />
          </FormField>
        </Stack>
      </section>

      {/* Complete Registration Form */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Form đăng ký hoàn chỉnh</h2>
        <Card>
          <CardHeader>
            <CardTitle>Đăng ký tài khoản</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap="lg">
              <FormField label="Họ và tên" required>
                <Input placeholder="nhập họ và tên của bạn" />
              </FormField>

              <FormField 
                label="Địa chỉ email" 
                required
                helperText="Chúng tôi sẽ gửi email xác nhận đến địa chỉ này"
              >
                <Input type="email" placeholder="nhập email của bạn" />
              </FormField>

              <FormField 
                label="Số điện thoại"
                helperText="Tùy chọn - để chúng tôi có thể liên hệ với bạn"
              >
                <Input type="tel" placeholder="nhập số điện thoại" />
              </FormField>

              <FormField 
                label="Mật khẩu" 
                required
                helperText="Ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số"
              >
                <Input type="password" placeholder="nhập mật khẩu" />
              </FormField>

              <FormField label="Xác nhận mật khẩu" required>
                <Input type="password" placeholder="nhập lại mật khẩu" />
              </FormField>
            </Stack>
          </CardContent>
          <CardFooter>
            <Flex gap="md" justify="end" className="w-full">
              <Button variant="outline">Hủy</Button>
              <Button>Đăng ký</Button>
            </Flex>
          </CardFooter>
        </Card>
      </section>

      {/* Login Form */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Form đăng nhập</h2>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Đăng nhập</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap="lg">
              <FormField label="Địa chỉ email" required>
                <Input type="email" placeholder="nhập email của bạn" />
              </FormField>

              <FormField label="Mật khẩu" required>
                <Input type="password" placeholder="nhập mật khẩu" />
              </FormField>
            </Stack>
          </CardContent>
          <CardFooter>
            <Flex gap="md" justify="between" className="w-full">
              <Button variant="link" size="sm">Quên mật khẩu?</Button>
              <Button>Đăng nhập</Button>
            </Flex>
          </CardFooter>
        </Card>
      </section>

      {/* Contact Form */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Form liên hệ</h2>
        <Card>
          <CardHeader>
            <CardTitle>Liên hệ với chúng tôi</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap="lg">
              <FormField label="Họ và tên" required>
                <Input placeholder="nhập họ và tên của bạn" />
              </FormField>

              <FormField label="Địa chỉ email" required>
                <Input type="email" placeholder="nhập email của bạn" />
              </FormField>

              <FormField label="Chủ đề" required>
                <Input placeholder="nhập chủ đề" />
              </FormField>

              <FormField 
                label="Tin nhắn" 
                required
                helperText="Tối đa 500 ký tự"
              >
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="nhập tin nhắn của bạn"
                />
              </FormField>
            </Stack>
          </CardContent>
          <CardFooter>
            <Flex gap="md" justify="end" className="w-full">
              <Button variant="outline">Hủy</Button>
              <Button>Gửi tin nhắn</Button>
            </Flex>
          </CardFooter>
        </Card>
      </section>

      {/* Form with Validation Errors */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Form với lỗi xác thực</h2>
        <Card>
          <CardHeader>
            <CardTitle>Cập nhật hồ sơ</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap="lg">
              <FormField 
                label="Tên người dùng" 
                required
                error="Tên người dùng đã tồn tại"
              >
                <Input error value="admin" />
              </FormField>

              <FormField 
                label="Địa chỉ email" 
                required
                error="Email không hợp lệ. Vui lòng sử dụng định dạng: ten@example.com"
              >
                <Input type="email" error value="invalid-email" />
              </FormField>

              <FormField 
                label="Số điện thoại"
                error="Số điện thoại phải có 10 chữ số"
              >
                <Input type="tel" error value="123" />
              </FormField>

              <FormField label="Địa chỉ">
                <Input value="123 Nguyễn Huệ, Quận 1, TP. HCM" />
              </FormField>
            </Stack>
          </CardContent>
          <CardFooter>
            <Flex gap="md" justify="end" className="w-full">
              <Button variant="outline">Hủy</Button>
              <Button>Lưu thay đổi</Button>
            </Flex>
          </CardFooter>
        </Card>
      </section>
    </div>
  )
}
