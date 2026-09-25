import { useMemo, type ReactNode } from 'react'

import { DriveSessionContext, useDriveSession } from '../drive/driveSession'
import type { TokenLookup } from '../drive/session'

/* Handed to the demo's `DriveApi`, which ignores it. It exists because every
   hook asks for a token before it touches its api, and the answer has to be
   yes without asking Google. */
const DEMO_TOKEN: TokenLookup = { available: true, value: 'demo' }

const alwaysADemoToken = async () => DEMO_TOKEN

const nothingToReport = () => {}

/* The session as the demo sees it: a token always to hand, and never one from
   Google. The status and the sign-in are the real session's, passed straight
   through, because signing in is how a visitor leaves the demo — and a demo
   claiming to be connected would be telling them something untrue.

   Reporting a withdrawn consent is swallowed. Nothing the demo's api refuses
   is the dancer's Google account speaking. */
export const DemoSession = ({ children }: { readonly children: ReactNode }) => {
  const real = useDriveSession()

  const value = useMemo(
    () => ({
      ...real,
      renewed: false,
      requireToken: alwaysADemoToken,
      reportConsentWithdrawn: nothingToReport,
    }),
    [real],
  )

  return <DriveSessionContext value={value}>{children}</DriveSessionContext>
}
