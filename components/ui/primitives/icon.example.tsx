/**
 * Icon Component Examples
 * 
 * This file demonstrates various usage patterns for the Icon primitive component.
 */

import { Icon } from './icon'
import {
  Check,
  X,
  AlertCircle,
  Info,
  ChevronRight,
  Home,
  User,
  Settings,
  Mail,
  Phone,
  Calendar,
  Search,
  Heart,
  Star,
  Download,
} from 'lucide-react'

export function IconExamples() {
  return (
    <div className="space-y-8 p-8">
      <section>
        <h2 className="text-2xl font-bold mb-4">Kích thước icon</h2>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <Icon icon={Check} size="xs" />
            <span className="text-xs">xs (12px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon icon={Check} size="sm" />
            <span className="text-xs">sm (16px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon icon={Check} size="md" />
            <span className="text-xs">md (20px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon icon={Check} size="lg" />
            <span className="text-xs">lg (24px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon icon={Check} size="xl" />
            <span className="text-xs">xl (32px)</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Icon icon={Check} size="2xl" />
            <span className="text-xs">2xl (48px)</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Icon với màu sắc</h2>
        <div className="flex items-center gap-4">
          <Icon icon={Check} size="lg" className="text-green-600" aria-label="Thành công" />
          <Icon icon={X} size="lg" className="text-red-600" aria-label="Lỗi" />
          <Icon icon={AlertCircle} size="lg" className="text-yellow-600" aria-label="Cảnh báo" />
          <Icon icon={Info} size="lg" className="text-blue-600" aria-label="Thông tin" />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Icon trong button</h2>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded">
            <Icon icon={Download} size="sm" />
            <span>Tải xuống</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded">
            <span>Tiếp theo</span>
            <Icon icon={ChevronRight} size="sm" />
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Icon trong danh sách</h2>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <Icon icon={Home} size="sm" className="text-gray-600" />
            <span>Trang chủ</span>
          </li>
          <li className="flex items-center gap-2">
            <Icon icon={User} size="sm" className="text-gray-600" />
            <span>Hồ sơ</span>
          </li>
          <li className="flex items-center gap-2">
            <Icon icon={Settings} size="sm" className="text-gray-600" />
            <span>Cài đặt</span>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Icon trong form</h2>
        <div className="space-y-4 max-w-md">
          <div className="flex items-center gap-2 border rounded px-3 py-2">
            <Icon icon={Mail} size="sm" className="text-gray-400" />
            <input
              type="email"
              placeholder="Địa chỉ email"
              className="flex-1 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 border rounded px-3 py-2">
            <Icon icon={Phone} size="sm" className="text-gray-400" />
            <input
              type="tel"
              placeholder="Số điện thoại"
              className="flex-1 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 border rounded px-3 py-2">
            <Icon icon={Calendar} size="sm" className="text-gray-400" />
            <input
              type="date"
              className="flex-1 outline-none"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4">Icon tương tác</h2>
        <div className="flex gap-4">
          <button className="p-2 hover:bg-gray-100 rounded transition-colors">
            <Icon icon={Heart} size="md" className="text-red-500" aria-label="Yêu thích" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded transition-colors">
            <Icon icon={Star} size="md" className="text-yellow-500" aria-label="Đánh dấu" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded transition-colors">
            <Icon icon={Search} size="md" className="text-gray-600" aria-label="Tìm kiếm" />
          </button>
        </div>
      </section>
    </div>
  )
}
