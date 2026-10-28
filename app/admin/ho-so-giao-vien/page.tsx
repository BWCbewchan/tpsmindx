import { Suspense } from 'react'
import TeacherProfilePage from '../page1/page'

export const metadata = { title: 'Hồ sơ giáo viên | TPS' }

export default function TeacherProfileRoute() {
  return <Suspense fallback={null}><TeacherProfilePage /></Suspense>
}
