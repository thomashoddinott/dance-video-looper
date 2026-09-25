import type { DemoClip } from './demoDriveApi'
import url from './demo-clip.mp4'

/* Imported rather than dropped in `public/`, so Vite fingerprints it into
   `dist/assets/`. A clip in `public/` is a local, someone-else's clip that
   must never be published; this one is the single deliberate exception, let
   through `.gitignore` by name.

   `seconds` is the clip's real length, written down so the gallery does not
   have to download the clip to draw a tile. Swap the clip, update it. */
export const DEMO_CLIP: DemoClip = {
  id: 'demo-passitos',
  name: 'Passitos',
  added: '2026-09-25',
  seconds: 16.8,
  url,
}
