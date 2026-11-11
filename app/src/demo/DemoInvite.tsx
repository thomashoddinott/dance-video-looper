import { Link } from 'react-router'

import { useDriveSession } from '../drive/driveSession'
import { isConnected } from '../drive/session'

/* #59. The way into the demo, in the middle of the grid rather than beside
   Connect in the footer, where it went unclicked. With no Drive the grid is
   empty, so this is where a visitor who followed a link from a CV is already
   looking. Offered wherever Connect is, because both answer "no Drive".

   A link rather than a button, as it was in the footer (#33): it goes
   somewhere, and `/demo` is an address a CV can point at directly. */
export function DemoInvite() {
  const { status } = useDriveSession()

  if (isConnected(status)) return null

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Link
        to="/demo"
        className="rounded-2xl bg-accent px-8 py-4 text-lg font-semibold text-on-accent shadow-lg shadow-accent/25 hover:bg-accent-2"
      >
        Demo mode
      </Link>
    </div>
  )
}
