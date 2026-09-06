# US-01-14: Clips in Drive

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want the clips I add to be stored in my Drive and listed back to me,
so that the library on my phone is the same library as the one on my laptop.

## Acceptance Criteria

- [ ] Given a chosen video file that probed as a clip (US-01-04), when the tile appears, then the upload to Drive **begins behind it** — the tile is in the grid and playable from the local file while the bytes are still going up
- [ ] Given an upload in progress, when the dancer looks at the tile, then it shows **that it is uploading and roughly how far along**, updating as the bytes go
- [ ] Given an upload that succeeds, when it finishes, then the clip carries its **Drive file id**, the progress affordance is gone, and the clip keeps playing from the local file it was added from — **nothing is re-downloaded in this session**
- [ ] Given an upload that fails, when it stops, then the clip is **removed from the library**, the dancer is told which clip and that it was not saved, and the grid is otherwise unchanged
- [ ] Given a clip is uploaded, when the file is written, then its **duration is stored on the Drive file** (`appProperties`), so a device that never saw the local file can still show it
- [ ] Given the Clips screen loads and the dancer is connected, when the library is fetched, then it lists **the files the app itself uploaded**, each with the name, duration and added-date its tile needs, and **`sampleClips` is gone**
- [ ] Given the Clips screen loads and the dancer is **not connected**, when it renders, then the grid is **empty**, and the standing BR-11 note and **Add clip** are the only things offered (UC-01 alternate flow 2a)
- [ ] Given the library is being fetched, when it has not arrived, then the dancer can see the screen is loading rather than looking at an empty grid that means "no clips"
- [ ] Given any Drive call returns **401**, when it is handled, then `reportConsentWithdrawn()` is called rather than a generic failure being reported (US-01-13)
- [ ] Given a stored clip is opened on a device that did not upload it, when it loads, then it **downloads and plays**, with seeking and playback rate intact
- [ ] 👁 Given a file placed in the Drive folder by hand, when the library loads, then it **does not appear** — under `drive.file` it is invisible to the app, not merely restricted (BR-11)
- [ ] 👁 Given the library on a second device, when it loads, then it shows the same clips

## Notes

- **Mockup:** none for the storage itself — this is a **non-component story**. What it changes is behind US-01-04 (`Library.jsx:108–129`, where the mockup makes a local object URL) and US-01-01 (`Library.jsx:169–173`, where the mockup reads a seeded array).
- **References:** UC-01 Basic Flow steps 2–3, alternate flow 4a, exception flow *c, BR-11, BR-14
- **Not in this story:** the loop points (US-01-15), and **caching — an open on a second device re-downloads every time until US-01-16 lands**, which at ~7 s for a 9 MB clip will be obviously slow. That is expected, not a defect in this story.
- **Dependencies:** US-01-13 (the session), US-01-04 and US-01-01 (the surfaces it changes) — all built as of #60.

### Criteria settled at the approval gate

Seven criteria in, twelve out. The draft's seven were sound as *intentions*; three of
them rested on a decision the story never took, and two were not verifiable as written.

**The tile appears first, and the upload runs behind it.** This is the decision the
draft was missing, and it is what criteria 1–4 now turn on. Upload was measured at
**13.0 s for 9.33 MB** (`FINDINGS.md` Q1), and US-01-04 shipped a tile that is first in
the grid and openable immediately (`App.tsx:20–23`). Requiring the upload to complete
before the tile appeared would have meant thirteen seconds of nothing, and would have
silently reversed a criterion another story already built and merged. The cost, taken
knowingly, is that a failure has to **retract a tile the dancer can already see** — the
alternative was a fourteen-second add.

**A failure removes the clip rather than keeping it locally.** A local-only clip that
survives the failure was considered and rejected: it invents a clip state UC-01 has no
account of, it cannot be told from a stored one on the tile, and it dies on reload
anyway. Removal plus a notice naming the clip is a smaller lie. If the dancer is in the
player on that clip when its upload fails, the clip goes from the library and the player
behaves as it does for any id that is no longer there — the notice is on the Clips
screen, where they will land.

**"The tile reflects the stored clip rather than a local URL" was dropped.** Taken
literally it required discarding a working object URL in order to re-download the bytes
just sent — strictly worse, and not what US-01-16 means by caching. What the draft was
reaching for is that the clip is *identified* by its Drive file, which criterion 3 now
says directly.

**Two criteria were not testable as written** and are now marked 👁, following the
precedent US-01-04 set when "a file picker opens" was split. The hand-placed file and
the second device are both properties of `drive.file` and of one query — no test drives
either, and pretending otherwise puts an unfalsifiable tick in the list.

### Duration, and the second device

Drive's file metadata carries name, size, `createdTime`, `modifiedTime` and
`md5Checksum` — **never duration**. Duration is read off the local `File` by
`clipProbe.ts`, which a second device does not have, and re-probing means downloading
9 MB, which this story explicitly defers to US-01-16.

So it is **written to the file's `appProperties` at upload time** and read back with the
listing — one extra field on a call already being made, no download, and it survives to
any device. Without this, UC-01 Basic Flow step 3 (every tile carries its duration) is
simply false on a phone, and `Clip.seconds` being optional would be doing work it was
never written for: that comment is about a probe that failed, not about a clip whose
length is known and merely elsewhere.

**Unexercised by the spike.** `appProperties` is standard Drive v3 and needs no extra
scope, but it is the one thing here the spike never sent to real Drive. It is the first
thing to check if the listing comes back thinner than expected.

### The library is Drive's, and `sampleClips` goes

Not connected, or connected with nothing uploaded, means an **empty grid** — which is
exactly UC-01 alternate flow 2a, already written and already carrying the BR-11 note on
screen (`ClipsScreen.tsx`). Keeping the committed sample clips (#58) in the grid
alongside Drive's was rejected: BR-11 says every clip must come in through the app, and
a seeded tile is precisely the thing BR-11 exists to forbid. Swapping the samples out at
sign-in was rejected too — the grid changing contents underneath the dancer is worse
than an honest empty one.

The sample `.mp4`s stay in the repo. #58 committed them so a fresh checkout can *play*
something, and they remain usable through **Add clip**; they just stop being seeded into
the library.

A **loading state** is now its own criterion. Without it the empty grid means two
different things — "you have no clips" and "we have not looked yet" — and 2a's standing
note would be shown to a dancer whose library is about to arrive.

### 👁 — criteria verified by eye, not by test

- The hand-placed file that does not appear. The guarantee is Google's, not the app's; what a test *can* assert is that the app requests `drive.file` and queries only its own folder, and that is asserted elsewhere (`gisTokenSource.ts:39–40`). Confirm by dropping a file into the folder by hand and reloading.
- The second device showing the same clips. One query, run twice. Confirm on the phone — and it doubles as the first real evidence for **Q-10**, the mobile OAuth question the spike could not answer from localhost.

### Prior art — carried across from the Drive spike

`spike-google-drive-storage/src/lib/drive.js`, all exercised against real Drive:

- **`findOrCreateFolder`** — carried across. The folder is found or created through
  `files.list` and **the same folder is re-found in later sessions** (`FINDINGS.md` Q1),
  so there is no id to persist anywhere. The spike's `q()` escaping comes with it: an
  apostrophe in a filename would otherwise alter the query rather than break it.
- **`listFiles`** — carried across, plus `appProperties` in the `fields` list.
- **`uploadResumable`** — carried across for its `onProgress`, which is the only reason
  criterion 2 is answerable. `fetch` still has no upload progress event; the spike's XHR
  is not an accident.
- **`downloadBlob`** — carried across for criterion 10.
- **`uploadMultipart` and `uploadFile` — deliberately NOT carried across.** The fallback
  existed only because it was unclear whether the resumable session URI in the
  `Location` header would be CORS-readable. The run settled it: it is, and resumable
  never fell back (`fellBackFrom: null`, `FINDINGS.md` Q8-1). Dead code, not a safety net.

**A correction to the draft's own reasoning.** It justified dropping multipart on the
grounds that "resumable survives a dropped connection and multipart does not". That is
true of the *protocol* and **not true of the spike's implementation**, which sends the
whole file in a single `PUT` and keeps no session URI to resume from. The conclusion
stands — progress events alone earn it — but the stated reason did not survive reading
the code, which is why the gate asks for the source and not only the findings.

**Resume-after-drop is therefore not in this story.** Nothing in the criteria asks for
it, and UC-01 exception flow *c makes bad signal the expected case rather than the edge,
so it is likely to be wanted. It needs the session URI held and a `Content-Range` probe
on reconnect — real work, and its own ticket if the studio proves it.

### Decisions taken at the planning gate

- **The Drive folder is named `Dance Video Looper`.** The spike used `looptube-ig-poc`, which is a spike's name. The dancer sees this folder in their own Drive, so it reads as a product. Nothing persists the id, so renaming later costs a re-find, not a migration (`FINDINGS.md` Q1).
- **Progress is shown on the tile**, not in a banner. The tile is where the eye already is after an add (US-01-03, and US-01-04's Recent switch), and a banner would have to name the clip that the tile is already showing.
- **The token is fetched per call** via `useDriveSession().requireToken()` and never held. The session retires tokens 30 s early on purpose, so a held copy is the one thing that reintroduces a mid-flight 401 (US-01-13). This matters more here than anywhere: a 13-second upload is long enough to straddle an expiry.

### 🔍 rules

**None apply.** Every 🔍 business rule in UC-01 governs the player. BR-11, BR-13 and
BR-14 are the rules this story rests on, and all three are unmarked and settled.

### Open questions

- **UC-01 Q-09 comes due here.** It asks whether upload progress, rename and delete make "manage the clip library" a goal in its own right, to be split out as UC-02. This story adds the first of the three. Raised, not answered — one of three is not yet a second use case, but the next one that lands should settle it.
- ~~**Deleting a clip** (Q-08) still has no story anywhere~~ — **ticketed as #78 and landed**, which is what this note was asking for: once clips consume real Drive quota, a library that only grows is a problem this story creates. An ✕ on the tile trashes the clip in Drive rather than erasing it, and the duplicate refusal in US-01-04 — chosen partly *because* nothing could be deleted — now has a way through.
- **Compression before upload** (Q-07) is not in this story but lands on exactly this seam, and every clip uploaded before it exists is a full-resolution one. `Library.jsx:76–107` carries the worked route.
- **Q-10 (does OAuth work on a phone)** gets its first real evidence from this story's second 👁 check, though a localhost pass still cannot settle it.
