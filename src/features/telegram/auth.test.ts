import { describe, expect, it } from 'vitest'
import { verifyCronBearer, verifyTelegramSecret } from './auth'

function headers(entries: Record<string, string> = {}): Headers {
  return new Headers(entries)
}

describe('verifyTelegramSecret', () => {
  it('accepts a matching header when a secret is configured', () => {
    expect(
      verifyTelegramSecret(
        headers({ 'x-telegram-bot-api-secret-token': 's3cret' }),
        { expectedSecret: 's3cret', nodeEnv: 'production' },
      ),
    ).toBe(true)
  })

  it('rejects a mismatched header in production', () => {
    expect(
      verifyTelegramSecret(
        headers({ 'x-telegram-bot-api-secret-token': 'wrong' }),
        { expectedSecret: 's3cret', nodeEnv: 'production' },
      ),
    ).toBe(false)
  })

  it('rejects a missing header in production', () => {
    expect(
      verifyTelegramSecret(headers(), {
        expectedSecret: 's3cret',
        nodeEnv: 'production',
      }),
    ).toBe(false)
  })

  it('rejects a mismatched header in dev too — a configured secret is always enforced', () => {
    expect(
      verifyTelegramSecret(
        headers({ 'x-telegram-bot-api-secret-token': 'wrong' }),
        { expectedSecret: 's3cret', nodeEnv: 'development' },
      ),
    ).toBe(false)
  })

  it('fails closed in production when no secret is configured', () => {
    expect(
      verifyTelegramSecret(headers(), {
        expectedSecret: undefined,
        nodeEnv: 'production',
      }),
    ).toBe(false)
  })

  it('fails open in development when no secret is configured', () => {
    expect(
      verifyTelegramSecret(headers(), {
        expectedSecret: undefined,
        nodeEnv: 'development',
      }),
    ).toBe(true)
  })

  it('fails open when NODE_ENV is unset (treats it as non-production)', () => {
    expect(
      verifyTelegramSecret(headers(), {
        expectedSecret: undefined,
        nodeEnv: undefined,
      }),
    ).toBe(true)
  })
})

describe('verifyCronBearer', () => {
  it('accepts matching Bearer token in production', () => {
    expect(
      verifyCronBearer(
        headers({ authorization: 'Bearer shhh' }),
        { cronSecret: 'shhh', nodeEnv: 'production' },
      ),
    ).toBe(true)
  })

  it('rejects a wrong scheme even with matching value', () => {
    expect(
      verifyCronBearer(
        headers({ authorization: 'Basic shhh' }),
        { cronSecret: 'shhh', nodeEnv: 'production' },
      ),
    ).toBe(false)
  })

  it('rejects a bare token without the Bearer prefix', () => {
    expect(
      verifyCronBearer(
        headers({ authorization: 'shhh' }),
        { cronSecret: 'shhh', nodeEnv: 'production' },
      ),
    ).toBe(false)
  })

  it('rejects missing header in production', () => {
    expect(
      verifyCronBearer(headers(), {
        cronSecret: 'shhh',
        nodeEnv: 'production',
      }),
    ).toBe(false)
  })

  it('fails closed in production when no secret is configured', () => {
    expect(
      verifyCronBearer(headers(), {
        cronSecret: undefined,
        nodeEnv: 'production',
      }),
    ).toBe(false)
  })

  it('fails open in development when no secret is configured', () => {
    expect(
      verifyCronBearer(headers(), {
        cronSecret: undefined,
        nodeEnv: 'development',
      }),
    ).toBe(true)
  })
})
