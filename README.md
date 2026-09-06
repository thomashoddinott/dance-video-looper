[TODO - UPDATE]

# Dance Video Looper

> The idea is [LoopTube](https://looptube.io)'s — this is a hobby rebuild of it for
> personal use, pointed at clips in my own Drive rather than YouTube.

A personal practice tool: load a short dance clip, set an A/B loop over the four
seconds you're actually trying to learn, and slow it down. On a laptop at home
and on a phone at the studio, with the same clips and the same loop points in
both places.

Built to be used — but the real reason it exists is to practise an agentic
development workflow end to end. The process artefacts — the use cases, the user
stories, and the mockup they were cut from — are as much the point as the app is,
and they are all in `docs/`.

## Why

I learn choreography from short clips, and the thing you need is stupidly
specific: play *these* four seconds, at *this* speed, over and over, until your
body has it. [LoopTube](https://looptube.io) does exactly that for YouTube and is
excellent — simple enough to drive one-handed on a phone in a corner of a dance
hall.

The dance community, though, is on Instagram. So the tool I want doesn't exist.

## Why this couldn't just be "LoopTube for Instagram"

LoopTube works because YouTube publishes an **IFrame Player API** — an embedded
player that exposes `seekTo()` and `setPlaybackRate()` to the page around it.
That single fact is what makes a front-end-only looper possible.

Instagram publishes no equivalent, and before designing around that I checked
whether a page could get at a reel's video file another way. Every route is
closed:

| Route | Result |
|---|---|
| `/embed/captioned/` HTML | 200, but a JS shell with no media in it |
| Post page, plain fetch | JS shell, no `og:video` |
| `facebookexternalhit` crawler UA | `og:video` stripped even for link-preview crawlers |
| `?__a=1&__d=dis` JSON | 404 — removed |
| `/api/v1/media/{id}/info/` | 302 to login |

There's a deeper reason this can't be solved in the browser at all. A page can
**display** cross-origin content but never **expose** it to another origin's
code: a cross-origin `<iframe>`'s `contentDocument` throws, and drawing that
video to a `<canvas>` taints it. That isn't Instagram blocking me — it's the
rule that makes it safe to have your bank open in another tab.

So the design stops fighting it. **Clips are downloaded by hand** with tools that
already exist, and the app never touches Instagram. It's a ten-second step, and
it means the tool still works when Instagram changes something next month.

## How it works

A static site with **no backend of any kind**, hosted on GitHub Pages, using
**Google Drive** as the storage layer. One Drive folder holds the clips plus a
`loops.json` manifest, so the loop points sync alongside the videos — mark up a
tricky section at home, and it's already there on the phone at the studio.

The useful corollary of the same-origin rule above: once you *have* a video URL,
`<video>` plays it with full `currentTime` and `playbackRate` control and no CORS
involved. Playback was never the hard part. Only discovery was.

## What was proven before anything was designed

The whole architecture rested on one unverified assumption — that a backend-less
static page can read and write Google Drive. That got its own throwaway spike
before a line of the product was designed, and it returned **GO**:

- Signed in, uploaded an mp4, listed it, downloaded it with a bearer token,
  played it, and created *then updated* a `loops.json` — no server anywhere
- Blob-URL playback seeks with **0.000 s drift**, and `playbackRate` is honoured
  by the decoder (measured against wall-clock, not just read back)
- A tight 2 s A/B loop held 3/3 cycles, 86 ms worst-case overshoot
- `loops.json` updates in place — same file ID, no duplicate per save

Four findings from it shape the product more than any feature request has:

1. **Every clip must be uploaded through the app.** The `drive.file` scope only
   sees files the app itself created, so a file dropped into the folder by hand
   is invisible — not restricted, *invisible*. The broader scopes are restricted
   and need a Google security assessment, so this is the right trade.
2. **Cache-first, or it's slow.** A 9.33 MB clip takes 7.1 s to download before
   it plays. Caching turns that into once-per-clip, works offline in a hall with
   bad signal, and softens the hourly token renewal — one decision paying three
   ways.
3. **Token renewal flashes once an hour** and no backend-less app can do better,
   so it's renewed on user-initiated sync rather than lazily at expiry — the
   interruption lands at a natural break instead of mid-move.
4. **Two devices editing loops will clobber each other.** `loops.json` is
   last-write-wins today, and that's a real way to lose work.

One question is deliberately still open: whether the OAuth flow behaves on a
phone. It needs a deployed HTTPS origin to test, so it can't be answered from
localhost — and since the phone *is* the point, a desktop pass wouldn't settle
it. It's tracked, not forgotten.

## How it's being built

Artefacts come in a fixed order, and the order is the point:

**mockup → use case → user stories → code**

The mockup is vibe-coded and throwaway. The use case is derived from it *by
walkthrough* — narrating the live page, rather than reading its code, so the
document describes what the thing is **for** instead of what happens to have been
built. User stories are then cut component-by-component from the mockup, each
anchored to a file and line range, so that reviewing a story means opening one
piece of UI and looking at it.

Work is tracked in this repo's issues — one ticket per piece of work, each
carrying the acceptance criteria it gets reviewed against.

## Running it

    npm --prefix app install
    npm --prefix app run dev

The clips grid is filled from Google Drive, so on a clean clone it starts empty.
To connect an account, copy `app/.env.example` to `app/.env.local`, add a Google
OAuth Client ID, and restart the dev server. Without one the app still builds and
runs — the Clips footer reports that Drive is not configured and the grid stays
empty.

No clip is committed, so to play something locally drop your own mp4 into
`app/public/`. Showing a bundled sample when Drive is not connected is still to do.
