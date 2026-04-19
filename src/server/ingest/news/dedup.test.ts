import { describe, expect, it } from 'vitest'
import { contentHash, dedupeBatch, type NormalizedItem } from './dedup'

const item = (overrides: Partial<NormalizedItem> = {}): NormalizedItem => ({
  url: 'https://example.com/a',
  title: 'Tanker market tightens',
  bodyText: 'VLCC rates surged 12% overnight.',
  publishedAt: new Date('2026-04-19T10:00:00Z'),
  ...overrides,
})

describe('contentHash', () => {
  it('is stable for identical inputs', () => {
    expect(contentHash('a', 'b')).toBe(contentHash('a', 'b'))
  })

  it('ignores leading/trailing whitespace around title and body', () => {
    expect(contentHash('  a  ', '  b  ')).toBe(contentHash('a', 'b'))
  })

  it('distinguishes different titles', () => {
    expect(contentHash('a', 'b')).not.toBe(contentHash('c', 'b'))
  })

  it('treats null body like empty string', () => {
    expect(contentHash('t', null)).toBe(contentHash('t', ''))
  })
})

describe('dedupeBatch', () => {
  it('drops duplicate URLs within a batch', () => {
    const out = dedupeBatch([
      item({ url: 'https://a.test/1', title: 'one' }),
      item({ url: 'https://a.test/1', title: 'one' }),
    ])
    expect(out).toHaveLength(1)
  })

  it('drops items with duplicate content hash even if URLs differ', () => {
    const out = dedupeBatch([
      item({ url: 'https://a.test/1', title: 'Rates jump', bodyText: 'same body' }),
      item({ url: 'https://b.test/2', title: 'Rates jump', bodyText: 'same body' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].url).toBe('https://a.test/1')
  })

  it('keeps items with the same URL base path but different hashes', () => {
    const out = dedupeBatch([
      item({ url: 'https://a.test/1', title: 'One' }),
      item({ url: 'https://a.test/2', title: 'Two' }),
    ])
    expect(out).toHaveLength(2)
  })
})
