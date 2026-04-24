import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'os'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  cacheDir: path.join(os.tmpdir(), 'vite-Static Code Analyzer-cache'),
  optimizeDeps: {
    force: true,
  },
})
