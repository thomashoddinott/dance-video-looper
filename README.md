# Dance Video Looper

Personal software project. Also wanted to test my agentic workflow on something public facing.

React, responsive design so I can use it when I go dancing. Google Drive as a basic persistence layer.

Inspired by [LoopTube](https://looptube.io).

---

## Google Drive setup

Each instance of the app is separate, with its own Google Cloud project, Client ID
and Drive. There is no shared service and no account to request. Setting up an
instance grants no access to any other instance's project, Drive or clips.

Google Drive is a basic persistence layer for the app: it holds the clips
themselves, and the saved loops as a single JSON file. The app creates one folder on first sign-in and keeps
everything in it:

    Dance Video Looper/
    ├── <clip>.mp4          one file per uploaded clip, under its original name
    ├── loops.json          every saved loop, for every clip
    └── Thumbnails/
        └── <clip-id>.jpg   one still per clip, for the grid

Each device also caches clips, thumbnails and loops locally, so a cached clip plays
without a download. This layout may change.

### Google Cloud Console

[console.cloud.google.com](https://console.cloud.google.com)

1. **Project picker > New project.** Project name: any.
2. **APIs & Services > Library > Google Drive API:** Enable.
3. **APIs & Services > OAuth consent screen > Get started.**
   - App name: any
   - User support email: the Google account that will sign in to the app
   - Audience: External
   - Contact information: the same account
4. **Audience > Test users > Add users:** the same account. Publishing status
   stays on Testing.
5. **Data Access > Add or remove scopes:** `.../auth/drive.file` only.
6. **Clients > Create client.**
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:5173`, and
     `https://<github-user>.github.io` to deploy. Origin only, no path.
   - Authorized redirect URIs: none
   - Copy the Client ID. The client secret is not used.

### Local

    cp app/.env.example app/.env.local    # set VITE_GOOGLE_CLIENT_ID to the Client ID
    npm --prefix app install
    npm --prefix app run dev              # http://localhost:5173/dance-video-looper/

### GitHub Pages (optional, for a fork)

1. **Actions:** enable workflows.
2. **Settings > Pages > Source:** GitHub Actions.
3. **Settings > Secrets and variables > Actions > Variables > New repository
   variable:** `VITE_GOOGLE_CLIENT_ID` = the Client ID.
4. Push to `main`. The site deploys to
   `https://<github-user>.github.io/dance-video-looper/`. For a renamed fork, set
   `base` in `app/vite.config.ts` to `/<repo-name>/` first.
