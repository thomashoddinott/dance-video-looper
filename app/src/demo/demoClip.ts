import type { DemoClip, DemoYouTube } from './demoDriveApi'
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
  style: 'bachata',
  url,
}

/* #58. Real dance material beside the one clip, so a visitor has something
   worth looping. Safe to show where a downloaded clip is not: each is played
   by YouTube's own player, and nothing of it is hosted here. Every one allows
   embedding — check that before adding another (`youtube.ts`'s oEmbed).

   `seconds` read off each watch page. `added` falls before the clip's, so
   the clip leads the grid under Recent. */
export const DEMO_YOUTUBE: readonly DemoYouTube[] = [
  {
    videoId: 'l-H1OAu9N28',
    name: 'Bachata Sensual — 20 moves, Part 1',
    added: '2026-09-24',
    seconds: 346,
    style: 'bachata',
  },
  {
    videoId: 'CkZO6nyJwjw',
    name: 'Cuban Salsa — Class 10',
    added: '2026-09-23',
    seconds: 767,
    style: 'salsa',
  },
  {
    videoId: 'mBHXNXJOF84',
    name: 'Elena & Derek — Ultima llamada',
    added: '2026-09-22',
    seconds: 224,
    style: 'bachata',
  },
]
