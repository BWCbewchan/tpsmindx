import { notFound } from 'next/navigation'

/** Chỉ dùng nội bộ: middleware rewrite tới đây để render UI 404. */
export default function TempHidden404Page() {
  notFound()
}
