import { createTRPCRouter } from './init'
import { tickerRouter } from './routers/ticker'
import { factorRouter } from './routers/factor'
import { priceRouter } from './routers/price'

export const trpcRouter = createTRPCRouter({
  ticker: tickerRouter,
  factor: factorRouter,
  price: priceRouter,
})

export type TRPCRouter = typeof trpcRouter
