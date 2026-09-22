# US-01-19: Overwrite the open loop

**Status:** DRAFT
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want a loop I opened and then adjusted to be **corrected** when I
save, so that fixing a loop that starts half a second late leaves me with one good
loop rather than a list of near-duplicates.

## Acceptance Criteria

- [ ] Given a loop opened from the list, when **Save** is used, then **that entry is updated in place** — its A, B and speed take the player's current values — and no new entry appears (BR-20)
- [ ] Given an updated entry, when the list re-renders, then it keeps its **position** in the list
- [ ] Given a loop is open, when the panel renders, then the action reads **Update** rather than **Save**
- [ ] Given a loop is open, when the line beneath the field renders, then it names the entry the write would land on **by the name it is stored under**, reading `updates chasse to 0:03 - 0:07 · 1x`
- [ ] Given a loop is open and the field holds a different name, when **Update** is used, then the entry is **renamed** as well as re-pointed (BR-10)
- [ ] Given a loop is open and the field is empty, when **Update** is used, then the entry **keeps the name it had** — and the field offers that name as its placeholder rather than the next `Loop N` (BR-10)
- [ ] Given a loop is open, when **Save as new** is used, then a new entry is added under the next offered name and the open one is left alone
- [ ] Given a loop was just written — new or corrected — when the dancer adjusts it and saves again, then the **same entry** is updated; a save does not have to be followed by a recall to be editable
- [ ] Given nothing has been opened or saved on this clip, when **Save** is used, then a new entry is added, exactly as US-01-11 has it
- [ ] Given a loop is open, when the list renders, then that entry **stays marked** while A, B and the speed change — the mark follows the id, not the values (revises US-01-11)
- [ ] Given the open entry and the player have parted company, when the list renders, then the entry says **unsaved**, beside the times it is still stored with
- [ ] Given the open loop is removed from the list, when the panel renders, then the action returns to **Save**, nothing is marked, and the next save adds a new entry
- [ ] Given a loop is open, when **s** is pressed then it updates, and when **shift-s** is pressed then it saves a new one
- [ ] Given a loop is open, when the hint line renders, then it says `s updates it` and names `⇧s` as the way to a new one — and names `⇧s` only while there is a loop for it to be an alternative to
- [ ] Given a **half-set** loop, when the panel renders, then **Update** and **Save as new** are both disabled, exactly as **Save** is, through the same single guard (BR-04)
- [ ] Given an update Drive refuses, when the write fails, then **the entry is unchanged** and the dancer is told, exactly as a failed save is (BR-12)
- [ ] Given an update, when it reaches `loops.json`, then it is replayed onto whatever Drive holds as a **replace by id**, and is a **no-op** where the other device has already removed that loop — an update must never resurrect one (BR-12, Q-05)

## Notes

- **Mockup:** `mockup/src/Player.jsx` — the saved loops panel, `Save as new` on the summary line, and the `unsaved` marker on the open row. Mocked first, then brought back into line with three things the build settled (below).
- **References:** UC-01 Basic Flow steps 17–22, **BR-20**, BR-04, BR-09, BR-10, BR-12, Q-05
- **Ticket:** #30

### What this revises in US-01-11

- **An entry is marked by id, not by value.** US-01-11's approval gate chose value equality — A, B and the speed all matching — because it goes stale in the only honest direction: reframe the loop and the mark leaves. That was right about what the mark *said* and wrong about what it is for. The mark's job is to name the entry the next save lands on, and value equality lets go of exactly that at the first drag of a correction. What the old rule said by dropping the mark, the entry now says for itself: `unsaved`.
- **A save leaves the loop it wrote open.** US-01-11 cleared the field and went back to offering the next number. The field is still cleared, but what it offers is the loop just written — otherwise the first save of a new loop is still followed by `Loop 2`, `Loop 3`, `Loop 4` as the dancer corrects it, which is the whole complaint.
- **Loops can be renamed**, which US-01-11 listed as something they could not be.

### Settled while building (2026-09-22)

- **One control, not two.** Update and Save are the same button saying which of the two writes it would make. Two side by side would put "make another one" under the thumb at exactly the moment it is the wrong answer, and correcting the open loop is the common move — which is the whole of this story.
- **`Save as new` is the way out**, in the weight of a link on the line that already says what the write would do, with `⇧s` as its key. It takes the **next number going** rather than the open loop's name: two rows called `chasse` would be indistinguishable in a list that has no reorder.
- **The name field is cleared after a write and never pre-filled.** Pre-filling looked helpful and is not — a value has to be deleted before a new name can be typed over it, which is the argument the field already made for offering a placeholder. Opening a loop clears it too, so something half-typed before a row was tapped cannot quietly rename it.
- **The line names the entry by its stored name**, not by what the field is showing, because the field may already be holding the new one and "updates chasse" is the fact that stops chasse going by accident.
- **`unsaved` sits outside the row's own button.** The button's accessible name is what the loop *is*; a word coming and going inside it renames the control under anyone listening to the page.
- **`Save as new` stays put and greys while the loop is half-set**, rather than leaving with the line it sits on. It reads the same guard the button does, and a control that vanishes on a press of space is a worse answer to "why can I not save" than one that is visibly refusing.
- **The merge gains a third operation, not a bigger one.** BR-12 rests on the operations being small enough that replaying one onto whatever Drive holds *is* the merge. A correction is written as a **replace by id** rather than a removal followed by an append, so it stays one small operation — and it does nothing at all where the id has gone, because appending instead would resurrect a loop the other device had deleted.

### Open questions

- **Nothing marks which loop is open across a reload.** Open a clip, correct a loop, reload, and the panel is back to adding. It is the right default — the id is a claim about this session — but a dancer who returns to the same clip may expect the loop they were on to still be the one a save writes to.
- **A rename is now possible but not discoverable.** It is a side effect of typing into a field whose placeholder is the current name; nothing says "you can rename this here".
- **Q-06's export and restore is still wanted**, and is more valuable now that a save can overwrite: the failure this story makes possible is losing a good loop by correcting it, and there is no undo behind it.

- **Dependencies:** US-01-11 (the panel this revises), US-01-15 (the Drive write a correction rides on)
