import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/* GitHub Pages serves static files and nothing else — there is no rewrite rule to
   hand an unknown path back to the app. So a reload on anything but the root, or a
   link straight to a saved loop, gets GitHub's own 404 rather than the router. The
   standard fix for a history-API SPA is to serve a copy of `index.html` as
   `404.html`: Pages returns it, the app boots, and the router reads the URL it was
   asked for. Costs one duplicated file in `dist`.

   Emitted through Rollup rather than copied with `node:fs`, so the config needs no
   `@types/node` — which this tsconfig would apply to `src` as well, handing Node
   globals to browser-only code that should never see them. `enforce: 'post'` puts
   this after Vite's own HTML plugin, so `index.html` is in the bundle to copy. */
const pagesSpaFallback = (): Plugin => ({
  name: 'pages-spa-fallback',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const index = bundle['index.html']

    if (!index || index.type !== 'asset') {
      this.error('pages-spa-fallback: no index.html in the bundle to copy to 404.html')
    }

    this.emitFile({ type: 'asset', fileName: '404.html', source: index.source })
  },
})

export default defineConfig({
  /* A project site is served from `https://<user>.github.io/<repo>/`, not from the
     domain root, so every asset URL needs the repo name in front of it. Set here
     rather than only for `build` so dev serves from the same path and exercises the
     same `import.meta.env.BASE_URL` the router reads (`src/main.tsx`) — a base-path
     bug that only appears once deployed is the kind this project has no CI to catch.
     The dev URL becomes `http://localhost:5173/dance-video-looper/`; sign-in is
     unaffected, because an OAuth origin is scheme, host and port, never the path. */
  base: '/dance-video-looper/',
  plugins: [react(), tailwindcss(), pagesSpaFallback()],
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
