import { describe, expect, it, vi } from 'vitest'

import {
  browserTokenSource,
  gisTokenSource,
  type GoogleOAuth2,
  type GoogleTokenClientConfig,
  type GoogleTokenResponse,
} from './gisTokenSource'

const A_CLIENT_ID = '1234567890-abcdef.apps.googleusercontent.com'

/* Stands in for the Google Identity Services SDK, which is a script tag in
   production. `initTokenClient` is the call AC 1 and AC 6 are about, so the
   double records it rather than the wrapper exposing what it asked for. */
const googleAnswering = (response: GoogleTokenResponse) => {
  const initTokenClient = vi.fn((config: GoogleTokenClientConfig) => ({
    requestAccessToken: () => {
      config.callback(response)
    },
  }))

  return { initTokenClient, oauth2: { initTokenClient } satisfies GoogleOAuth2 }
}

const googleFailingToOpen = () => {
  const initTokenClient = vi.fn((config: GoogleTokenClientConfig) => ({
    requestAccessToken: () => {
      config.error_callback({ type: 'popup_closed' })
    },
  }))

  return { oauth2: { initTokenClient } satisfies GoogleOAuth2 }
}

const aGoogleGrant = (
  overrides: Partial<GoogleTokenResponse> = {},
): GoogleTokenResponse => ({
  access_token: 'ya29.a0-a-real-looking-access-token',
  expires_in: 3599,
  ...overrides,
})

describe('asking Google for a Drive token', () => {
  it('asks for the drive.file scope and nothing broader', async () => {
    const google = googleAnswering(aGoogleGrant())

    await gisTokenSource(google.oauth2, A_CLIENT_ID)()

    expect(google.initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'https://www.googleapis.com/auth/drive.file',
      }),
    )
  })

  it('does not ask a dancer who already consented to consent again', async () => {
    const google = googleAnswering(aGoogleGrant())

    await gisTokenSource(google.oauth2, A_CLIENT_ID)()

    expect(google.initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: '' }),
    )
  })

  it('identifies the app with the client id it was configured with', async () => {
    const google = googleAnswering(aGoogleGrant())

    await gisTokenSource(google.oauth2, A_CLIENT_ID)()

    expect(google.initTokenClient).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: A_CLIENT_ID }),
    )
  })

  it('passes on the token and the lifetime Google returned', async () => {
    const google = googleAnswering(
      aGoogleGrant({ access_token: 'ya29.the-granted-one', expires_in: 1800 }),
    )

    const result = await gisTokenSource(google.oauth2, A_CLIENT_ID)()

    expect(result).toEqual({
      ok: true,
      grant: { value: 'ya29.the-granted-one', expiresInSeconds: 1800 },
    })
  })

  it('reads a refusal as consent refused rather than a crash', async () => {
    const google = googleAnswering({ error: 'access_denied' })

    const result = await gisTokenSource(google.oauth2, A_CLIENT_ID)()

    expect(result).toEqual({ ok: false, because: 'consent-refused' })
  })

  it('treats a dismissed popup as a refusal too, since the dancer chose not to grant', async () => {
    const google = googleFailingToOpen()

    const result = await gisTokenSource(google.oauth2, A_CLIENT_ID)()

    expect(result).toEqual({ ok: false, because: 'consent-refused' })
  })
})

describe('finding Google Identity Services in the browser', () => {
  it('reports Drive unreachable when the sign-in script has not loaded', async () => {
    const result = await browserTokenSource({}, A_CLIENT_ID)()

    expect(result).toEqual({ ok: false, because: 'drive-unreachable' })
  })

  it('says the app is unconfigured when no client id was built in, rather than blaming Google', async () => {
    const google = googleAnswering(aGoogleGrant())

    const result = await browserTokenSource(
      { google: { accounts: { oauth2: google.oauth2 } } },
      '',
    )()

    expect(result).toEqual({ ok: false, because: 'drive-not-configured' })
  })

  /* The literal is the one `.env.example` ships. It has to stay in step with
     that file, and the file says why: `isConfigured` is only a suffix check, so
     a placeholder written to look real would be sent to Google, rejected as
     `invalid_client`, and reported to the dancer as consent they refused. */
  it('says the app is unconfigured when the client id is still the placeholder from .env.example', async () => {
    const google = googleAnswering(aGoogleGrant())

    const result = await browserTokenSource(
      { google: { accounts: { oauth2: google.oauth2 } } },
      'paste-your-client-id-here',
    )()

    expect(result).toEqual({ ok: false, because: 'drive-not-configured' })
  })

  it('ignores whitespace around a client id pasted out of a config file', async () => {
    const google = googleAnswering(aGoogleGrant())

    const result = await browserTokenSource(
      { google: { accounts: { oauth2: google.oauth2 } } },
      `  ${A_CLIENT_ID}\n`,
    )()

    expect(result).toEqual({
      ok: true,
      grant: {
        value: 'ya29.a0-a-real-looking-access-token',
        expiresInSeconds: 3599,
      },
    })
  })

  it('goes through to Google once the script is there', async () => {
    const google = googleAnswering(
      aGoogleGrant({ access_token: 'ya29.through-the-browser' }),
    )

    const result = await browserTokenSource(
      { google: { accounts: { oauth2: google.oauth2 } } },
      A_CLIENT_ID,
    )()

    expect(result).toEqual({
      ok: true,
      grant: { value: 'ya29.through-the-browser', expiresInSeconds: 3599 },
    })
  })
})
