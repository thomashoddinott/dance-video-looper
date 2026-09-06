import type { Grant, Unavailable } from './session'

/* The seam. The session core never learns which flow it is talking to, so the
   redirect fallback the spike built can drop in here unchanged if the phone run
   says the popup is unusable (FINDINGS.md Q5, Q8-4). */
export type TokenResult =
  | { readonly ok: true; readonly grant: Grant }
  | { readonly ok: false; readonly because: Unavailable }

export type TokenSource = () => Promise<TokenResult>

/* The shape of Google Identity Services this app touches — a script tag in
   production, an injected double in tests. */
export type GoogleTokenResponse = {
  readonly access_token?: string
  readonly expires_in?: number
  readonly error?: string
}

export type GoogleTokenClientConfig = {
  readonly client_id: string
  readonly scope: string
  readonly prompt: string
  readonly callback: (response: GoogleTokenResponse) => void
  readonly error_callback: (error: { readonly type: string }) => void
}

export type GoogleTokenClient = {
  readonly requestAccessToken: () => void
}

export type GoogleOAuth2 = {
  readonly initTokenClient: (
    config: GoogleTokenClientConfig,
  ) => GoogleTokenClient
}

/* Narrow by construction, and it stays that way: the broader Drive scopes are
   restricted and would need a Google security assessment (CLAUDE.md). */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

/* An empty prompt means "ask only the first time". Leaving it unset would make
   Google re-present the consent screen on every renewal, which is AC 6. */
const ASK_ONLY_THE_FIRST_TIME = ''

const resultOf = (response: GoogleTokenResponse): TokenResult => {
  const { access_token: value, expires_in: expiresInSeconds } = response

  if (value === undefined || expiresInSeconds === undefined) {
    return { ok: false, because: 'consent-refused' }
  }

  return { ok: true, grant: { value, expiresInSeconds } }
}

export const gisTokenSource =
  (oauth2: GoogleOAuth2, clientId: string): TokenSource =>
  () =>
    new Promise<TokenResult>((resolve) => {
      oauth2
        .initTokenClient({
          client_id: clientId,
          scope: DRIVE_FILE_SCOPE,
          prompt: ASK_ONLY_THE_FIRST_TIME,
          callback: (response) => {
            resolve(resultOf(response))
          },
          /* A dismissed or blocked popup is the dancer declining just as much
             as a refusal on the consent screen is. */
          error_callback: () => {
            resolve({ ok: false, because: 'consent-refused' })
          },
        })
        .requestAccessToken()
    })

/* Where the SDK actually lives. Passed in rather than read off `window`
   directly, so the absent case is a plain object in a test instead of a
   stubbed global. */
export type GisHost = {
  readonly google?: { readonly accounts?: { readonly oauth2?: GoogleOAuth2 } }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends GisHost {}
}

/* Every Google Client ID ends this way, and that is the whole of the check —
   it tells an unset or obviously-placeholder value from a plausible one, and it
   cannot tell a plausible fake from the real thing. So the burden sits on
   `.env.example`: its placeholder must NOT carry this suffix, or it sails
   through, reaches Google, and comes back as a refusal the dancer never made. */
const GOOGLE_CLIENT_ID_SUFFIX = '.apps.googleusercontent.com'

const isConfigured = (clientId: string) =>
  clientId.endsWith(GOOGLE_CLIENT_ID_SUFFIX)

/* Three ways this can fail before Google is ever reached, and only one of them
   is Google's. A build with no Client ID is a setup step nobody did; a missing
   script is the network or an extension; neither is the dancer declining. The
   spike kept these apart too (`src/config.js`), and the reason is that the
   first thing you do with a bad message is debug the wrong thing. */
export const browserTokenSource =
  (host: GisHost, clientId: string): TokenSource =>
  async () => {
    if (!isConfigured(clientId.trim())) {
      return { ok: false, because: 'drive-not-configured' }
    }

    const oauth2 = host.google?.accounts?.oauth2

    if (oauth2 === undefined) {
      return { ok: false, because: 'drive-unreachable' }
    }

    return gisTokenSource(oauth2, clientId.trim())()
  }
