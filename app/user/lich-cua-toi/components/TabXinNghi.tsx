'use client'

import dynamic from 'next/dynamic'

const XinNghiContent = dynamic(
  () => import('./XinNghiContent'),
  { ssr: false, loading: () => <div className="p-8"><div className="h-10 w-72 animate-pulse rounded bg-gray-200 mb-4" /><div className="h-96 animate-pulse rounded-xl bg-gray-100" /></div> }
)

interface Props {
  onRefreshBadge?: () => void
  initialLeaveDate?: string | null
  externalOpen?: boolean
  onCreated?: () => void
}

export default function TabXinNghi({ onRefreshBadge, initialLeaveDate, externalOpen, onCreated }: Props) {
  return <XinNghiContent initialLeaveDate={initialLeaveDate ?? undefined} externalOpen={externalOpen} onCreated={onCreated} />
}
