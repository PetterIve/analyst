import { createHash } from 'node:crypto'

export interface NormalizedItem {
  url: string
  title: string
  bodyText: string | null
  publishedAt: Date | null
}

export function contentHash(title: string, bodyText: string | null): string {
  const normalized = `${title.trim()}\n${(bodyText ?? '').trim()}`
  return createHash('sha256').update(normalized).digest('hex')
}

export function dedupeBatch(items: ReadonlyArray<NormalizedItem>): NormalizedItem[] {
  const seenUrl = new Set<string>()
  const seenHash = new Set<string>()
  const out: NormalizedItem[] = []
  for (const item of items) {
    if (seenUrl.has(item.url)) continue
    const hash = contentHash(item.title, item.bodyText)
    if (seenHash.has(hash)) continue
    seenUrl.add(item.url)
    seenHash.add(hash)
    out.push(item)
  }
  return out
}
