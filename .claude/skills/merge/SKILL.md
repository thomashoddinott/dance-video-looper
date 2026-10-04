---
name: merge
description: Land a merge request once CI is green, close its ticket if it has one, and tidy the worktree away. Use whenever finished work is ready to land - "merge it", "land this", "merge and clean up", "tidy up the worktree" - and as the final step of a pr-reviewer review. Works for ticketless branches too, quick fixes and chores included.
---

# Landing a merge request

The closing move of the Dev Cycle Flow: CI green, merge, ticket closed if there is one,
worktree gone. Each step verifies the one before it, because the expensive mistakes here
are deleting work that never landed and leaving a closed ticket sitting in the board's
`doing` column.

Only step 3 depends on a ticket existing. A quick fix or a chore branch often has none,
and the rest of the sequence is unchanged by that.

**This skill does not review the code.** When it runs as the last step of a
`pr-reviewer` review, that agent has already run the "have you read this code" gate and
the acceptance-criteria check. When the user invokes it directly, state what is about to
merge (MR number, title, target branch, file count) and let them stop you, but do not
re-litigate a merge they have asked for.

## Step 1: CI must be green, and a red job is not automatically a broken diff

Read the MR's head pipeline before anything else:

```bash
glab api "projects/<redacted>/merge_requests/<iid>"        # head_pipeline.id, sha
glab api "projects/<redacted>/pipelines/<pipeline-id>/jobs"
```

If a job failed, **diagnose before reporting it as a failure of the change**. Fetch the
job and read its `failure_reason` first, not its log:

```bash
glab api "projects/<redacted>/jobs/<job-id>"               # failure_reason, duration
glab api "projects/<redacted>/jobs/<job-id>/trace"
```

`failure_reason: job_execution_timeout` on `frontend-tests` is a known intermittent hang
on this project, not a signal about the diff. The tell is a trace that simply stops
partway with no summary line, and a duration equal to the job timeout exactly. Confirm
the diff is not implicated by checking whether the changed test files appear in the trace
at all, then restart rather than "fix" it.

**Restart it as a merge request pipeline, never a branch pipeline:**

```bash
glab api --method POST "projects/<redacted>/merge_requests/<iid>/pipelines"
```

`frontend-tests` is gated on merge-request events, so a pipeline created against the
branch ref silently skips the very job you are trying to re-run, and comes back green
having tested less. If a restart fails the same way twice, stop and investigate: two
identical hangs are evidence, one is weather.

Do not run the full suite locally to compensate. CI is the regression gate.

## Step 2: Merge

```bash
glab api --method PUT "projects/<redacted>/merge_requests/<iid>/merge?should_remove_source_branch=true"
```

Use the API rather than `glab mr merge`. The CLI refuses to merge over a red pipeline as
a client-side guard, which is unhelpful on the rare occasion the user has decided to
merge anyway, and the API is the same call without the opinion.

Check the response: `state` must read `merged` and `merge_commit_sha` must be populated.
A 405 means the MR is not mergeable (conflicts, or an unresolved discussion), not that
the merge quietly failed.

## Step 3: Close the ticket, if there is one

**Plenty of branches have no ticket**, and that is fine: a quick fix, a chore, a
follow-up nobody stopped to write up. Establish whether this one does rather than
assuming it, and if it does not, say so in one line and go straight to step 4.
Everything from step 4 on applies either way. Do not invent a ticket to close, and do
not raise one retrospectively just to have something to close.

Look for the number in this order and stop at the first hit:

1. `Closes #<n>` or `Fixes #<n>` in the MR description
2. the MR title, which by convention starts with `#<n>`
3. the branch name, e.g. `bug/NNN-address-wire-nullable`

If none of the three carries one, there is no ticket to close. Ask the user only when
the branch clearly implies one and you cannot find it.

With a number in hand, **check before closing anything**, because an MR body carrying
`Closes #<n>` closes the issue on merge by itself:

```bash
glab api "projects/<redacted>/issues/<n>"                  # state
```

- `state: closed` already, do not close it again.
- `state: opened`, close it: `glab issue close <n>`.

Either way the `doing` label usually survives, which leaves a closed ticket parked in the
board's Doing column:

```bash
glab issue update <n> --unlabel doing
```

If the ticket has unticked acceptance criteria that the work did satisfy, tick them on
the **GitLab issue only**, never in a repo file. A docs-only commit landing minutes after
the code re-triggers the whole pipeline for no code change.

## Step 4: Tidy the worktree

**Verify the work is on `origin/main` before deleting anything.** The merge response is
good evidence, the branch ref is better:

```bash
git fetch origin main --quiet
git branch -r --contains <branch-tip-sha>                        # must list origin/main
```

Then, in this order:

1. **Remove the frontend `node_modules` junction first, as a link.** A worktree's
   `frontend/node_modules` is a junction pointing at the main checkout's real one. A
   recursive delete follows it and takes the main checkout's dependencies with it.

   ```powershell
   $link = "<worktree>\frontend\node_modules"
   (Get-Item $link -Force).Attributes -band [IO.FileAttributes]::ReparsePoint   # confirm
   cmd /c rmdir "$link"                                            # deletes the link only
   ```

   Verify `frontend/node_modules/zod/package.json` still exists in the main checkout
   afterwards. `Remove-Item -Recurse` is the wrong tool here.

2. **Drop the worktree.** `ExitWorktree` with `action: "remove"` when the session is
   inside one. It compares against the branch name it created, so a branch renamed after
   `EnterWorktree` reads as unmerged work and it will refuse. That refusal is worth
   honouring until step 4's verification says otherwise, then pass
   `discard_changes: true`. If it exits without removing the directory, delete the
   leftover directory yourself and run `git worktree prune`.

3. **Delete the branch.** The remote one is gone already if the merge passed
   `should_remove_source_branch=true`. For the local one, check merged status against
   `origin/main` rather than `HEAD`, because the main checkout is often left on a
   detached HEAD by a smoke test and `-d` would measure against the wrong thing:

   ```bash
   git branch --merged origin/main --list "<branch>"
   git branch -D <branch>
   git fetch origin --prune --quiet
   ```

## Step 5: Report

State plainly: MR number and merge commit, the ticket state or that there was no ticket,
what was deleted (worktree, local branch, remote branch), and anything left behind on
purpose. If CI needed a restart, say so and say why, so a genuine flake does not get
remembered as a fixed bug.

## Notes

- Never skip the verification in step 4 to save a call. Deleting a worktree whose commits
  never landed is the one unrecoverable mistake in this whole flow.
- The project id is URL-encoded in every call above: `<redacted>`.
- Keep each `glab` call a single non-composite command, no `&&` or pipes, so it does not
  trip a permission prompt.
