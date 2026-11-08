import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TeacherPortfolioPublicView } from '@/components/teacher-portfolio/teacher-portfolio-public-view'
import { getTeacherPortfolioShareView } from '@/lib/teacher-portfolio/service'
import type { TeacherPortfolioTemplate } from '@/lib/teacher-portfolio/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Teacher Portfolio | MindX Technology School',
  description: 'Hồ sơ chuyên môn giáo viên trên Teaching Portal System.',
  robots: { index: false, follow: false, nocache: true },
}

export default async function TeacherPortfolioSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ demo?: string | string[]; template?: string | string[] }>
}) {
  const { slug } = await params
  const query = await searchParams
  const result = await getTeacherPortfolioShareView(slug)
  if (result.status !== 'ok') notFound()

  const rawTemplate = Array.isArray(query.template) ? query.template[0] : query.template
  const template: TeacherPortfolioTemplate = rawTemplate === '2' ? 2 : rawTemplate === '3' ? 3 : rawTemplate === '4' ? 4 : 1
  return <TeacherPortfolioPublicView data={result.data} demoMode={query.demo === '1'} template={template} />
}
