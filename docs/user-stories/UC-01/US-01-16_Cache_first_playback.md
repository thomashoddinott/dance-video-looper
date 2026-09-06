# US-01-16: Cache-first playback

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer in a studio with bad signal, I want a clip I have already opened to play
immediately, so that practice is not seven seconds of waiting every time and does not
stop working when the connection does.

## Acceptance Criteria

- [ ] Given a clip that has been downloaded once, when it is opened again, then it plays **without re-downloading**
- [ ] Given a cached clip and **no connectivity**, when it is opened, then it still plays
- [ ] Given a cached clip, when it is opened, then **no Drive token is asked for**, so the hourly renewal popup cannot land mid-practice (US-01-13)
- [ ] Given a clip that is not yet cached, when it is opened, then the dancer can see **how far along the download is**, rather than facing a blank player for seven seconds
- [ ] Given a cached clip whose copy in Drive has changed, when it is next opened, then the cache does not serve a stale version indefinitely
- [ ] Given the cache is at its **byte budget**, when another clip is cached, then the **least-recently-opened** clips are evicted until it fits — deliberately, rather than by whatever the browser decides under pressure

## Acceptance Criteria — deferred to US-01-15

- [ ] Given the loop points, when they have been read once, then they are available without a round trip, so opening a clip does not wait on two fetches

There are no loop points yet: US-01-15 (#44) is unbuilt, and it is itself behind the
unbuilt US-01-08 → US-01-11 panel chain. **Expect to build the clip cache and leave
this one unticked** — that is this story's intended state on its own, not a defect in
it. Holding the loops alongside the clips is a small addition to a cache that already
exists, and it belongs to whichever of the two lands second.

## Notes

- **Mockup:** none — a **non-component story**. It changes no surface; it changes how long every surface takes to appear.
- **References:** UC-01 BR-13, exception flow *c
- **Not in this story:** the download itself (US-01-14) and the loop writes (US-01-15). This story sits in front of both. Also **not** in it: **pre-fetching the session's clips while still on wifi**, which the spike recommends in the same breath as caching (`FINDINGS.md` Q4) but which no criterion here covers — it wants its own ticket.
- **Open questions:**
  - **The 7 s figure is measured, not estimated** — the spike downloaded a 9.33 MB clip in 7.08 s, with time-to-first-byte under a second. So nearly all of it is transfer, which is exactly the shape caching fixes and streaming would not
  - **This absorbs the token-renewal papercut too** (US-01-13). A cached clip does not need Drive, so the hourly popup stops landing mid-practice. That is the third thing one decision buys, alongside speed and offline — and it is a criterion of its own above rather than a hoped-for side effect, so it gets checked rather than assumed
  - ~~**What bounds the cache is undecided.**~~ **Resolved at this story's approval gate** — see the decisions below

### Decisions taken at the approval gate, 2026-09-03

- **The bytes live in IndexedDB**, behind a `ClipCache` seam injected from `App` exactly as `browserDriveApi`, `browserClipProbe` and `browserTokenSource` are. jsdom has neither IndexedDB nor the Cache API, so a seam is required whichever is picked, and the choice is reversible behind it. **The Cache API was declined** because it has nowhere to keep the per-clip bookkeeping the byte budget needs — bytes, last-opened, checksum — so it would have meant a second store beside it. `localStorage` is not a candidate at all: it holds strings, and base64-ing a 9 MB blob inflates it by a third and blocks the main thread. **None of these is a backend** (BR-14) — they are browser APIs writing to the dancer's own device, the same category of thing `tokenStore` already uses.
- **The bound is a total-byte budget of 500 MB, least-recently-opened evicted first.** Bytes rather than a count of clips, because clip sizes vary by more than an order of magnitude — the spike measured 574 KB and 9.33 MB in the same session — so a count bounds the wrong quantity. The budget is one constant and is meant to be moved once there is real usage behind it.
- **The cache is a cache, never a store of record.** WebKit deletes script-writable storage — IndexedDB included — after roughly seven days without a visit to the site, so a phone left alone over a fortnight comes back empty. That costs a re-download and nothing else, because Drive holds the clips and US-01-15 holds the loops. It is also a reason not to let anything become cache-only later.
- **Download progress is carried across from the spike, and it is the one seam change this story makes.** `downloadBlob` (`spike-google-drive-storage/src/lib/drive.js:180`) streams via `res.body.getReader()` and reports against a `Content-Length` that *is* CORS-readable; the app's `download` (`driveApi.ts:316`) awaits `.blob()` and throws that away. Carrying it across means widening `DriveResponse` to expose the body.
- **Not carried across: `probeRange` and MediaSource.** Q4 settles it — ranged reads work and return a correct 206, and MSE could start playback in ~1.2 s rather than 7.1 s, but it accepts only fragmented MP4 and a clip downloaded from a reel is progressive with a single `moov` atom. Remuxing in the browser is a great deal of machinery for a personal tool. Note also that `Content-Range` is **not** CORS-exposed (`FINDINGS.md` Q8-2), so a ranged reader could not even read the total size off the response.
- **The cache is consulted before the token, not after.** `requireToken` renews by calling the GIS popup when the held token has expired (`DriveSessionProvider.tsx:89`), so asking it first would flash a Google popup on a clip that needed no network at all — and would fail outright offline, where the renewal cannot complete. This ordering is what makes three of the criteria above true at once.
- **Staleness rides the listing that already happens.** Adding `md5Checksum` to `CLIP_FILE_FIELDS` (`driveApi.ts:165`) lets a cached entry be checked against the clip the library already fetched, at no extra round trip, and degrades to serving the cache when the listing could not be fetched at all. Worth knowing it is close to unreachable today: nothing in the app can replace a clip's bytes, and whether a clip can even be renamed or deleted is still open (UC-01 Q-08). It is a guard, not a live path.

- **From the spike.** `spike-google-drive-storage/src/lib/drive.js` has `downloadBlob(token, fileId, { onProgress, expectedSize })`, which already reports progress — that is the fourth criterion, and it is why the seven-second wait can be shown rather than merely endured. `probeRange` is there for ranged reads, and `src/lib/playback.js` is the harness that measured seek drift, `playbackRate` and loop-lap accuracy.
  - **Playback from a blob URL is proven, so caching cannot break the looper**: seek landed with **0.000 s drift**, `playbackRate` was honoured at 0.5 and 0.75 against wall-clock, and a tight 2 s A/B loop held 3/3 (`FINDINGS.md` Q3). Serving from cache is the same blob path.
  - **Streaming is a dead end here and the spike already walked it.** Cache instead; that is the whole recommendation of Q4.
- **Getting a token (US-01-13, built):** `useDriveSession().requireToken()` per call, never held — but on this story, only ever after the cache has been asked. Note the direction of the favour: this story is what stops the hourly renewal landing mid-practice, because a cached clip needs no token at all.
- **Dependencies:** US-01-14 (something to cache, **built**), US-01-15 (loops to hold alongside it, **unbuilt** — one criterion deferred above)
