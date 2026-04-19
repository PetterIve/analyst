import { describe, expect, it } from 'vitest'
import { parseRssFromString } from './rss'

const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Feed</title>
    <link>https://example.com/</link>
    <description>Test feed</description>
    <item>
      <title>VLCC rates surge on Red Sea disruption</title>
      <link>https://example.com/article/1</link>
      <pubDate>Sat, 19 Apr 2026 08:00:00 GMT</pubDate>
      <description><![CDATA[<p>Spot <b>rates</b> jumped 12% overnight as…</p>]]></description>
    </item>
    <item>
      <title>OPEC+ extends voluntary cuts</title>
      <link>https://example.com/article/2</link>
      <pubDate>Sat, 19 Apr 2026 09:30:00 GMT</pubDate>
      <description>Plain summary without HTML.</description>
    </item>
    <item>
      <title>Missing link item</title>
      <description>Should be dropped — no url.</description>
    </item>
  </channel>
</rss>`

describe('parseRssFromString', () => {
  it('normalizes items to {url, title, bodyText, publishedAt}', async () => {
    const items = await parseRssFromString(FIXTURE)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      url: 'https://example.com/article/1',
      title: 'VLCC rates surge on Red Sea disruption',
    })
    expect(items[0].publishedAt).toBeInstanceOf(Date)
  })

  it('strips HTML from body text', async () => {
    const items = await parseRssFromString(FIXTURE)
    const first = items[0]
    expect(first.bodyText).toBeDefined()
    expect(first.bodyText).not.toContain('<')
    expect(first.bodyText).toMatch(/rates jumped 12%/)
  })

  it('falls back to plain summary when no html body is present', async () => {
    const items = await parseRssFromString(FIXTURE)
    expect(items[1].bodyText).toBe('Plain summary without HTML.')
  })

  it('drops items that have no link', async () => {
    const items = await parseRssFromString(FIXTURE)
    expect(items.every((i) => i.url)).toBe(true)
  })
})
