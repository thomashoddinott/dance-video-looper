# US-01-13: Google sign-in and the Drive session

**Status:** APPROVED
**Use Case:** UC-01 — Loop a section of a clip
**Actor:** Dancer
**Priority:** TBD

## Story

As a dancer, I want to connect the app to my Google account once, so that my clips
and loops have somewhere to live without me setting it up again.

## Acceptance Criteria

- [ ] Given a dancer who has not authorised the app, when they sign in, then the only Drive scope requested is **`drive.file`**, and no broader one
- [ ] Given consent is granted, when the session begins, then an access token is held by the session, and anything needing Drive obtains it from there rather than holding its own
- [ ] Given a held token, when its hour is up, then the session reports itself **expired** rather than raising an error — expiry is an expected state, not a failure
- [ ] Given an expired token, when the dancer next takes an action that needs Drive, then renewal is triggered **by that action** and not by a background timer, so the interruption lands at a natural break instead of mid-move
- [ ] Given a renewal is triggered, when it completes, then the app tells the dancer their Drive session was renewed, rather than leaving them to wonder what the flash was
- [ ] Given the dancer has signed in before and the grant still stands, when they return in a later session, then the app does not ask for consent again
- [ ] Given the dancer refuses consent, when the sign-in prompt closes, then the app says Drive is unavailable and why, rather than failing silently
- [ ] Given consent was withdrawn since the last session, when a Drive call is refused, then the app says Drive is unavailable and why, and offers sign-in again

## Notes

- **Mockup:** none was drawn. This is *mostly* a cross-cutting concern with no screen of its own, but it is not surfaceless — it needs three thin surfaces, all of them on the Clips screen's existing footer note about Drive (`mockup/src/Library.jsx:175`): a **sign-in affordance**, a **renewal notice**, and an **unavailable-and-why message**. Discovered during development, so it takes a **mockup gate pass** (CLAUDE.md → Process): build it, then retrofit `mockup/src/` to match so the mockup stays a true reference. That retrofit happens **inside this ticket**.
- **Sign-in flow: the GIS token client (popup).** The spike built two flows and found they are **not interchangeable** — the redirect flow can sign you in but is refused `interaction_required` on renewal, so it cannot satisfy the renewal criteria above (`FINDINGS.md` Q6, Q8-4). The popup flow is therefore the one built. The redirect stays a designed-for fallback behind the same seam, unbuilt until the phone run says it is needed.
- **Carried from the spike, not from the criteria.** Four things `spike-google-drive-storage/` had already settled, which the criteria do not mention and which the build would have been wrong without:
  - **A 30-second expiry skew** (`src/lib/auth.js`). A token still valid when a Drive call starts can be dead when it arrives, and Drive answers with a 401 — which is exactly what a withdrawn grant looks like. Without the skew, AC 8's message is untrustworthy.
  - **The token is kept in localStorage** between visits, which is how AC 6 is actually delivered. Without it consent stood but the footer still read *"Not connected to Drive"* on every reload and the dancer still had to click — AC 6 passing on its letter and failing on its point. The spike proved the grant survives a tab close (`FINDINGS.md` Q1).
  - **The Client ID is validated for shape**, not just presence (`src/config.js`). The placeholder pasted out of `.env.example` otherwise reaches Google and returns as a refusal the dancer never made.
  - **The dev port is pinned to 5173 with `strictPort`.** Only `http://localhost:5173` is a registered OAuth origin, so a drifting port breaks sign-in intermittently and points the blame at Google.
- **Two states exist that no criterion names**, both from wiring the real SDK: `drive-not-configured` (no or malformed Client ID) and `drive-unreachable` (the sign-in script never loaded). Neither is the dancer refusing anything, and the only alternative was to report a refusal that never happened. UC-01 exception `*c` makes the second ordinary rather than an edge case.
- **References:** UC-01 BR-11, BR-14, exception flow *b
- **Not in this story:** anything actually stored — clips (US-01-14), loops (US-01-15), caching (US-01-16). This story establishes the session those three use. Also not here: the redirect fallback, and deploying an HTTPS origin.
- **Open questions:**
  - 📌 **Whether OAuth works on a phone is unproven, and it gates the other three storage stories** (UC-01 Q-10, `FINDINGS.md` Q5). It needs a deployed HTTPS origin, so it cannot be settled from localhost, and since the phone *is* the point a desktop pass would not settle it either. **Decision: build now, verify on deploy day.** The spike's own verdict is that a bad answer is *"friction to design around rather than a dead architecture"* — cache-first means a practice session needs no token at all, and every fallback (PWA install, longer cache, a different storage layer) sits behind the same session interface. So the flow choice is isolated behind one seam and Q-10 stays open and tracked. **This story does not close it.**
  - Renewal **flashes a popup and no backend-less app can do better**. The spike established this by direct observation, and ruled out the alternatives: redirect with `prompt=none` is refused with `interaction_required`, and the hidden-iframe route died with the third-party-cookie phase-out. Papercut, not a blocker — but it is permanent, so the wording around it matters. The popup itself is Google's and outside our control; what this story owns is *telling the dancer what it was*.
    - **Observed in the !52 smoke test: it is not a flash, it is a tap.** With `prompt: ''` and a standing grant, Google still shows the **account chooser** and waits to be clicked — no consent screen, but not silent either. So the interruption AC 4 works so hard to place "at a natural break" is a deliberate interaction, not three seconds of nothing. That raises the stakes on US-01-16 (cache-first), which is what stops it landing mid-practice at all.
  - If the redirect fallback is ever built, its documented remedy for silent renewal (`login_hint`) costs the `openid email` scopes on top of `drive.file`. That is not broader *Drive* access, so it does not breach AC 1 as written — but it is an extra scope, and it is a decision for that story rather than this one.
- **Dependencies:** none. First of the storage stories.
