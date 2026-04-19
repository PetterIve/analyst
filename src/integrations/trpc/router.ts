import { createTRPCRouter } from './init'
import { tickerRouter } from './routers/ticker'
import { factorRouter } from './routers/factor'
import { newsItemRouter } from './routers/news-item'
import { newsSourceRouter } from './routers/news-source'
import { cronRouter } from './routers/cron'

export const trpcRouter = createTRPCRouter({
  ticker: tickerRouter,
  factor: factorRouter,
  newsItem: newsItemRouter,
  newsSource: newsSourceRouter,
  cron: cronRouter,
})

export type TRPCRouter = typeof trpcRouter
