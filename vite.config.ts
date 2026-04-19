import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import neon from './neon-vite-plugin.ts'

const useNeon = process.env.USE_NEON === '1'

const config = defineConfig({
  server: { port: Number(process.env.VITE_PORT) || 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    ...(useNeon ? [neon] : []),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
