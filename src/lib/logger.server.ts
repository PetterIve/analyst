import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'
const LOG_DIR = resolve(process.cwd(), 'logs')
mkdirSync(LOG_DIR, { recursive: true })

const targets: pino.TransportTargetOptions[] = [
  {
    target: 'pino-roll',
    level: isDev ? 'debug' : 'info',
    options: {
      file: resolve(LOG_DIR, 'app.log'),
      frequency: 'daily',
      size: '10m',
      limit: { count: 14 },
      mkdir: true,
      dateFormat: 'yyyy-MM-dd',
    },
  },
]

if (isDev) {
  targets.push({
    target: 'pino-pretty',
    level: 'debug',
    options: { colorize: true },
  })
}

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: { targets },
})
