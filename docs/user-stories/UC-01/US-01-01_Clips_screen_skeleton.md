# US-01-01: Clips screen skeleton

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want the app to open on a Clips screen, so that the clips I have
added are the first thing I see and the place everything else starts from.

## Acceptance Criteria

- [ ] Given the app is opened at its root path, when it loads, then the Clips screen is shown — there is no landing page, no menu and no redirect in front of it
- [ ] Given the Clips screen, when it renders, then it shows a **Clips** heading and an **Add clip** action on one row, which wraps rather than overflowing on a narrow viewport
- [ ] Given the Clips screen, when it renders, then it lays out — in this document order — the heading row, the region the ordering chips will occupy (US-01-03), an **empty clip list**, and the standing Drive note
- [ ] 👁 Given the clip list, when it renders, then it is **two columns on a phone, three at `sm`, four at `lg`**
- [ ] Given a dancer who has added no clips, when the screen loads, then the clip list is empty and **Add clip** is the only meaningful action (UC-01 alternate flow 2a)
- [ ] Given the Clips screen, when it renders, then a standing note explains that clips live in Google Drive and that the app only sees files it uploaded itself (BR-11)
- [ ] 👁 Given the Clips screen, when its content is shorter than the viewport, then the page background still fills the full height

## Notes

- **Mockup:** `mockup/src/Library.jsx:131–182` (page shell), `mockup/src/App.jsx:28–47` (which screen is shown)
- **References:** UC-01 Basic Flow steps 1–2, alternate flow 2a, BR-11
- **Not in this story:** the tiles themselves (US-01-02), the ordering chips' behaviour (US-01-03), and the Add clip flow behind the button (US-01-04). The button is present and inert here.
- **Dependencies:** none. This is the first story of the page.

### 👁 — criteria verified by eye, not by test

Two criteria are pure CSS. jsdom has no layout engine, so a breakpoint and a
viewport-height fill are strings to it, and the only unit test available asserts the
class attribute — which pins the implementation rather than the behaviour and is
exactly what a review should reject. They are marked 👁 and verified in a real browser
at phone, `sm` and `lg` widths instead. **A missing test against a 👁 criterion is not
a TDD gap.** If Playwright is ever set up, they stop being 👁 and become real tests.

### Scaffolding, absorbed into this story

The repo has `mockup/` and `docs/` and no product code: no TypeScript, no build, no
test runner anywhere. TDD is non-negotiable here, so this story cannot reach RED
without a harness that does not exist. That scaffolding is **absorbed into this
ticket** rather than raised separately.

It deliberately has **no acceptance criterion of its own** — the criteria above stay
about the Clips screen, and the scaffolding is judged on whether the choices are
sound, with a green build as its floor. What lands, in `app/`:

- **Vite + React 19 + TypeScript strict**, matching the mockup's major versions
- **Vitest + React Testing Library** as the test runner — the first RED depends on it
- **Tailwind v4**, reusing the mockup's eight-token `@theme` block from
  `mockup/src/index.css` verbatim. Those tokens *are* the design system; there is no
  separate tokens directory in this repo
- **react-router**, per the decision below
- **oxlint**, matching the mockup

### Decisions taken at the planning gate

- **Routing is real, not state.** The mockup switches screens by state
  (`App.jsx:25–27`) because it had no URLs worth preserving. The product does: a clip
  should survive a refresh and be linkable. Retrofitting a router later touches every
  screen, so it goes in now. This resolves the open question this story previously
  carried. The Clips screen is the root path, and AC 1 means nothing redirects in
  front of it — not that routes are absent.
- **The app lives in `app/`**, keeping the repo a set of labelled islands
  (`docs/`, `mockup/`, `spike-*/`, `app/`) rather than promoting one of them to the
  root.
