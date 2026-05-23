/**
 * Input Component Examples
 * 
 * Demonstrates all input sizes, states, and types with Vietnamese content.
 */

import { Input } from './input'
import { Stack } from './stack'
import { Grid } from './grid'
import { Text } from './text'

export function InputExamples() {
  return (
    <div className="space-y-12 p-8 max-w-4xl">
      {/* Input Sizes */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Kích thước input</h2>
        <Stack gap="md">
          <div>
            <Text size="sm" weight="medium" className="mb-2">Nhỏ (32px)</Text>
            <Input size="sm" placeholder="nhập văn bản" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Trung bình (36px) - Mặc định</Text>
            <Input size="md" placeholder="nhập văn bản" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Lớn (40px)</Text>
            <Input size="lg" placeholder="nhập văn bản" />
          </div>
        </Stack>
      </section>

      {/* Input States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Trạng thái input</h2>
        <Stack gap="md">
          <div>
            <Text size="sm" weight="medium" className="mb-2">Mặc định</Text>
            <Input placeholder="nhập văn bản" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Lỗi</Text>
            <Input error placeholder="nhập văn bản" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Vô hiệu hóa</Text>
            <Input disabled placeholder="không thể chỉnh sửa" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Chỉ đọc</Text>
            <Input readOnly value="Giá trị chỉ đọc" />
          </div>
        </Stack>
      </section>

      {/* Input Types */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Các loại input</h2>
        <Grid cols={2} gap="lg">
          <div>
            <Text size="sm" weight="medium" className="mb-2">Text</Text>
            <Input type="text" placeholder="nhập văn bản" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Email</Text>
            <Input type="email" placeholder="nhập email của bạn" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Password</Text>
            <Input type="password" placeholder="nhập mật khẩu" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Number</Text>
            <Input type="number" placeholder="nhập số" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Tel</Text>
            <Input type="tel" placeholder="nhập số điện thoại" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">URL</Text>
            <Input type="url" placeholder="nhập địa chỉ website" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Date</Text>
            <Input type="date" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Time</Text>
            <Input type="time" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Search</Text>
            <Input type="search" placeholder="tìm kiếm..." />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Color</Text>
            <Input type="color" />
          </div>
        </Grid>
      </section>

      {/* Input with Values */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Input với giá trị</h2>
        <Stack gap="md">
          <Input defaultValue="Nguyễn Văn An" />
          <Input defaultValue="nguyenvanan@email.com" type="email" />
          <Input defaultValue="0123 456 789" type="tel" />
        </Stack>
      </section>

      {/* Full Width vs Fixed Width */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Độ rộng input</h2>
        <Stack gap="md">
          <div>
            <Text size="sm" weight="medium" className="mb-2">Toàn bộ chiều rộng (mặc định)</Text>
            <Input placeholder="input chiếm toàn bộ chiều rộng" />
          </div>
          <div>
            <Text size="sm" weight="medium" className="mb-2">Chiều rộng cố định</Text>
            <Input placeholder="input với chiều rộng cố định" className="max-w-xs" />
          </div>
        </Stack>
      </section>
    </div>
  )
}
