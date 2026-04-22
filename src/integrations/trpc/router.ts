import { createTRPCRouter } from './init'
import { tickerRouter } from './routers/ticker'
import { factorRouter } from './routers/factor'
import { newsItemRouter } from './routers/news-item'
import { newsSourceRouter } from './routers/news-source'
import { priceRouter } from './routers/price'
import { cronRouter } from './routers/cron'
import { extractorRouter } from './routers/extractor'
import { candidateRouter } from './routers/candidate'
import { dashboardRouter } from './routers/dashboard'
import { alertRouter } from './routers/alert'
import { engineRouter } from './routers/engine'
import { factorHistoryRouter } from './routers/factor-history'
import { eventClassRouter, eventInstanceRouter } from '#/features/event-catalog'

export const trpcRouter = createTRPCRouter({
  ticker: tickerRouter,
  factor: factorRouter,
  newsItem: newsItemRouter,
  newsSource: newsSourceRouter,
  price: priceRouter,
  cron: cronRouter,
  extractor: extractorRouter,
  candidate: candidateRouter,
  dashboard: dashboardRouter,
  alert: alertRouter,
  engine: engineRouter,
  factorHistory: factorHistoryRouter,
  eventClass: eventClassRouter,
  eventInstance: eventInstanceRouter,
})

export type TRPCRouter = typeof trpcRouter
