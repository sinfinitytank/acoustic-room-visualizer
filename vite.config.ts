import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  // GitHub Pages serves project sites from /<repository>/ rather than /.
  // Keep the root path for local development and other hosting targets.
  base: process.env.GITHUB_ACTIONS ? '/acoustic-room-visualizer/' : '/',
  plugins: [react(), tailwindcss()],
})
