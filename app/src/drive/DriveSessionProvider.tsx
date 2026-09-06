import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { DriveSessionContext } from './driveSession'
import type { TokenSource } from './gisTokenSource'
import {
  consentWithdrawn,
  resume,
  signedOut,
  statusOf,
  tokenFor,
  tokenFrom,
  unavailable,
  type Session,
  type TokenLookup,
} from './session'
import type { TokenStore } from './tokenStore'

/* The clock is read when the session changes, never while rendering. Reading it
   during render makes the same render produce different output on a re-render
   for no reason the dancer caused, and nothing here needs that: expiry only
   matters at the moment something asks for a token, and that path reads a live
   clock of its own. */
type Snapshot = {
  readonly session: Session
  readonly checkedAt: number
}

const START = { session: signedOut, checkedAt: 0 } satisfies Snapshot

type Props = {
  readonly tokenSource: TokenSource
  readonly tokenStore: TokenStore
  readonly children: ReactNode
}

export const DriveSessionProvider = ({
  tokenSource,
  tokenStore,
  children,
}: Props) => {
  /* Read once, when the state is created, rather than in an effect. An effect
     would mean a first paint saying "Not connected to Drive" and a second
     correcting it — a visible flicker, and a cascading render. */
  const [snapshot, setSnapshot] = useState<Snapshot>(() => {
    const kept = tokenStore.read()

    return kept === null
      ? START
      : { session: resume(kept), checkedAt: Date.now() }
  })
  const [renewed, setRenewed] = useState(false)

  const acquire = useCallback(async (): Promise<Session> => {
    const result = await tokenSource()
    const checkedAt = Date.now()

    if (!result.ok) {
      tokenStore.clear()

      const refused = unavailable(result.because)
      setSnapshot({ session: refused, checkedAt })

      return refused
    }

    const token = tokenFrom(result.grant, checkedAt)
    tokenStore.write(token)

    const session = resume(token)
    setSnapshot({ session, checkedAt })

    return session
  }, [tokenSource, tokenStore])

  const signIn = useCallback(async () => {
    setRenewed(false)
    await acquire()
  }, [acquire])

  /* AC 4 lives here. Renewal is reached only through this call — the thing the
     dancer just asked for — so the popup Google flashes is attributable to a tap
     rather than arriving unbidden mid-move. There is deliberately no timer
     anywhere in this file. */
  const requireToken = useCallback(async (): Promise<TokenLookup> => {
    const held = tokenFor(snapshot.session, Date.now())

    if (held.available || held.because !== 'expired') return held

    const renewal = await acquire()

    /* Only a renewal that produced a token is worth announcing — a failed one
       has already changed the status to say what went wrong instead. */
    setRenewed(renewal.kind === 'holding')

    return tokenFor(renewal, Date.now())
  }, [snapshot.session, acquire])

  /* Forget the token as well as the state. A withdrawn grant makes the kept
     token dead, and resuming it next visit would report Drive connected and
     then fail on the first call. */
  const reportConsentWithdrawn = useCallback(() => {
    tokenStore.clear()
    setSnapshot({ session: consentWithdrawn, checkedAt: Date.now() })
  }, [tokenStore])

  const value = useMemo(
    () => ({
      status: statusOf(snapshot.session, snapshot.checkedAt),
      renewed,
      signIn,
      requireToken,
      reportConsentWithdrawn,
    }),
    [snapshot, renewed, signIn, requireToken, reportConsentWithdrawn],
  )

  return (
    <DriveSessionContext value={value}>{children}</DriveSessionContext>
  )
}
