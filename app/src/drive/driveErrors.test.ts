import { describe, expect, it } from 'vitest'

import { DriveError } from './driveApi'
import { withdrewConsent } from './driveErrors'

describe('telling a withdrawal from an ordinary failure', () => {
  /* The session already retires tokens 30 s early precisely so an expiry cannot
     arrive as a 401 mid-call. What is left, therefore, is the dancer having
     removed access in their Google account — which they can act on, and which
     needs `reportConsentWithdrawn` rather than a generic apology. */
  it('reads a 401 as consent having been withdrawn', () => {
    expect(withdrewConsent(new DriveError('no', 401))).toBe(true)
  })

  it('does not read a 403 as a withdrawal — the grant stands, something else refused', () => {
    expect(withdrewConsent(new DriveError('quota', 403))).toBe(false)
  })

  it('does not read Google having a bad minute as a withdrawal', () => {
    expect(withdrewConsent(new DriveError('boom', 500))).toBe(false)
  })

  /* A studio with bad signal is the expected case, not the edge (UC-01 *c).
     Telling the dancer their access was removed because a phone lost its
     connection would be the app blaming them for the room. */
  it('does not read a dropped connection as a withdrawal', () => {
    expect(withdrewConsent(new TypeError('Failed to fetch'))).toBe(false)
  })

  it('survives being handed something that is not an error at all', () => {
    expect(withdrewConsent('nope')).toBe(false)
    expect(withdrewConsent(undefined)).toBe(false)
  })
})
