import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  telegramConfigured: vi.fn(() => true),
}))

vi.mock('./bot.js', () => ({
  getBot: () => ({ api: { sendMessage: mocks.sendMessage } }),
  telegramConfigured: mocks.telegramConfigured,
}))

vi.mock('#/lib/logger.server', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { sendCronError } from './send-error'

const originalEnv = { ...process.env }

beforeEach(() => {
  mocks.sendMessage.mockReset()
  mocks.sendMessage.mockResolvedValue({})
  mocks.telegramConfigured.mockReset()
  mocks.telegramConfigured.mockReturnValue(true)
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.clearAllMocks()
})

describe('sendCronError', () => {
  it('no-ops when TELEGRAM_ERROR_CHAT_ID is unset', async () => {
    delete process.env.TELEGRAM_ERROR_CHAT_ID
    const ok = await sendCronError({
      jobName: 'ingest-news',
      runId: 1,
      message: 'boom',
    })
    expect(ok).toBe(false)
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it('no-ops when telegram is not configured (no bot token)', async () => {
    process.env.TELEGRAM_ERROR_CHAT_ID = '-100111'
    mocks.telegramConfigured.mockReturnValue(false)
    const ok = await sendCronError({
      jobName: 'ingest-news',
      runId: 1,
      message: 'boom',
    })
    expect(ok).toBe(false)
    expect(mocks.sendMessage).not.toHaveBeenCalled()
  })

  it('posts an HTML message with job, run id, and escaped error', async () => {
    process.env.TELEGRAM_ERROR_CHAT_ID = '-100111'
    const ok = await sendCronError({
      jobName: 'ingest-prices',
      runId: 42,
      message: 'fetch failed: <html> from <upstream>',
    })

    expect(ok).toBe(true)
    expect(mocks.sendMessage).toHaveBeenCalledTimes(1)
    const [chatId, text, opts] = mocks.sendMessage.mock.calls[0]
    expect(chatId).toBe('-100111')
    expect(opts).toEqual({ parse_mode: 'HTML' })
    expect(text).toContain('ingest-prices')
    expect(text).toContain('run #42')
    expect(text).toContain('&lt;html&gt;')
    expect(text).toContain('&lt;upstream&gt;')
  })

  it('truncates very long error messages', async () => {
    process.env.TELEGRAM_ERROR_CHAT_ID = '-100111'
    const longMsg = 'x'.repeat(5000)
    await sendCronError({
      jobName: 'job',
      runId: 1,
      message: longMsg,
    })
    const [, text] = mocks.sendMessage.mock.calls[0]
    expect(text.length).toBeLessThan(4096)
    expect(text).toContain('…')
  })

  it('returns false and logs when telegram throws', async () => {
    process.env.TELEGRAM_ERROR_CHAT_ID = '-100111'
    mocks.sendMessage.mockRejectedValueOnce(new Error('telegram api down'))
    const ok = await sendCronError({
      jobName: 'job',
      runId: 1,
      message: 'boom',
    })
    expect(ok).toBe(false)
  })
})
