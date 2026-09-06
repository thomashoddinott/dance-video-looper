# CLAUDE.md

Instructions for Claude Code sessions in this repo. Keep this file thin.

## What this is

A personal dance-practice tool: load a short video clip, set an A/B loop over the
few seconds you're learning, slow it down, and save the loops worth coming back
to. Static React site, **no backend of any kind**, hosted on GitHub Pages, with
Google Drive as the storage layer so clips *and their saved loop points* sync
between laptop and phone.

Mirroring was considered and cut — don't reintroduce it without asking.

Built as a portfolio piece — the process artefacts matter as much as the app.

## Layout

```
app/               the product — React + Vite, TDD, the thing being built
mockup/            throwaway UI mockup — vibe-coded, loads a local file
docs/use-cases/    UC-XX — what a screen is for, derived from the mockup by walkthrough
docs/user-stories/ US-XX-YY — one story per visible component, cut from the mockup
scripts/verify.mjs the verification gate — see below. `scripts/gate/` is its pure
                   core, unit-tested by `npm test` at the repo root
```

## Process

Artefacts are produced in this order, and the order matters:

**mockup → use case → user stories → code**

- The **mockup comes first** and is vibe-coded.
- A **use case is derived from the mockup by walkthrough** — Thomas opens the live
  page and narrates; you integrate section by section. Never derive one by reading
  mockup code alone, and never silently rewrite a use case to match the mockup.
- **User stories are component-driven**, cut from the mockup: a skeleton story
  first, then one story per visible component, each anchored to `file:line-range`.
- Then code, TDD throughout.

Not every screen is mocked up first. A screen that only turns out to be needed
during development gets a **mockup gate pass** on its own ticket instead: build
it, then retrofit the mockup to match, so the mockup stays a true reference for
the use case rather than a stale one. Don't block work waiting for a mockup that
was never drawn — flag it and carry on.

The existing artefacts under `docs/` are the format. Follow them; don't invent a
new one. Artefacts are written in **English**.

## Dev Cycle Flow

Every ticket carries a checkable Definition of Done — the acceptance criteria the
work gets reviewed against. No ticket starts without one.

Given a ticket, always follow this cycle:

1. **Ticket** — view the issue, assign it, and move its card to **In progress**.
2. **Worktree + branch** — immediately create a Claude Code worktree with a feature
   branch off `main`, **before any planning or coding**. All development happens
   inside it.
3. **Plan** — agree the approach before writing code, and confirm the issue carries
   acceptance criteria, writing them with Thomas if they're missing.
4. **Mockup reference** — if the ticket touches UI, find the matching page in
   `mockup/src/` and use it as the visual reference throughout. Don't copy its code;
   the result should just look the same.
5. **TDD loop** — RED-GREEN-REFACTOR on the branch. Once implementation is
   green-lit, run every plan step to completion without pausing for commit
   approval. One logical commit per step, codebase green.
6. **PR** — targeting `main`.
7. **Cleanup** — confirm with Thomas before deleting the worktree, and only once the
   branch is pushed and the PR exists.
8. **Review** — in a **new session**, so the review starts from the PR rather than
   from the conversation that wrote it. The review drives the feature in the real
   app before reading a line of it, and stops for a human decision at each finding.

Then the PR lands, the ticket closes, and the worktree is tidied away.

**Worktrees:** use Claude Code worktrees (`.claude/worktrees`), not plain
`git worktree`. They're the default workspace for all ticket-based development.

## The verification gate — there is no CI, on purpose

**This project is not getting CI.** No GitHub Actions, no runner, no workflow file.
It's a personal static site with no backend; a hosted pipeline is machinery out of
proportion to it. Don't helpfully add one — including for the deploy, which is a
local command (see **Deploying**) and not a pipeline.

What CI was for is kept. **Every check that applies runs locally, in the session, and
every one is green before a merge:**

```
node scripts/verify.mjs              # run this
node scripts/verify.mjs --install    # same, installing deps first
```

It works out what to run from what's present — every workspace with a `package.json`,
every script it declares that terminates. Nothing is hardcoded, so adding a workspace
or a script needs no edit to it.

Reading the output:

- **`SKIP` is not "fine", it's a fact with a reason** — `mockup test SKIP — no "test"
  script declared` means that code is unverified, and the gate says so rather than
  staying quiet. A check no workspace declares is never listed at all, so the report
  can't fill up with capabilities the project doesn't have.
- **`GATE: PASS` means every check that ran was green.** Any failure fails the whole
  gate and exits non-zero.

Read this instead of `gh pr checks` — nothing runs when a PR is opened, so an empty
check list is not a pass. A PR that has not been through the gate is unverified.

## Deploying

Also local, and also not CI. From `app/`:

```
npm run build
npx gh-pages -d dist --dotfiles
```

That pushes the built site to the `gh-pages` branch, which Pages serves from. `main`
never carries built output — `dist/` is gitignored.

- **`--dotfiles` is not optional.** `gh-pages` skips dotfiles by default, and
  `public/.nojekyll` is what stops Pages running the build through Jekyll.
- **Don't add a `deploy` script to any `package.json`.** The gate runs every script a
  workspace declares that terminates, so a `deploy` script means `node
  scripts/verify.mjs` publishes the site as a side effect of verifying it.
- The base path is `/dance-video-looper/`, set in `app/vite.config.ts` for dev as well
  as build so the dev server exercises it too. `404.html` is a copy of `index.html`,
  emitted at build, so a reload on a route deeper than the root reaches the router
  instead of GitHub's 404.
- Sign-in on the deployed site needs its origin registered on the OAuth client, which
  is a Google Cloud Console step. Until it is done, sign-in fails in a way that looks
  like the dancer declining consent.

## Gotchas

- **Never let a module and a component differ only in case.** `savedLoops.ts` and
  `SavedLoops.tsx` are *the same path* on macOS, so `import { SavedLoops } from
  './SavedLoops'` silently resolved to the pure module and React was handed an
  `undefined` component — the error names neither file. The pair here is
  `savedLoops.ts` + `SavedLoopsPanel.tsx`. It would build fine on the Linux runner
  this project deliberately does not have, which is the trap: local-only, and
  invisible until render.

## Constraints

- **No backend, no serverless function.** If something seems to need one, that's a
  finding — report it, don't build it.
- **The app never touches Instagram.** Every anonymous route to a reel's mp4 is
  closed, and a browser can't supply auth cross-origin. Clips are downloaded by
  hand with existing tools. This is settled — don't relitigate it.
- **Drive scope stays `drive.file`.** The broader scopes are restricted and would
  need a Google security assessment. Consequence: the app only sees files it
  created, so every clip must be uploaded through the app.
- **Cache-first.** A ~9MB clip takes ~7s to download before it plays. Cache clips
  and metadata locally; it also covers a studio with bad signal and absorbs the
  hourly token-renewal popup.

## Gitignored on purpose

- `*.mp4` — **no video is committed anywhere in this repo.** Clips live in Google
  Drive, which is what the storage layer is for, and any clip on hand locally is
  someone else's content, so it is not published here. Drop your own file into
  `app/public/` or `mockup/public/` to have something to play against. Don't
  commit one, and don't re-add a tracked sample.

  **A clip in `public/` is development-only and must never be deployed.** Gitignore
  does not cover that: Vite copies `public/` wholesale into `dist/`, so a file
  correctly kept out of every commit still lands on a public URL the moment the build
  is published. Clear `public/` before deploying. Publishing someone else's video is
  the one mistake here that cannot be taken back.
- `PLAN.md` — scratch, lives and dies inside a worktree.
- `.claude/` — the Claude Code working directory. Curated separately and tracked
  nowhere in this repo.

## Git

**Do not commit or push unless Thomas explicitly asks.**
