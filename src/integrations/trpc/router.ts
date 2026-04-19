import { createTRPCRouter } from './init'
import { tickerRouter } from './routers/ticker'
import { factorRouter } from './routers/factor'
import { newsItemRouter } from './routers/news-item'
import { newsSourceRouter } from './routers/news-source'
import { priceRouter } from './routers/price'
import { cronRouter } from './routers/cron'
import { eventClassRouter, eventInstanceRouter } from '#/features/event-catalog'

export const trpcRouter = createTRPCRouter({
  ticker: tickerRouter,
  factor: factorRouter,
  newsItem: newsItemRouter,
  newsSource: newsSourceRouter,
  price: priceRouter,
  cron: cronRouter,
  eventClass: eventClassRouter,
  eventInstance: eventInstanceRouter,
})

export type TRPCRouter = typeof trpcRouter
