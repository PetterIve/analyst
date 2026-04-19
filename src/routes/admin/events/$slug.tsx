import { createFileRoute, useParams } from '@tanstack/react-router'
import { DrillDownPage } from '#/features/event-catalog'

export const Route = createFileRoute('/admin/events/$slug')({
  component: DrillDownRoute,
})

function DrillDownRoute() {
  const { slug } = useParams({ from: '/admin/events/$slug' })
  return <DrillDownPage slug={slug} />
}
