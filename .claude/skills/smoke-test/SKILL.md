---
name: smoke-test
description: Agent-guided smoke test. You narrate the steps, the user drives the real app by hand, and you verify the result against the database. Where the change has no UI surface to watch (a wire format, a serializer, a management command) you narrate the steps and then drive it yourself. Use whenever the user says "smoke test this", "let's smoke test", "can we smoke test X", "verify this works in the app", or otherwise wants to watch a change actually run before trusting it. Also invoked as the gate into a pr-reviewer review.
---

The user narrates nothing and clicks everything: **you** work out the walk, snapshot the tables, and verify the diff; **they** drive the UI by hand. Run this whenever a change needs to be seen working, whether or not there is an MR in play.

## Why it is shaped this way (load-bearing — do not "optimise" this into full automation)

- The user must personally watch the happy path run end-to-end. **Trust comes from seeing it, not from a green test suite.**
- The human stays in the loop **by design**. Driving the UI by hand every time keeps them anchored to _what the feature actually does_ before they start judging the code.
- Full automation would breed the habit of pulling things in and merging changes **nobody ever watched run**. The user considers that very bad, and has said so explicitly.
- Your job is only to **lower the friction** — narrate the steps, snapshot and diff the tables — so the manual test actually happens. Never perform the feature for them.

This skill exists to make manual testing _easier and more encouraged_, not to remove the user from the loop.

## The one carve-out: changes with no UI surface

**If the change has nothing a human could observe on screen, you drive it yourself.** Everything above is about keeping the user anchored to what a feature _does_; where there is no screen, hand-driving anchors them to nothing and the ceremony costs a browser session to watch an unremarkable page do what it always did.

**The test is the observable surface, not the file paths.** "Backend-only" by diff is the wrong question, because a backend change whose whole point is what a page displays is exactly the kind that needs watching. Ask instead: _would the user see anything different?_

| Change                                                                                                                | Who drives                                                           |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| A service-to-service wire format; a serializer that rejects or accepts a body; a management command; a mock's payload | **You.** Nothing renders.                                            |
| An API field a page shows, a new column, a changed label, an alert that surfaces                                      | **The user**, even if the diff never leaves `backend/`.              |
| Anything you are unsure about                                                                                         | **The user.** The default stands whenever the answer is not obvious. |

#NNN is the worked example: the mock's callback body and the callback serializer changed, the user's upload was untouched, the photo overlay read the same `boxes` it always had, and the only new field (`mask_uri`) had no renderer until #NNN. Driving the browser would have proved nothing the container log and the DB did not.

**You still narrate first.** Lay out the numbered steps and what each one proves, hand the user the chance to redirect, _then_ execute and report the diff. Do not collapse this into a wall of tool calls with a summary at the end. On #NNN the walk-through is precisely what earned its keep: presenting the steps surfaced that the running container predated the change, and the user spotting a stray checkout revealed that `<redacted>.mjs` had baked the wrong `<redacted>.py` into the image. Both were invisible in the diff and would have produced a confidently green, meaningless result.

Report what only a human would otherwise have seen: the callback status codes on the wire, the row deltas, the fetched artefact. And say plainly what you could **not** reach, since a path that needs a hand on it does not stop being untested because the rest was automated.

## Step 0: Put the main worktree on the code under test

The user smoke tests on the **main worktree** at `C:\Users\utente\repos\<redacted>`, where their dev servers and their seeded DB already live. If the code under test is a branch, put the main checkout on it with a **detached** checkout:

```bash
git -C C:\Users\utente\repos\<redacted> fetch origin <branch>
git -C C:\Users\utente\repos\<redacted> checkout --detach origin/<branch>
```

**Detached is the whole trick, and it is not optional.** That branch is normally still checked out in its own `.claude/worktrees/` worktree, and a branch can live in only one checkout: a plain `git checkout <branch>` fails outright with `fatal: '<branch>' is already used by worktree at ...`. Detaching onto the _remote_ ref sidesteps the conflict entirely. Same commit, same code, and the worktree keeps the branch so it stays editable afterwards.

**Never delete the worktree to free the branch.** That is the wrong fix: it destroys the workspace the follow-up fixes need, and it is exactly the "weird stuff" this step exists to avoid.

**Capture where they were first**, so it is restorable:

```bash
git -C C:\Users\utente\repos\<redacted> rev-parse --abbrev-ref HEAD
```

Before detaching, check the branch's worktree is clean and matches origin (`git -C <worktree> status --short`, then compare `rev-parse` on the local and remote refs). If it holds uncommitted work, **say so and stop** — that work is not in the branch, so smoking it would test the wrong thing.

### Shell tool exception (worth knowing before you hit it)

From a **worktree-isolated session** the Bash tool refuses `git -C` aimed at the shared checkout. The identical command runs fine through the **PowerShell** tool. This is the one sanctioned exception to CLAUDE.md's "Bash is primary" rule; take it only for this, and say what you are doing when you do.

### The migration trap

Switching the main checkout's ref can leave `backend/db.sqlite3` at the wrong migration state for the code now sitting in front of it. **A page can look perfectly healthy purely because a seed migration is unapplied** — that failure mode has bitten before and it costs a whole smoke test.

So before driving anything:

```bash
uv run --directory backend python manage.py showmigrations
```

If anything the branch adds is unapplied, `npm run db:reset` is the reliable path (drop, migrate, `seed_demo`). Note that **`seed_demo` alone dies on a non-empty DB** — `db:reset` is what actually works.

## Step 1: Derive the walk

From the diff, work out:

- **The happy path** — the one core user journey this change delivers.
- **The persistence side effects** — every table the write touches, plus the invariants worth checking: new rows, populated columns, FK linkage, "exactly one parent"-style constraints, content-type and derived fields.

## Step 2: Before-snapshot

Run a **read-only** capture of those tables and present it as a small table: row counts, max ids, and any key columns or identifiers. Prefer the project's own shell over reaching into a DB tool:

```bash
uv run --directory backend python manage.py shell -c "..."
```

State explicitly **what you expect to change**. A prediction made before the fact is what turns the after-snapshot into evidence.

## Step 3: Narrate the steps; the user drives

Give **numbered UI actions** ("do this, then this"), and for each one what they should **see on screen**: the toast, the redirect, the inline error. Include:

- Any gotchas the data demands (a unique field needs a fresh value, a file must be a permitted type).
- Any **negative checks** worth a few seconds (a duplicate, a rejected input) and the exact message they should see.
- Which dev account to use where it matters. For `<redacted>` the local dev account is **<redacted>**; only <redacted> exist.

**Never auto-execute the feature**, unless the change has no UI surface and the carve-out above applies. Otherwise: no driving the browser, no scripted POSTs standing in for the user's hands.

Where the carve-out does apply, still present this numbered walk and let the user redirect before you run it. Drive it through **production code** wherever you can reach it (the service function the UI would have called, the real client, the real endpoint) rather than a hand-rolled request, so the only thing missing from the path is the click.

## Step 4: After-snapshot and verify

When the user says done, re-run the same capture, **diff before → after**, and report pass/fail per expectation:

- Did the predicted row deltas land?
- Do the new rows carry the right columns and links?
- Do the invariants hold?
- For anything touching files, is the file **actually on disk**?

Surface the one or two things only the user could have observed (the on-screen message, the picker behaviour) and ask them to confirm those.

## Step 5: Call it

The smoke passes only on a **clean, verified diff** plus the user's confirmation of what they saw. On any mismatch, **stop and report what diverged** rather than smoothing it over. The change may be broken, and surfacing that is the most valuable thing this exercise can do.

## When there is no table to diff

Two shapes come up often, and neither should stall the skill:

**A read-only feature that persists nothing** (an address search, a lookup, a filter, a report). The before/after snapshot has no subject, so the analogue is to capture the **service's or endpoint's raw output** and reconcile it against what the UI displayed. Call the endpoint yourself for the cases that matter, show the user the raw result, and have them confirm the dropdown or the table showed the same thing. That reconciliation is the verification; it is not a weaker smoke test, just a different subject.

**A pure UI, refactor, copy or config change.** Nothing to snapshot at all: narrate the **visible behaviour** to check (what to click, what should render and what should not, before versus after), have the user drive it, and confirm what they saw.

The rule that does not bend in either case: it is run, for real, before the work is called done. By the user's hand where there is a UI surface, by yours where there is not.

## Afterwards: put the main worktree back

The main repo is now on a **detached HEAD**. Return it to where it was **before editing any file that is not part of the change under test** (project docs, skills, settings) — a commit made on a detached HEAD lands on no branch and is trivially lost:

```bash
git -C C:\Users\utente\repos\<redacted> checkout main
```

If the DB was reset for the smoke, say so, since that discards whatever local demo state the user had built up.
