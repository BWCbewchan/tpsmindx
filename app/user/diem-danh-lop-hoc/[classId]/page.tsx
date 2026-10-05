import { redirect } from 'next/navigation'

export default async function LegacyAttendanceClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>
}) {
  const { classId } = await params
  redirect(`/user/lop-hoc?classId=${encodeURIComponent(classId)}`)
}
