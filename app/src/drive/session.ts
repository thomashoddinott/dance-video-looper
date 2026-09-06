/* Google hands back a lifetime in seconds; everything downstream reasons in the
   millisecond clock the browser actually reads, so the boundary converts once. */
export type Grant = {
  readonly value: string
  readonly expiresInSeconds: number
}

export type AccessToken = {
  readonly value: string
  readonly expiresAt: number
}

/* Three ways to end up without Drive, and the dancer needs a different sentence
   for each: one they refused a moment ago, one they revoked in Google's account
   settings possibly weeks ago, and one where nobody decided anything and the
   sign-in service simply is not there. Collapsing them would mean blaming the
   dancer for a failed script load. */
export type Unavailable =
  | 'consent-refused'
  | 'consent-withdrawn'
  | 'drive-unreachable'
  | 'drive-not-configured'

export type Session =
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'holding'; readonly token: AccessToken }
  | { readonly kind: 'unavailable'; readonly because: Unavailable }

export type SessionStatus = 'signed-out' | 'active' | 'expired' | Unavailable

export const signedOut: Session = { kind: 'signed-out' }

export const unavailable = (because: Unavailable): Session => ({
  kind: 'unavailable',
  because,
})

export const consentRefused = unavailable('consent-refused')
export const consentWithdrawn = unavailable('consent-withdrawn')
export const driveUnreachable = unavailable('drive-unreachable')

export const tokenFrom = (grant: Grant, now: number): AccessToken => ({
  value: grant.value,
  expiresAt: now + grant.expiresInSeconds * 1000,
})

/* Picking a kept token back up on a later visit. No clock needed: whether it is
   still good is `statusOf`'s question, asked separately. */
export const resume = (token: AccessToken): Session => ({
  kind: 'holding',
  token,
})

export const hold = (grant: Grant, now: number): Session =>
  resume(tokenFrom(grant, now))

/* A token that is technically still valid when a Drive call starts can be dead
   by the time it arrives, and the failure comes back as a 401 — indistinguishable
   from consent having been withdrawn. Retiring it early costs one extra renewal
   an hour and removes a whole class of misdiagnosis. Carried from the spike,
   which uses the same half-minute. */
const EXPIRY_SKEW_MS = 30_000

const isLive = (token: AccessToken, now: number) =>
  now + EXPIRY_SKEW_MS < token.expiresAt

export const statusOf = (session: Session, now: number): SessionStatus => {
  if (session.kind === 'signed-out') return 'signed-out'
  if (session.kind === 'unavailable') return session.because

  return isLive(session.token, now) ? 'active' : 'expired'
}

/* The single door a Drive call gets its token through. Nothing else keeps a
   copy, so nothing else can be holding a stale one. */
export type TokenLookup =
  | { readonly available: true; readonly value: string }
  | {
      readonly available: false
      readonly because: Exclude<SessionStatus, 'active'>
    }

export const tokenFor = (session: Session, now: number): TokenLookup => {
  if (session.kind === 'signed-out') {
    return { available: false, because: 'signed-out' }
  }

  if (session.kind === 'unavailable') {
    return { available: false, because: session.because }
  }

  if (!isLive(session.token, now)) {
    return { available: false, because: 'expired' }
  }

  return { available: true, value: session.token.value }
}
