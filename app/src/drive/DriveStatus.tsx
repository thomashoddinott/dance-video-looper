import { useDriveSession } from './driveSession'
import type { SessionStatus } from './session'

/* A refusal and a withdrawal both end with no Drive, and saying so in one
   sentence would have been easier — but the dancer can act on the difference.
   One they chose a moment ago; the other happened in Google's account settings,
   possibly weeks ago, and reads as the app breaking if it is not named.

   `expired` deliberately reads as connected. Consent still stands and the next
   thing needing Drive renews it, so telling the dancer about a lapsed token
   would be reporting our bookkeeping rather than their situation. */
const NOTICES: Record<SessionStatus, string> = {
  'signed-out': 'Not connected to Drive.',
  active: 'Drive is connected.',
  expired: 'Drive is connected.',
  'consent-refused':
    'Drive is unavailable — you declined access, so clips and saved loops will not sync.',
  'consent-withdrawn':
    'Drive is unavailable — access was removed from your Google account, so clips and saved loops will not sync.',
  'drive-unreachable':
    'Drive is unavailable — Google sign-in is not available right now, so clips and saved loops will not sync.',
  /* Only reachable in a build nobody configured, so it is written for whoever
     has to fix it rather than for a dancer. */
  'drive-not-configured':
    'Drive is not set up — this build has no Google Client ID. See app/.env.example.',
}

const CONNECTED: readonly SessionStatus[] = ['active', 'expired']

/* The popup Google opens on renewal is unavoidable without a backend. With a
   standing grant it skips the consent screen but still shows the account
   chooser and waits to be clicked, so the dancer is interrupted and has no idea
   what for. Naming it is the whole of AC 5. */
const RENEWED = 'Your Drive session was renewed.'

export function DriveStatus() {
  const { status, renewed, signIn } = useDriveSession()
  const connected = CONNECTED.includes(status)

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p role="status" className="text-xs text-ink/40">
        {renewed && connected ? `${NOTICES[status]} ${RENEWED}` : NOTICES[status]}
      </p>

      {!connected && (
        <button
          type="button"
          onClick={signIn}
          className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
        >
          Connect Google Drive
        </button>
      )}
    </div>
  )
}
