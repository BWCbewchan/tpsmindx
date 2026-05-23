'use client'

import { PageContainer } from '@/components/PageContainer'
import { ManagerCentersAssignment } from '@/components/admin/ManagerCentersAssignment'
import { PageHeader } from '@/components/PageHeader'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'

export default function ManagerCentersPage() {
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      router.push('/admin')
    }
  }, [user, router])

  if (!user || user.role !== 'super_admin') {
    return null
  }

  return (
    <PageContainer>
      <PageHeader
        title="Phân Quyền Cơ Sở cho Manager"
        description="Gán các cơ sở mà mỗi manager/admin có thể quản lý"
      />

      <div className="bg-white rounded-lg shadow p-6">
        <ManagerCentersAssignment />
      </div>
    </PageContainer>
  )
}
