import { Link } from 'react-router'

import { useDriveSession } from '../drive/driveSession'

/* The demo's answer to `DriveStatus`, and where it sits: under the heading
   rather than in the footer, because the first thing a visitor should know is
   that this is a sample and not someone's library.

   Named, since a `status` region is what it is and `DriveStatus` owns the
   unnamed one on the live screen. Connect is the real sign-in — the session
   inside the demo passes it straight through — and signing in is what ends
   the demo. */
export function DemoStatus() {
  const { signIn } = useDriveSession()

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p role="status" aria-label="Demo" className="text-xs text-ink/60">
        Demo mode — a sample clip to try the player on. Loops you save stay in
        this browser.
      </p>

      <button
        type="button"
        onClick={signIn}
        className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
      >
        Connect Google Drive
      </button>

      <Link
        to="/"
        className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
      >
        Exit demo
      </Link>
    </div>
  )
}
