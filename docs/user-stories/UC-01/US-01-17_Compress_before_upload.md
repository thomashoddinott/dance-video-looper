# US-01-17: Compress before upload

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer with a 15 GB Drive shared with everything else, I want a clip to be
compressed to practice quality on its way up, so that the quota holds a library
rather than a handful of clips — without me doing anything, and without the
laundering-through-WhatsApp trick I use today.

## Acceptance Criteria

- [ ] Given any clip is added, when it reaches Drive **and compression was used**, then it is an **MP4 whose video is H.264, capped at 854 px on its long edge and 1.4 Mbps**, whatever container or codec came in
- [ ] Given a `.MOV` off a phone — **H.264 or HEVC** — when it is added **and compression was used**, then what lands in Drive is an MP4 that plays in the player
- [ ] Given a clip was compressed, when it lands in Drive, then the stored file is **named for the bytes it actually carries** — a `.MOV` that was re-encoded is stored as `.mp4` — and given the original was uploaded instead, then the **name is left exactly as picked**
- [ ] Given a clip whose long edge is already under 854 px, when it is compressed, then it is **not upscaled**; only the bitrate does any work
- [ ] Given a portrait clip and a landscape clip, when each is compressed, then the aspect ratio is preserved with **no crop and no stretch** (BR-16)
- [ ] Given a clip with a soundtrack, when it is compressed, then the **audio survives** — a dance clip without its music is useless
- [ ] Given compression produces a file **at least as large as the original**, when the upload runs, then the **original is uploaded instead**, so the stored file is never the worse of the two
- [ ] Given compression **cannot run or fails at any point** — no `VideoEncoder`, no `AudioEncoder`, a codec the browser refuses, or a failure nobody anticipated — when a clip is added, then the original is uploaded and **the add still succeeds** rather than failing
- [ ] Given a clip is added, when the tile appears, then it **plays immediately from the local file** exactly as it does today — compression must not put the tile behind a wait (US-01-14)
- [ ] Given a clip was compressed, when the library is listed again after a reload, then its **clip id matches the one the tile was created with**, so the clip does not come back as a stranger

## Notes

- **Mockup:** none — a **non-component story**. It adds no surface; it changes what
  the bytes are on the way to Drive. The mockup gate does not apply, confirmed with
  Thomas 2026-09-04.
- **References:** UC-01 **Q-07** (this story closes it), BR-16 (never upscale or
  stretch), BR-14 (no backend)
- **Not in this story:**
  - **Any UI at all.** No quality picker, no per-clip override, no "compressing…"
    state. The target is one constant; the dancer never sees it. This is deliberate —
    the whole value is that it is automatic.
  - **Re-compressing what is already in Drive.** Every clip uploaded before this
    lands is full-size and stays that way. A backfill wants its own ticket.
  - **Pre-fetching or caching** — US-01-16 owns that and is unaffected.
- **Dependencies:** US-01-14 (#43, the upload this sits in front of, **built**)

### Where it goes

The seam is `useLibrary.add(clip, file, seconds)` (`app/src/clips/useLibrary.ts:91`),
between the tile going on screen and `api.upload`. The tile is already put up first
and plays from the local `File`, so inserting a compression step there costs the
dancer nothing visible — which is what makes "no UI" honest rather than a shortcut.

### The setting

**One constant: 854 px long edge, 1.4 Mbps video, AAC 128 kbps.** Chosen by Thomas
on 2026-09-04 from the spike's comparison table, watching the output at 0.25× — the
speed the player actually reaches — on both a laptop and a phone.

### What the spike settled

`spike-video-compression/FINDINGS.md`, run 2026-09-04. Verdict **GO**. Route is
**WebCodecs via [Mediabunny](https://mediabunny.dev)**, and explicitly **not
ffmpeg.wasm**, whose fast build needs `SharedArrayBuffer`, which needs COOP/COEP
response headers, which GitHub Pages cannot set.

Measured, on a 44.17 MB / 2m14s `.MOV`: **12.17 MB at 360p·0.6, 25.54 MB at the
chosen 480p·1.4**, encoded in ~5.5 s — around **25× faster than the clip plays**. On
a 2206x1508 **HEVC** `.MOV`: **9.7× smaller**. HEVC in, H.264 MP4 out, no special
handling.

### What is carried across from the spike's code, and what is not

Read at this gate from `spike-video-compression/src/`, not only from its findings —
four decisions live in that code and in no report:

| Carried across | Why it matters |
| -------------- | -------------- |
| **Long-edge cap, not a width** | One rule scales portrait and landscape alike (BR-16). A width would assume 9:16 |
| **Both edges rounded to even** | Some H.264 profiles reject odd dimensions outright |
| **`forceTranscode: true`** | Without it a clip already at 854 px is *copied*, not re-encoded — the run reports a spectacular speed having compressed nothing, which is exactly the "already an MP4, just bring the bitrate down" case |
| **`fit: 'contain'`** | Dimensions already preserve the aspect ratio, so this is what guarantees no crop and no stretch |
| **`blob.size >= source.bytes`** | The never-store-the-bigger-one comparison, already written |

**Deliberately not carried across:** the six-entry `PRESETS` table (one constant was
chosen instead), and `withoutAudioEncoder` — a laptop-side simulator for iOS Safari
that is spike scaffolding, not product code.

### Two findings that became criteria

- **Half the targets made the file bigger.** Against `sample.mp4` (already only
  1.82 Mbps, as anything off Instagram or through WhatsApp will be), three of six
  targets inflated it — a second-generation encode that is larger *and* visibly
  worse. Hence the "never store the bigger one" criterion; it is not a nicety.
- **Never-upscale has to be explicit.** A 1080p target against a 720x1280 source
  correctly stayed 720x1280 only because the spike caps the long edge and refuses to
  scale up.

### The identity hazard — read this before starting

`clipIdFor(file)` is called **twice on what is assumed to be the same file**: once at
`ClipsScreen.tsx:55` to build the tile's `clip.id`, and once inside `driveFileFor`
(`driveClips.ts:79`) to stamp Drive's `appProperties`. The id is
`name-size-lastModified`, so **compressing between those two calls makes them
disagree** — different size, and a different extension if a `.MOV` came in. The clip
would then come back from Drive under an id no tile ever had, which is also the id
US-01-15 keys saved loops on.

The last acceptance criterion exists for exactly this. Whichever way it is solved,
**the id must be the original file's**, because that is what the dancer picked and
what a duplicate-add should still collide with.

**It is the *name* as well as the id, which the hazard as first written understates.**
`driveFileFor` reads both off the same `File` — `name: file.name` (`driveClips.ts:74`)
and `clipIdFor(file)` (`driveClips.ts:79`). Hand it the compressed file and the stored
filename changes too. So the fix is not "recompute the id more carefully", it is
**splitting identity from bytes at that seam**: the metadata is derived from the
original file, the body is whichever file is being stored. Approved at this gate,
2026-09-04.

### Open questions

- **Roughly five seconds pass before the upload starts.** The tile is up and playable
  throughout, so nothing is blocked, but its progress bar sits at 0% for that time and
  US-01-14 put that bar there precisely so a long wait would be legible. Decided for
  now: **leave it**, because the tile is not blocked and adding a state would be the
  UI this story exists without. Revisit if it reads as a hang.
- **Encode speed on a phone is unmeasured.** The 25× realtime figure is a laptop's.
  The device was confirmed capable (`AudioEncoder` present), but not timed, and a
  phone doing this while it warms up is a different proposition.
- **HEVC decode was proven on a desktop.** Safari decodes HEVC natively and should be
  the easy case, but it has not been run there.
- ~~**Should the stored filename keep the original extension?**~~ **Resolved at this
  gate, 2026-09-04: the stored file is named for the bytes it carries.** A re-encoded
  `.MOV` is stored as `.mp4`; an original uploaded under the fallback keeps the name
  exactly as picked. This does override the rule US-01-14 set (`driveClips.ts:74`,
  "what sits in the dancer's own Drive folder should be the file they picked"), and
  the override is narrow: only the extension moves, only when the bytes did. The
  display name is unaffected either way, since `nameFromFilename` strips the
  extension before anything is shown.

### Two decisions taken at the approval gate

- **The fallback is a catch, not a probe.** `FINDINGS.md` recommends probing
  `AudioEncoder` and the audio offset up front and deciding from that. Rejected here in
  favour of wrapping the compression step and falling back to the original on *any*
  throw. The probe only decides what the catch decides anyway, it cannot cover the
  failures nobody has seen yet, and the "and say so" half of the finding's advice has
  no home in a story that deliberately ships no UI. The iOS Safari failure throws on
  the first audio sample, so little work is wasted by letting it happen.
- **One constant, against the spike's advice.** `FINDINGS.md` Q5 concludes the bitrate
  must be picked per clip. It is not: 854 px / 1.4 Mbps is fixed, and the
  never-store-the-bigger-one rule absorbs the case Q5 was worried about. The finding
  stands as a description of what happens at a fixed bitrate; the mitigation chosen is
  the comparison rather than a per-clip calculation.
