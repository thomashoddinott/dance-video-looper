import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    /* Carried over from the spike, which learned it the hard way: only
       `http://localhost:5173` is a registered OAuth origin, so a port that
       drifts to 5174 because 5173 was busy breaks sign-in — and it breaks it
       intermittently, pointing at Google rather than at the port. Failing to
       start is the better outcome. */
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
