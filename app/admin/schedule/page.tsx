import type { Metadata } from 'next'
import { ScheduleRegistrationClient } from './ScheduleRegistrationClient'

export const metadata: Metadata = {
  title: 'Đăng ký lịch làm việc | TPS',
  description: 'Đăng ký lịch làm việc theo tháng dành cho Team Teaching.',
}

export default function TeachingSchedulePage() {
  return <ScheduleRegistrationClient />
}
