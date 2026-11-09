'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import PostContentRenderer from '@/components/PostContentRenderer'
import { TEACHER_BEHIND_TEACHER_POST } from '@/lib/static-communications'

export function StaticCommunicationDetail({ mode }: { mode: 'admin' | 'user' }) {
  const post = TEACHER_BEHIND_TEACHER_POST
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <Link href={mode === 'admin' ? '/admin/truyenthong' : '/user/truyenthong'} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#a1001f]">
        <ArrowLeft className="h-4 w-4" /> Quay lại truyền thông
      </Link>
      <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {/* Local artwork is bundled with the application. */}
        <img src={post.featured_image} alt="Teacher Behind Teacher — Tri ân ngày Nhà giáo 20/11" width={866} height={1066} className="mx-auto h-auto w-full max-w-2xl" />
        <div className="space-y-6 p-5 sm:p-8">
          <header className="space-y-3">
            <p className="text-sm font-medium text-[#a1001f]">Sự kiện · <time dateTime="2026-11-09">09/11/2026</time></p>
            <h1 className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">{post.title}</h1>
          </header>
          <PostContentRenderer html={post.content} />
        </div>
      </article>
    </main>
  )
}
