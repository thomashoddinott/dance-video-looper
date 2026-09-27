[TODO - UPDATE - strip out sections after WHY - rewrite, basically take summary of use case]

# Dance Video Looper

[![CI](https://github.com/thomashoddinott/dance-video-looper/actions/workflows/ci.yml/badge.svg)](https://github.com/thomashoddinott/dance-video-looper/actions/workflows/ci.yml)

> The idea is [LoopTube](https://looptube.io)'s — this is a hobby rebuild of it for
> personal use, pointed at clips in my own Drive rather than YouTube.

A personal practice tool: load a short dance clip, set an A/B loop over the four
seconds you're actually trying to learn, and slow it down. On a laptop at home
and on a phone at the studio, with the same clips and the same loop points in
both places.

Built to be used — but the real reason it exists is to practise an agentic
development workflow end to end. The process artefacts — the use cases, the user
stories, and the mockup they were cut from — are as much the point as the app is,
and they are all in `docs/`.

## Why

I learn choreography from short clips, and the thing you need is stupidly
specific: play *these* four seconds, at *this* speed, over and over, until your
body has it. [LoopTube](https://looptube.io) does exactly that for YouTube and is
excellent — simple enough to drive one-handed on a phone in a corner of a dance
hall.

The dance community, though, is on Instagram. So the tool I want doesn't exist.

## Why this couldn't just be "LoopTube for Instagram"

LoopTube works because YouTube publishes an **IFrame Player API** — an embedded
player that exposes `seekTo()` and `setPlaybackRate()` to the page around it.
That single fact is what makes a front-end-only looper possible.

Instagram publishes no equivalent, and before designing around that I checked
whether a page could get at a reel's video file another way. Every route is
closed:

| Route | Result |
|---|---|
| `/embed/captioned/` HTML | 200, but a JS shell with no media in it |
| Post page, plain fetch | JS shell, no `og:video` |
| `facebookexternalhit` crawler UA | `og:video` stripped even for link-preview crawlers |
| `?__a=1&__d=dis` JSON | 404 — removed |
| `/api/v1/media/{id}/info/` | 302 to login |

There's a deeper reason this can't be solved in the browser at all. A page can
**display** cross-origin content but never **expose** it to another origin's
code: a cross-origin `<iframe>`'s `contentDocument` throws, and drawing that
video to a `<canvas>` taints it. That isn't Instagram blocking me — it's the
rule that makes it safe to have your bank open in another tab.

So the design stops fighting it. **Clips are downloaded by hand** with tools that
already exist, and the app never touches Instagram. It's a ten-second step, and
it means the tool still works when Instagram changes something next month.

## How it works

A static site with **no backend of any kind**, hosted on GitHub Pages, using
**Google Drive** as the storage layer. One Drive folder holds the clips plus a
`loops.json` manifest, so the loop points sync alongside the videos — mark up a
tricky section at home, and it's already there on the phone at the studio.

The useful corollary of the same-origin rule above: once you *have* a video URL,
`<video>` plays it with full `currentTime` and `playbackRate` control and no CORS
involved. Playback was never the hard part. Only discovery was.

## What was proven before anything was designed

The whole architecture rested on one unverified assumption — that a backend-less
static page can read and write Google Drive. That got its own throwaway spike
before a line of the product was designed, and it returned **GO**:

- Signed in, uploaded an mp4, listed it, downloaded it with a bearer token,
  played it, and created *then updated* a `loops.json` — no server anywhere
- Blob-URL playback seeks with **0.000 s drift**, and `playbackRate` is honoured
  by the decoder (measured against wall-clock, not just read back)
- A tight 2 s A/B loop held 3/3 cycles, 86 ms worst-case overshoot
- `loops.json` updates in place — same file ID, no duplicate per save

Four findings from it shape the product more than any feature request has:

1. **Every clip must be uploaded through the app.** The `drive.file` scope only
   sees files the app itself created, so a file dropped into the folder by hand
   is invisible — not restricted, *invisible*. The broader scopes are restricted
   and need a Google security assessment, so this is the right trade.
2. **Cache-first, or it's slow.** A 9.33 MB clip takes 7.1 s to download before
   it plays. Caching turns that into once-per-clip, works offline in a hall with
   bad signal, and softens the hourly token renewal — one decision paying three
   ways.
3. **Token renewal flashes once an hour** and no backend-less app can do better,
   so it's renewed on user-initiated sync rather than lazily at expiry — the
   interruption lands at a natural break instead of mid-move.
4. **Two devices editing loops will clobber each other.** `loops.json` is
   last-write-wins today, and that's a real way to lose work.

One question is deliberately still open: whether the OAuth flow behaves on a
phone. It needs a deployed HTTPS origin to test, so it can't be answered from
localhost — and since the phone *is* the point, a desktop pass wouldn't settle
it. It's tracked, not forgotten.

## How it's being built

Artefacts come in a fixed order, and the order is the point:

**mockup → use case → user stories → code**

The mockup is vibe-coded and throwaway. The use case is derived from it *by
walkthrough* — narrating the live page, rather than reading its code, so the
document describes what the thing is **for** instead of what happens to have been
built. User stories are then cut component-by-component from the mockup, each
anchored to a file and line range, so that reviewing a story means opening one
piece of UI and looking at it.

Work is tracked in this repo's issues — one ticket per piece of work, each
carrying the acceptance criteria it gets reviewed against.

## Running it

    npm --prefix app install
    npm --prefix app run dev

The clips grid is filled from Google Drive, so on a clean clone it starts empty.
To connect your own, see
[Appendix: connect your own Google Drive](#appendix-connect-your-own-google-drive).

No clip is committed, so to play something locally drop your own mp4 into
`app/public/`. Showing a bundled sample when Drive is not connected is still to do.

---

## Appendix: connect your own Google Drive

This is a personal app: one instance per person, each with its own Google Cloud
project, its own Client ID and its own Drive. There is no shared service to sign up
to. Setting it up gives you no access to my project, Drive or clips, and nobody has
to add you to theirs — you create your own project and add your own account to it.

Worth knowing before you start:

- **The Client ID is not a secret.** It identifies the app, authorises nothing, and
  ships in the JS bundle of any static site.
- **The app only sees files it uploaded itself.** It asks for the `drive.file` scope
  and nothing broader, because the broader Drive scopes are restricted and need a
  Google security assessment. So every clip goes in through the app's Add clip. A
  file dropped into the Drive folder by hand is invisible, not merely read-only.
  Switch to a new Client ID and the old clips and `loops.json` go invisible too, so
  re-uploading is expected, not a bug.
- **You bring your own clips.** Your library starts empty. The one clip in this repo
  plays in demo mode and never reaches your Drive.

(How I did it: I pasted a prompt like this one into Claude in Chrome and let it walk
me through.)

```text
Walk me through setting up Google sign-in for my own copy of Dance Video Looper, a
static web app that keeps its clips in the user's own Google Drive. Drive the browser
one step at a time. Hand over to me whenever I need to sign in, pick an account, or
supply one of my own values. If a button or field isn't where these steps say, the
Console has been rearranged: find the equivalent and tell me what you did. Don't
guess.

My own values (ask me for any you don't have):
- PROJECT_NAME: my choice, e.g. dance-video-looper
- MY_EMAIL: the Google account I will sign in to the app with
- GITHUB_USER: my GitHub username, only if I'm deploying my fork to GitHub Pages

Google Cloud Console (https://console.cloud.google.com)

1. Project picker in the top bar > New project. Project name: PROJECT_NAME. Create,
   then make sure it is the selected project.
2. APIs & Services > Library. Search "Google Drive API", open it, Enable.
3. APIs & Services > OAuth consent screen > Get started.
   - App name: my choice. It is what Google's sign-in popup shows.
   - User support email: MY_EMAIL
   - Audience: External
   - Contact information: MY_EMAIL
   - Agree to the Google API Services User Data Policy, Continue, Create.
4. Audience. Leave Publishing status on Testing. Test users > Add users > MY_EMAIL >
   Save. This is my own account on the project I just made. Without it, Google
   refuses sign-in.
5. Data Access > Add or remove scopes. Tick .../auth/drive.file and nothing else.
   Update, then Save.
6. Clients > Create client.
   - Application type: Web application
   - Name: my choice
   - Authorized JavaScript origins > Add URI: http://localhost:5173
   - If I'm deploying, Add URI again: https://GITHUB_USER.github.io
     Origins only: no path, no trailing slash.
   - Leave Authorized redirect URIs empty. The app signs in with Google's popup
     token flow, which uses origins only.
   - Create. Show me the Client ID; it ends in .apps.googleusercontent.com. The
     client secret is never used, so leave it.

GitHub, only if I'm deploying my fork (https://github.com/GITHUB_USER/dance-video-looper)

7. Actions tab > "I understand my workflows, go ahead and enable them".
8. Settings > Pages > Build and deployment > Source: GitHub Actions.
9. Settings > Secrets and variables > Actions > Variables tab > New repository
   variable. Name: VITE_GOOGLE_CLIENT_ID. Value: the Client ID from step 6.
   Add variable.
```

Then, on your machine. `app/.env.local` is the only file you edit:

    cp app/.env.example app/.env.local    # set VITE_GOOGLE_CLIENT_ID to your Client ID
    npm --prefix app install
    npm --prefix app run dev              # http://localhost:5173/dance-video-looper/

The dev server refuses to start if port 5173 is taken, rather than drift to a port
that isn't a registered origin.

To deploy, push to `main`. The pipeline tests, builds with your variable, and
publishes to `https://GITHUB_USER.github.io/dance-video-looper/`. If you renamed
the fork, first change `base` in `app/vite.config.ts` to `/<your-repo-name>/`.

**Check it worked.** Click Connect Google Drive and sign in as `MY_EMAIL`. Google
warns that the app is unverified — it's yours and in Testing, so continue. The footer
should read "Drive is connected." Then Add clip: the clip appears as a tile, and a
`Dance Video Looper` folder appears in your Drive.

**If it didn't:**

- *"Drive is not set up"* — the build has no Client ID. Check `app/.env.local`
  (or the repository variable) and restart the dev server.
- *The app says you declined access, and you didn't* — Google rejected the client.
  Usually the origin you're on is missing from step 6, or the Client ID is mistyped.
- *Google says access is blocked* — the account you signed in with isn't a test
  user (step 4).
