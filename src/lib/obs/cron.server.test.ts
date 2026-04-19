import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cronCreate: vi.fn(),
  cronUpdate: vi.fn(),
  sendCronError: vi.fn(),
}))

vi.mock('#/server/db', () => ({
  prisma: {
    cronRun: {
      create: mocks.cronCreate,
      update: mocks.cronUpdate,
    },
  },
}))

vi.mock('#/lib/logger.server', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}))

vi.mock('#/features/telegram/send-error', () => ({
  sendCronError: mocks.sendCronError,
}))

import { withCronRun } from './cron.server'

beforeEach(() => {
  mocks.cronCreate.mockReset()
  mocks.cronUpdate.mockReset()
  mocks.sendCronError.mockReset()
  mocks.cronCreate.mockResolvedValue({ id: 99 })
  mocks.cronUpdate.mockResolvedValue({})
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('withCronRun', () => {
  it('writes start row, ok finish row, and returns fn result on success', async () => {
    const out = await withCronRun('test-job', async () => ({
      result: { foo: 1 },
      metrics: { rows: 7 },
    }))

    expect(out).toEqual({ foo: 1 })
    expect(mocks.cronCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ jobName: 'test-job', status: 'ok' }),
    })
    expect(mocks.cronUpdate).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        status: 'ok',
        errorMsg: null,
        metrics: { rows: 7 },
      }),
    })
    expect(mocks.sendCronError).not.toHaveBeenCalled()
  })

  it('marks status=error and notifies error channel when fn returns partial failure', async () => {
    await withCronRun('test-job', async () => ({
      result: null,
      status: 'error' as const,
      errorMsg: '2/5 sources failed',
      metrics: { failed: 2 },
    }))

    expect(mocks.cronUpdate).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        status: 'error',
        errorMsg: '2/5 sources failed',
      }),
    })
    expect(mocks.sendCronError).toHaveBeenCalledWith({
      jobName: 'test-job',
      runId: 99,
      message: '2/5 sources failed',
    })
  })

  it('writes error row, notifies channel, and rethrows when fn throws', async () => {
    const boom = new Error('database exploded')

    await expect(
      withCronRun('test-job', async () => {
        throw boom
      }),
    ).rejects.toBe(boom)

    expect(mocks.cronUpdate).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({
        status: 'error',
        errorMsg: 'database exploded',
      }),
    })
    expect(mocks.sendCronError).toHaveBeenCalledWith({
      jobName: 'test-job',
      runId: 99,
      message: 'database exploded',
    })
  })

  it('coerces non-Error throws to a string message', async () => {
    await expect(
      withCronRun('test-job', async () => {
        throw 'plain string failure'
      }),
    ).rejects.toBe('plain string failure')

    expect(mocks.cronUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorMsg: 'plain string failure' }),
      }),
    )
  })
})
