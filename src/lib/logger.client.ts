type Level = 'debug' | 'info' | 'warn' | 'error'

type Entry = {
  level: Level
  msg: string
  args: unknown[]
  ts: number
  url: string
}

const isDev = import.meta.env.DEV
const FLUSH_INTERVAL_MS = 2000
const MAX_BATCH = 50

const buffer: Entry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function safeSerialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  try {
    JSON.stringify(value)
    return value
  } catch {
    return String(value)
  }
}

async function flush() {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return
  const batch = buffer.splice(0, buffer.length)
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: batch }),
      keepalive: true,
    })
  } catch {
    // Swallow — logging failures must not crash the app
  }
}

function scheduleFlush() {
  if (buffer.length >= MAX_BATCH) {
    void flush()
    return
  }
  if (flushTimer) return
  flushTimer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS)
}

function enqueue(level: Level, msg: string, args: unknown[]) {
  // biome-ignore lint/suspicious/noConsole: passthrough to devtools
  console[level === 'debug' ? 'log' : level](msg, ...args)
  if (!isDev || typeof window === 'undefined') return
  buffer.push({
    level,
    msg,
    args: args.map(safeSerialize),
    ts: Date.now(),
    url: window.location.pathname,
  })
  scheduleFlush()
}

if (typeof window !== 'undefined' && isDev) {
  window.addEventListener('beforeunload', () => void flush())
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => enqueue('debug', msg, args),
  info: (msg: string, ...args: unknown[]) => enqueue('info', msg, args),
  warn: (msg: string, ...args: unknown[]) => enqueue('warn', msg, args),
  error: (msg: string, ...args: unknown[]) => enqueue('error', msg, args),
}
