import { Navigate, Route, Routes } from 'react-router'

import type { AppProps } from './App'
import { App } from './App'
import type { DemoProps } from './demo/DemoApp'
import { DemoApp } from './demo/DemoApp'
import { useDriveSession } from './drive/driveSession'
import { isConnected } from './drive/session'

/* Two apps at one address (#77): a visitor who is not signed in lands on the
   showcase, and the dancer, once connected, on their own library. Which is
   which is the session's to say, so signing in swaps one for the other where
   the dancer is standing. Both link relatively, so neither knows where it is.

   `/demo` was demo mode's address (#33), which a CV could point at; it now
   lands on `/` and finds the showcase there. */
export function Root({
  live = {},
  demo = {},
}: {
  readonly live?: AppProps
  readonly demo?: DemoProps
}) {
  const { status } = useDriveSession()

  return (
    <Routes>
      <Route path="/demo/*" element={<Navigate to="/" replace />} />
      <Route
        path="/*"
        element={isConnected(status) ? <App {...live} /> : <DemoApp {...demo} />}
      />
    </Routes>
  )
}
