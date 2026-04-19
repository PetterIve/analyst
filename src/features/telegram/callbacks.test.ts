import { describe, expect, it } from 'vitest'
import { parseCallback } from './callbacks'

describe('parseCallback', () => {
  it('parses valid rate:up payload', () => {
    expect(parseCallback('rate:42:up')).toEqual({
      prefix: 'rate',
      alertId: 42,
      value: 'up',
    })
  })

  it('parses valid rate:down payload', () => {
    expect(parseCallback('rate:9:down')).toEqual({
      prefix: 'rate',
      alertId: 9,
      value: 'down',
    })
  })

  it('rejects wrong segment count', () => {
    expect(parseCallback('rate:42')).toBeNull()
    expect(parseCallback('rate:42:up:extra')).toBeNull()
  })

  it('rejects unknown prefix', () => {
    expect(parseCallback('mute:42:up')).toBeNull()
  })

  it('accepts alertId 0 (boundary case, not semantically meaningful but parseable)', () => {
    expect(parseCallback('rate:0:up')).toEqual({
      prefix: 'rate',
      alertId: 0,
      value: 'up',
    })
  })

  it('rejects non-integer or negative alertId', () => {
    expect(parseCallback('rate:abc:up')).toBeNull()
    expect(parseCallback('rate:-1:up')).toBeNull()
    expect(parseCallback('rate:1.5:up')).toBeNull()
  })

  it('rejects numeric-prefix garbage like rate:42abc:up', () => {
    // parseInt would quietly return 42 and accept the payload.
    expect(parseCallback('rate:42abc:up')).toBeNull()
    expect(parseCallback('rate:42 :up')).toBeNull()
    expect(parseCallback('rate:+42:up')).toBeNull()
  })

  it('rejects unknown rating value', () => {
    expect(parseCallback('rate:42:maybe')).toBeNull()
  })
})
