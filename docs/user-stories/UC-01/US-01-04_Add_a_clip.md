# US-01-04: Add a clip

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to add a video file to my library, so that a clip I downloaded
by hand becomes something I can loop — and something my other device can see.

## Acceptance Criteria

- [ ] Given the Clips screen, when it renders, then it carries a file chooser **restricted to video files** (`accept="video/*"`), so a phone offers the camera roll rather than every document
- [ ] 👁 Given the Clips screen, when the dancer chooses **Add clip**, then that chooser opens
- [ ] Given the picker is dismissed without a choice, when it closes, then nothing is added and the grid is unchanged
- [ ] Given a file is chosen, when it is added, then its **real duration is read from the file** and shown on the tile — never a placeholder or a guess
- [ ] Given a file is chosen, when it is added, then its name is taken from the filename **with the extension stripped**
- [ ] Given a clip has just been added, when the grid re-renders, then it is **first in the grid** and the ordering has switched to **Recent**, so the new clip is where the eye already is (US-01-03)
- [ ] Given a clip has just been added, when the grid re-renders, then it can be **opened in the player immediately**, without a reload
- [ ] Given a file already in the library is chosen again — the same **name, size and last-modified** — when the add is attempted, then it is **refused**, the dancer is told the clip is already there, and the grid is unchanged
- [ ] Given a chosen file the browser cannot decode — it errors, or reports no usable length — when the add is attempted, then the dancer is told, and **no tile is left in the grid**
- [ ] Given a chosen file whose metadata never arrives at all, when the wait times out, then the dancer is told rather than left waiting indefinitely, and no tile is left in the grid

## Notes

- **Mockup:** `mockup/src/Library.jsx:172–193` (reading the file and its duration), `200–213` (the button and the hidden input it drives), `mockup/src/App.jsx:32` (the new clip going to the front of the library)
- **References:** UC-01 alternate flow 4a, BR-11
- **Not in this story:** the **upload to Google Drive itself**, which is where this flow ends in the product and is deliberately absent from the mockup — it holds a local object URL instead (`Library.jsx:176`). That is **US-01-14 (Clips in Drive)**.
- **Open questions:**
  - **Compression before upload** (UC-01 Q-07). Clips come off a phone at full resolution against a 15 GB shared Drive tier, and the mockup carries a worked note on the route at `Library.jsx:139–171` — WebCodecs with audio passthrough, explicitly *not* ffmpeg.wasm, whose fast build needs COOP/COEP headers GitHub Pages cannot set. Wanted, unticketed, and it has to work on the phone
  - ~~**A refused duplicate cannot be undone**, because nothing can be deleted (UC-01 Q-08).~~ **Answered by #78, which settled the delete half of Q-08.** The trade this refusal was chosen for — an unwanted tile would otherwise be permanent — no longer holds: a clip can be deleted from its tile, and the same file is then accepted again. What is still true is that a dancer who genuinely wants **two tiles for one file** has no way through, since the id is derived from the file itself. That is a narrower complaint than the original and is not currently wanted
- **Dependencies:** US-01-01 (the button, present and inert), US-01-02 (the tile it produces), US-01-03 (the ordering it switches)

### Criteria settled at the approval gate

The draft carried eight criteria; ten came out. What changed, and why:

- **"A file picker opens" was not verifiable.** No test observes an OS dialog — not in
  jsdom, not in a real browser. It split into the half that is a real contract with the
  platform (`accept="video/*"` is what restricts the chooser) and a 👁 half for the
  button opening it at all.
- **"Two indistinguishable tiles" was a judgement, not a criterion**, and the draft's own
  notes said the mockup fails it. It is worse than the notes recorded: the mockup keys
  the tile on `added-${name}-${size}` (`Library.jsx:182`), so the same file added twice
  yields two React children with the same key. Settled below.
- **The decode failure was missing its worst case.** A file that *errors* is the easy one.
  The one that bites is the file that never answers — no `loadedmetadata`, no `error` —
  and the mockup has neither a handler nor a timeout, so the add hangs silently forever.
  It is now its own criterion, because a timeout is the only thing that closes it.
- **The new clip is prepended, not merely sorted to the front.** UC-01 4a puts it at the
  top of the grid, and `added` is a calendar day — so a clip added today ties with every
  other clip added today, and a stable sort then keeps arrival order. US-01-03 anticipated
  exactly this ("prepending it, not trusting the comparator to lift it"). The mockup
  agrees (`App.jsx:32`). The criterion now says *first*, not just *Recent*.

### Duplicates, and what counts as the same file

A file is **already in the library** when its **name, size and last-modified** all match
one that is. All three come free off the `File` object, none of them costs a read of the
bytes, and three-way collision between two genuinely different clips is vanishingly
unlikely. The mockup's name-and-size key is what the draft already flagged as
collision-prone; the third field is what makes it safe enough to act on.

A match is **refused** — nothing is added, and the dancer is told the clip is already
there. The alternative considered was adding it under a disambiguated name, which never
blocks anything but lets the library accumulate near-copies that nothing can remove.
With no delete (Q-08), a wrong tile is permanent and a refusal is not, so the reversible
failure is the one to choose.

Hashing the bytes would be exact, and would additionally catch the same clip saved under
two names. It costs a full read of a ~9 MB file on every add and has to stay fast on the
phone, which is a real cost against a case nobody has hit. Declined for now.

### Where the dancer is told

Both failures and the refusal share one live region, and it is **`role="alert"`**, not
`role="status"`.

That is not a preference. `DriveStatus.tsx:42` is an unnamed `role="status"` and seven
tests in `App.test.tsx` reach for `findByRole('status')` in the singular — a second
unnamed status region breaks all of them. `alert` is the right semantics for a failed
add regardless, so the collision and the correct answer point the same way.

### 👁 — criteria verified by eye, not by test

One criterion. The button-to-input wiring is a single imperative `.click()`, and the only
way to assert it in jsdom is to spy on the DOM call — which pins the implementation
rather than the behaviour, and is exactly what a review should reject. It is verified in
a real browser instead, per the convention US-01-01 set. **A missing test against a 👁
criterion is not a TDD gap.**

Everything else in this story *is* testable, including both failure paths, because the
duration probe is injected (below).

### Decisions taken at the planning gate

- **The library becomes state above the routes.** `App.tsx:10–11` hands the same
  `sampleClips` module constant to both routes, so an added clip could never reach the
  player — AC 7 is unmeetable without this. The list lifts into `App`, and both screens
  read it from there. The **ordering** stays where it is, in `ClipsScreen`: it is a view
  preference, not library data, and lifting it too would put player-irrelevant state above
  the player.
- **The duration probe is an injected port**, matching how US-01-13 injected `tokenSource`
  and `tokenStore`. jsdom never fires `loadedmetadata`, reports `duration` as `NaN`, and
  does not implement `URL.createObjectURL` at all — so a probe reached for directly is a
  probe no test can drive, and both failure criteria above would become 👁 by accident
  rather than by argument.

### Prior art — carried across from the Drive spike

The spike is throwaway and this story does not build on it, but it already solved the
part of this flow that the mockup gets wrong. Two things are carried across from
`spike-google-drive-storage/src/lib/playback.js`:

- **A timeout on the metadata wait** (`playback.js:8–27`, 8 s). This is the whole of the
  never-answers criterion. The mockup's `probe.onloadedmetadata` waits forever.
- **A finite-and-positive guard on the duration** (`playback.js:32`). A file can fire
  `loadedmetadata` and still report `Infinity` or `NaN`, which would reach the tile as a
  length that is not one — the `NaN:NaN` case US-01-02 already had to defend against.

Not carried across: the spike's visible `<input type="file">` (`App.jsx:556`). The mockup's
hidden input behind a styled button is the product's shape, and US-01-01 has already
landed that button.

### 🔍 rules

**None apply.** Every 🔍 business rule in UC-01 governs the player; BR-11, the only rule
this story rests on, is unmarked and settled. Recorded so the 🔍 worklist reads as checked
rather than skipped.
