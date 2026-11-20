import type { DemoYouTube } from './demoDriveApi'

/* #77. The showcase a visitor lands on: a snapshot of four videos Thomas
   chose from his library (#108), taken from his Drive on 2026-11-20, with
   the loops he saved on them in `demoLoops.json`. Safe to show: YouTube's
   own player plays each one, and nothing of it is hosted here — what is his
   is the choice of video and the loop points.

   A snapshot rather than a live read: a visitor has no Google sign-in, and
   his Drive folder holds other people's reels, so it is never made public.
   Refreshing the showcase is taking a new snapshot and redeploying.

   Names, styles and dates are as his library had them. `seconds` is the
   video's length from its watch page where the library had none yet — a
   cued video reports none until it has played. */
export const DEMO_YOUTUBE: readonly DemoYouTube[] = [
  {
    videoId: 'R4qPshBIK7M',
    name: "Nic N'taya Salsa Choreography #salsatechnique #cubansalsa #dancer #learningsalsa  #salsadancing",
    added: '2026-11-20',
    seconds: 36,
    style: 'salsa',
  },
  {
    videoId: 'NJxnD75rSAA',
    name: '20230225 Igor & Rocio Bachata sensual workshop warm up at Dancelife X Toronto',
    added: '2026-11-14',
    seconds: 199,
    style: 'bachata',
  },
  {
    videoId: '1hzQRhOxYCg',
    name: '#footwork #bachatasensual couple bachata footwork',
    added: '2026-11-19',
    seconds: 54,
    style: 'bachata',
  },
  {
    videoId: 'mBHXNXJOF84',
    name: 'Elena Khamsi & Derk ❤️  (Ultima llamada) Mickey Then. {📍Valencia, Bachata} (BACHATA PASIÓN❤️‍🔥)',
    added: '2026-11-20',
    seconds: 224,
    style: 'bachata',
  },
]
