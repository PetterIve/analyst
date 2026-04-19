import { createFileRoute } from '@tanstack/react-router'
import { CatalogPage } from '#/features/event-catalog'

export const Route = createFileRoute('/admin/events/')({
  component: CatalogPage,
})
