import { FacilityEvaluationPublicForm } from './FacilityEvaluationPublicForm'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ token: string }>
}

export default async function FacilityEvaluationPublicPage({ params }: PageProps) {
  const { token } = await params
  return <FacilityEvaluationPublicForm token={token} />
}
