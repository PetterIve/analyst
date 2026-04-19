import { useEffect, useState } from 'react'

type Theme = 'quant' | 'terminal' | 'research'
type Density = 'comfortable' | 'compact'

const THEMES: ReadonlyArray<[Theme, string]> = [
  ['quant', 'Quant'],
  ['terminal', 'Term'],
  ['research', 'Research'],
]
const DENSITIES: ReadonlyArray<[Density, string]> = [
  ['comfortable', 'Comfy'],
  ['compact', 'Compact'],
]

const NOTES: Record<Theme, string> = {
  quant: 'Modern dark quant. Neutral slate, cool accent. Default.',
  terminal: 'Bloomberg-terminal energy. Monospace throughout, amber on black.',
  research: 'Research-report mode. Light, serif headlines, ink-navy accent.',
}

export function Tweaks() {
  const [theme, setTheme] = useState<Theme>('quant')
  const [density, setDensity] = useState<Density>('comfortable')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const storedTheme = localStorage.getItem('an_theme') as Theme | null
    const storedDensity = localStorage.getItem('an_density') as Density | null
    if (storedTheme) setTheme(storedTheme)
    if (storedDensity) setDensity(storedDensity)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('an_theme', theme)
  }, [theme, hydrated])

  useEffect(() => {
    if (!hydrated) return
    document.documentElement.setAttribute('data-density', density)
    localStorage.setItem('an_density', density)
  }, [density, hydrated])

  return (
    <div className="tweaks">
      <div className="tweaks-title">
        <span>Tweaks</span>
        <span className="label-xs">design</span>
      </div>
      <div className="tweaks-row">
        <span>Aesthetic</span>
        <div className="seg">
          {THEMES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={theme === k}
              onClick={() => setTheme(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="tweaks-row">
        <span>Density</span>
        <div className="seg">
          {DENSITIES.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={density === k}
              onClick={() => setDensity(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <hr className="hr-dot" />
      <div className="label-xs" style={{ marginBottom: 6 }}>
        Variant notes
      </div>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>
        {NOTES[theme]}
      </div>
    </div>
  )
}
