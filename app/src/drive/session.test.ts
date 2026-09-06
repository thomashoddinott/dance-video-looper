import { describe, expect, it } from 'vitest'

import {
  consentRefused,
  consentWithdrawn,
  driveUnreachable,
  hold,
  signedOut,
  statusOf,
  tokenFor,
  type Grant,
} from './session'

const AN_HOUR_IN_SECONDS = 3599
const AN_HOUR_IN_MS = AN_HOUR_IN_SECONDS * 1000

const SIGN_IN = 1_756_000_000_000

const aGrant = (overrides: Partial<Grant> = {}): Grant => ({
  value: 'ya29.a0-a-real-looking-access-token',
  expiresInSeconds: AN_HOUR_IN_SECONDS,
  ...overrides,
})

describe('the Drive session', () => {
  it('has no token before the dancer has signed in', () => {
    expect(statusOf(signedOut, SIGN_IN)).toBe('signed-out')
  })

  it('holds the token Google granted for as long as it lasts', () => {
    const session = hold(aGrant(), SIGN_IN)

    expect(statusOf(session, SIGN_IN + AN_HOUR_IN_MS - 60_000)).toBe('active')
  })

  it('retires a token half a minute early, so a Drive call cannot die in flight', () => {
    const session = hold(aGrant(), SIGN_IN)

    expect(statusOf(session, SIGN_IN + AN_HOUR_IN_MS - 20_000)).toBe('expired')
  })

  it('reports the token expired once its hour is up, rather than failing', () => {
    const session = hold(aGrant(), SIGN_IN)

    expect(statusOf(session, SIGN_IN + AN_HOUR_IN_MS)).toBe('expired')
  })

  it('takes the lifetime from the grant rather than assuming an hour', () => {
    const session = hold(aGrant({ expiresInSeconds: 60 }), SIGN_IN)

    expect(statusOf(session, SIGN_IN + 61_000)).toBe('expired')
  })
})

describe('asking the session for a token', () => {
  it('hands out the granted token while it is still good', () => {
    const session = hold(aGrant({ value: 'ya29.the-granted-one' }), SIGN_IN)

    expect(tokenFor(session, SIGN_IN)).toEqual({
      available: true,
      value: 'ya29.the-granted-one',
    })
  })

  it('hands out nothing before sign-in, and says why', () => {
    expect(tokenFor(signedOut, SIGN_IN)).toEqual({
      available: false,
      because: 'signed-out',
    })
  })

  it('withholds an expired token rather than handing one Drive would reject', () => {
    const session = hold(aGrant(), SIGN_IN)

    expect(tokenFor(session, SIGN_IN + AN_HOUR_IN_MS)).toEqual({
      available: false,
      because: 'expired',
    })
  })

  it('withholds a token when consent is gone, and says which way it went', () => {
    expect(tokenFor(consentWithdrawn, SIGN_IN)).toEqual({
      available: false,
      because: 'consent-withdrawn',
    })
  })

  it('withholds a token when Google sign-in never loaded, which is nobody refusing anything', () => {
    expect(tokenFor(driveUnreachable, SIGN_IN)).toEqual({
      available: false,
      because: 'drive-unreachable',
    })
  })
})

describe('a session without consent', () => {
  it('tells a refusal apart from a withdrawal, because the dancer needs a different sentence for each', () => {
    expect(statusOf(consentRefused, SIGN_IN)).toBe('consent-refused')
    expect(statusOf(consentWithdrawn, SIGN_IN)).toBe('consent-withdrawn')
  })

  it('stays unavailable however long the dancer waits, since no clock brings consent back', () => {
    expect(statusOf(consentRefused, SIGN_IN + AN_HOUR_IN_MS * 24)).toBe(
      'consent-refused',
    )
  })
})
