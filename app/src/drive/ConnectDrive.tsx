import { useDriveSession } from './driveSession'
import { isConnected } from './session'

/* #83. At the top of the dashboard beside the source link, where a visitor
   meets it before scrolling through the showcase. Gone once Drive is
   connected: there is nothing left to connect.

   #88. The only sign of Drive on the screen. Whether the dancer is connected
   shows in this being there or not, and no sentence narrates it — not a
   refusal, a withdrawal, Google being unreachable or a renewal. Show, don't
   tell. A withdrawal or a lapse puts it back, which is the whole of what the
   dancer can do about either. */
export function ConnectDrive() {
  const { status, signIn } = useDriveSession()

  if (isConnected(status)) return null

  return (
    <button
      type="button"
      onClick={signIn}
      className="rounded-lg bg-control px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-control-hi"
    >
      Connect Google Drive
    </button>
  )
}
