import type { ReactNode } from 'react'

interface IconProps {
  size?: number
}

function Svg({ size = 14, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export const Icon = {
  bell: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </Svg>
  ),
  ticker: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 14l3-4 3 3 4-6" />
    </Svg>
  ),
  sliders: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="7" cy="18" r="2" fill="currentColor" />
    </Svg>
  ),
  layers: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </Svg>
  ),
  feed: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" />
    </Svg>
  ),
  x: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <path d="M4 4l16 16M20 4L4 20" />
    </Svg>
  ),
  cpu: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <rect x="5" y="5" width="14" height="14" rx="1" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </Svg>
  ),
  terminal: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <polyline points="7 9 10 12 7 15" />
      <line x1="12" y1="15" x2="17" y2="15" />
    </Svg>
  ),
  chart: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 3 3 5-7" />
    </Svg>
  ),
  clock: ({ size }: IconProps = {}) => (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </Svg>
  ),
}

export type IconName = keyof typeof Icon
