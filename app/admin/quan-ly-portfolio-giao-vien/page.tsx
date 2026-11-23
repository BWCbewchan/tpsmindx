import type { Metadata } from 'next'

import { TeacherPortfolioManagementClient } from './TeacherPortfolioManagementClient'

export const metadata: Metadata = {
  title: 'Quản Lý Portfolio Giáo Viên | TPS',
  description: 'Danh sách Portfolio giáo viên dành cho HC.',
}

export default function TeacherPortfolioManagementPage() {
  return <TeacherPortfolioManagementClient />
}
