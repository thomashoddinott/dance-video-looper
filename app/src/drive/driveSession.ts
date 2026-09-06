import { createContext, useContext } from 'react'

import type { SessionStatus, TokenLookup } from './session'

export type DriveSession = {
  readonly status: SessionStatus
  readonly renewed: boolean
  readonly signIn: () => Promise<void>
  readonly requireToken: () => Promise<TokenLookup>
  readonly reportConsentWithdrawn: () => void
}

export const DriveSessionContext = createContext<DriveSession | undefined>(
  undefined,
)

export const useDriveSession = (): DriveSession => {
  const session = useContext(DriveSessionContext)

  if (session === undefined) {
    throw new Error('useDriveSession needs a DriveSessionProvider above it')
  }

  return session
}
