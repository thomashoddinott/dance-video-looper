import type { DemoYouTube } from './demoDriveApi'

/* #77. The showcase a visitor lands on: a snapshot of the YouTube entries in
   Thomas's library that have saved loops, taken from his Drive on 2026-11-18,
   with their loops in `demoLoops.json`. Safe to show: YouTube's own player
   plays each one, and nothing of it is hosted here — what is his is the
   choice of video and the loop points.

   A snapshot rather than a live read: a visitor has no Google sign-in, and
   his Drive folder holds other people's reels, so it is never made public.
   Refreshing the showcase is taking a new snapshot and redeploying.

   Names, styles and dates are as his library had them. `seconds` is the
   video's length from its watch page where the library had none yet — a
   cued video reports none until it has played.

   The last two are not in his library (#79): the old demo's picks (#58), with
   the loops he chose for them (#63), so the showcase holds at least four. */
export const DEMO_YOUTUBE: readonly DemoYouTube[] = [
  {
    videoId: 'YClbDdg_oFc',
    name: '➡️Las Mejores 50 Figuras de SALSA CUBANA 2020 (¡100 RECOMENDADO!)',
    added: '2026-11-17',
    seconds: 731,
  },
  {
    videoId: 'l-H1OAu9N28',
    name: '20 MOST Important Bachata Sensual Moves You MUST Know! (Part 1)',
    added: '2026-11-09',
    seconds: 345.86,
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
