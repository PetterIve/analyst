type TokenGetter = () => Promise<string | null>

let current: TokenGetter | null = null

export function setTokenGetter(getter: TokenGetter | null) {
  current = getter
}

export async function getClerkTokenSafe(): Promise<string | null> {
  if (!current) return null
  try {
    return (await current()) ?? null
  } catch {
    return null
  }
}
