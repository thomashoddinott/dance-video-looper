# US-01-15: Loops in Drive

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want the loops I save to persist and to follow me between devices,
so that marking up a section at home and practising it at the studio is one act
rather than two.

**This is the story the app exists for.** The loops are the asset — the clips can be
re-downloaded from wherever they came from, but the four seconds somebody identified
as the hard bit, at the speed they could follow, cannot.

## Acceptance Criteria

- [ ] Given a loop is saved (US-01-11), when it is written, then it lands in **`loops.json`** in the app's own Drive folder
- [ ] Given `loops.json` already exists, when it is updated, then it is **updated in place — same file ID, one copy** — never a second file per save
- [ ] Given a loop is saved, when the dancer leaves the clip and returns, then **the loop is still there**
- [ ] Given a loop saved on one device, when the other device opens that clip, then the loop is there, with its name, its A and B, and its speed (BR-09)
- [ ] Given a loop is deleted, when the change is written, then the deletion propagates the same way a save does
- [ ] Given `loops.json` does not yet exist, when the first loop is saved, then it is created
- [ ] Given a write that fails, when it stops, then **nothing joins the list** and the dancer is told the loop is not saved — a loop silently lost is the worst outcome this app has
- [ ] Given a clip is deleted from Drive by other means, when the app loads, then its orphaned loops do not break the library — and they are **not pruned**, so re-adding the same file brings them back

## Acceptance Criteria — when the write happens (Q-03, settled at this gate)

- [ ] Given a loop is saved or removed, when the change is made, then it is **written to Drive then and there** — not debounced, and not deferred to leaving the clip
- [ ] Given a save is in flight, when the dancer looks at the panel, then the list shows only what Drive has taken: the entry appears **after** the write lands, and Save reads as pending until it does

## Acceptance Criteria — the clobbering decision (Q-05, settled at this gate)

- [ ] Given a loop is saved or removed, when it is written, then `loops.json` is **re-read first and the one change applied to what Drive currently holds** — so a loop saved on the other device since this clip was opened survives the write
- [ ] Given the file moved between that read and the write, when the write goes out, then it is **refused rather than allowed to clobber**: the file's `version` is carried and checked, and the read-and-apply is retried once before the dancer is told
- [ ] The choice is recorded in UC-01 against Q-05

## Acceptance Criteria — the asset is never destroyed

- [ ] Given `loops.json` exists but its contents cannot be read or parsed, when a save is attempted, then the file is **refused rather than overwritten**, and the dancer is told
- [ ] Given one stored loop is malformed, when the file is read, then that entry is dropped and **every other loop in the file still loads**

## Acceptance Criteria — the loop count (folded in at this gate)

- [ ] Given loops are saved against a clip, when the Clips screen draws its tile, then the count in parentheses is **the real number**, not the `0` `driveClips.ts` hardcodes today
- [ ] Given the **Most looped** chip is chosen, when the grid orders, then it orders by that number — US-01-03 shipped the chip against a constant, and this is the only story that can supply one

## Acceptance Criteria — reading loops offline (folded in at this gate)

- [ ] Given `loops.json` has been read once on this device, when the dancer opens the app with no signal, then **the loops they have are on screen** — served from a local copy, exactly as a clip's own bytes already are (BR-13)
- [ ] Given the local copy is what is serving, when a save is attempted, then it still goes to Drive and still fails loudly. The cache is a read-side fallback and **never a store of record**

## Notes

- **Mockup:** none — a **non-component story**. Its surface is US-01-11 (`Player.jsx:574–644`), whose two persistence criteria this story is what makes satisfiable.
- **References:** UC-01 Basic Flow steps 19–22, BR-09, BR-12, BR-13, Q-03, Q-05, Q-06
- **Not in this story:** the panel itself (US-01-11), and **export / restore** (UC-01 Q-06), which is wanted and unticketed.

### What the file holds

```json
{ "schema": 1, "clips": { "<clipId>": [{ "id", "name", "a", "b", "speed" }] } }
```

Keyed on the app's own **`clip.id`**, not on Drive's `driveId`. `clipIdFor(file)` is
derived from the file itself, so the same clip re-uploaded keeps its id and its loops
come back with it — which is what makes the orphan criterion a decision rather than a
leak. Keying on `driveId` would strand the loops of every clip that was ever
re-uploaded.

`schema` is one field of insurance: the loops are the asset, Q-06 will export this
shape, and a reader that meets a version it does not know should say so rather than
mangle what it found.

### The three decisions this gate settled

- **Q-03 — written on every save and every removal.** The spec's own worry, "a Drive
  round trip per keystroke-ish action", does not survive the detail: a save is an
  explicit act a handful of times a session, and `loops.json` is kilobytes. Debouncing
  or writing on exit both buy a window in which the panel says saved and Drive
  disagrees — which is the failure the story itself calls the worst outcome the app
  has.
- **Q-05 — read-modify-write per change, not last-write-wins.** Every write re-reads
  the file and applies only *this* change: append this loop, or drop this id. Because
  the operations are that small there are no tombstones to keep and nothing is ever
  lost — a merge falls out of the shape rather than having to be designed. The `version`
  the spike watched go 2 → 3 → 4 guards the ~200 ms that remains between the read and
  the write: if it moved, re-read and retry once rather than clobber.
- **Save failure — write first, then show.** The list means *what is in Drive* at every
  moment, so nothing is appended optimistically. This is deliberately unlike the clip
  upload's tile-first flow (`library.ts` `adding`/`abandoned`), and the difference is
  the wait being covered: thirteen seconds there, about two hundred milliseconds here.
  The framed A, B and speed are untouched by a failure either way, so retrying is one
  press rather than re-framing the section.

### Two things folded into scope at this gate

- **The loop count is real from here.** `driveClips.ts` hardcodes `loops: 0`, so the
  **Most looped** chip US-01-03 shipped sorts by a constant and every tile's count is
  suppressed. UC-01's *"What one screen knows about the other"* makes that count the
  single coupling between the two screens, and this story is the only thing that can
  supply it. It is also the reason the loops load at `App` level beside `useLibrary`
  rather than inside `PlayerScreen` — the Clips screen needs them too.
- **Loops are readable offline.** UC-01 exception *c makes bad signal the expected case
  and BR-13 is cache-first for exactly that reason. Without a local copy, opening a clip
  in a studio with no signal shows a clip that plays from cache and no loops at all,
  which is the asset missing at the one moment it is wanted. Read-side only: writes
  still need the network and still fail loudly.

### Carried across from the spike, and what is not

**Read the source, not only the findings.** `spike-google-drive-storage/src/lib/drive.js`
already holds `findByName`, `readJson`, `createJson` and `updateJson`.

- **Carried:** the `PATCH /upload/drive/v3/files/{id}?uploadType=media` write, verified
  to keep the same file ID across two successive updates and to leave exactly one
  `loops.json` in the folder (`FINDINGS.md` Q7) — which is the second criterion,
  already demonstrated. Asking for `version` in the `fields` of every JSON call comes
  with it, and it is what Q-05's guard is built on.
- **Carried:** the multipart create body, which is a boundary-building function to port
  into `driveApi.ts` rather than a module to adopt.
- **Not carried:** the spike's `driveFetch`, `DriveError` and `q()` quoting.
  `app/src/drive/driveApi.ts` already has all three, and a second copy would be free to
  drift from the one the clips go through.

### Building against what is already here

- **Getting a token (US-01-13, built):** call `useDriveSession().requireToken()` per call
  and never keep the result. A 401 from Drive means consent was withdrawn — call
  `reportConsentWithdrawn()`. This matters more here than anywhere: *"a loop silently
  lost is the worst outcome this app has"*, and a write that fails on a stale token must
  not be reported as a saved loop.
- **The local copy** goes behind `tokenStore.ts`'s existing `KeyValueStorage` seam
  rather than a second IndexedDB store. `loops.json` is kilobytes; the clip cache's two
  object stores exist because bytes and bookkeeping had to be read apart, and nothing
  here has that problem.
- **BR-10 already anticipated this story.** `nextLoopName` reads the lowest unused
  number off the names actually saved, chosen at US-01-11's gate precisely because a
  monotonic counter "would start at 1 and collide anyway once US-01-15 restores loops
  from Drive".

### Still open

- **An export and restore is wanted** (UC-01 Q-06). The loops are the asset and, after
  this story, still exist in exactly one place. It is the cheapest insurance against a
  Drive mishap, and it deserves its own story.
- **Q-04 is untouched here.** An unsaved loop is still lost silently on leaving the
  player; this story makes a *saved* one durable, which is a different question.

- **Dependencies:** US-01-13 (the session), US-01-11 (the panel it makes real),
  US-01-16 (the cache-first precedent the offline read follows)
