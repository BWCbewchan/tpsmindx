'use client'

import { BellRing, Loader2, Smartphone } from 'lucide-react'
import { useDevicePush } from './DevicePushProvider'
import { InstallTpsApp } from './InstallTpsApp'

export function DevicePushSetting() {
  const { state, enable, disable, test, refresh } = useDevicePush()
  const togglePush = () => state.enabled ? disable() : enable()
  const sendTestNotification = test

  const unavailableMessage = (() => {
    if (state.reason === 'ios-install-required') {
      return 'Hãy cài TPS bằng nút bên trên, sau đó mở TPS từ Màn hình chính để bật thông báo.'
    }
    if (state.reason === 'insecure-context') {
      return 'Thông báo thiết bị chỉ hoạt động trên kết nối HTTPS.'
    }
    if (state.reason === 'not-configured') {
      return 'Máy chủ TPS chưa cấu hình khóa Web Push.'
    }
    if (state.reason === 'browser-unsupported') {
      return 'Trình duyệt này chưa hỗ trợ Web Push. Thông báo trong ứng dụng vẫn hoạt động.'
    }
    if (state.permission === 'denied') {
      return 'Quyền thông báo đang bị chặn trong cài đặt trình duyệt.'
    }
    return null
  })()

  return (
    <div className="page-module__Qo6x2W__settingRow">
      <div className="page-module__Qo6x2W__settingInfo">
        <span className="page-module__Qo6x2W__settingLabel flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-[#a1001f]" />
          Thông báo thiết bị (Điện thoại & Máy tính)
        </span>
        <span className="page-module__Qo6x2W__settingSub">
          Nhận thông báo kể cả khi bạn không mở TPS. Android hỗ trợ trực tiếp;
          iPhone/iPad cần cài TPS vào Màn hình chính.
        </span>

        <InstallTpsApp />
        {state.error && <div className="mt-2 text-sm text-red-700" role="alert"><p>{state.error}</p><button type="button" className="mt-1 min-h-11 underline" onClick={() => void refresh()} disabled={state.checking}>Kiểm tra lại</button></div>}
        <span className="mt-2 text-xs text-slate-500">{state.checking ? 'Đang kiểm tra đăng ký…' : state.enabled ? 'Đã đăng ký nhận thông báo trên thiết bị này.' : 'Thiết bị này chưa bật thông báo.'}</span>

        {typeof unavailableMessage === 'string' ? (
          <span className="mt-2 text-xs font-medium text-amber-700">
            {unavailableMessage}
          </span>
        ) : (
          unavailableMessage
        )}

        {state.enabled ? (
          <button
            onClick={() => void sendTestNotification()}
            disabled={state.busy}
            className="mt-2 inline-flex w-fit items-center gap-1.5 text-xs font-bold text-[#a1001f] hover:underline disabled:opacity-50"
            type="button"
          >
            <BellRing className="h-3.5 w-3.5" />
            Gửi thông báo thử nghiệm
          </button>
        ) : null}
      </div>

      <label
        className={`relative inline-flex min-h-11 items-center ${
          state.reason ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
      >
        {state.checking || state.busy ? (
          <Loader2 className="mr-3 h-4 w-4 animate-spin text-[#a1001f]" />
        ) : null}
        <input
          type="checkbox"
          className="peer sr-only"
          aria-label="Bật thông báo thiết bị"
          checked={state.enabled}
          disabled={state.checking || state.busy || Boolean(state.reason)}
          onChange={() => void togglePush()}
        />
        <div className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-3 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#a1001f] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#a1001f]/30 peer-focus-visible:ring-offset-2" />
      </label>
    </div>
  )
}
