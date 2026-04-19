/**
 * Event-catalog feature barrel — public surface.
 *
 * Everything the rest of the app needs from this feature is re-exported
 * here. Internals (seed data arrays, helper functions) stay reachable via
 * subpath imports for tests and tooling, but consumers should prefer this
 * barrel so the feature's external API is grep-able from one place.
 */

// Lib (pure helpers — useful from tRPC, scripts, T11 alert composer)
export {
  computeEventReturns,
  recomputeAllEventReturns,
  returnsFromAdjCloses,
  type TickerReturns,
  type TickerReturnsMap,
} from './lib/compute-returns'
export {
  eventClassStats,
  isLowSample,
  parseTickerReturns,
  tickerStatsInClass,
  type EventClassStats,
  type ReturnStats,
} from './lib/stats'

// Seed orchestration (called by prisma/seed.ts)
export { applyEventClassSeeds, applyEventInstanceSeeds } from './seed/apply'

// tRPC routers (registered in src/integrations/trpc/router.ts)
export { eventClassRouter } from './trpc/event-class'
export { eventInstanceRouter } from './trpc/event-instance'

// React pages (mounted by src/routes/admin/events/*)
export { CatalogPage } from './ui/CatalogPage'
export { DrillDownPage } from './ui/DrillDownPage'
