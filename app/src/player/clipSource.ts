import { useEffect, useState } from 'react'

import type { Clip } from '../clips/clip'
import type { ClipCache } from '../clips/clipCache'
import type { DriveApi } from '../drive/driveApi'
import { withdrewConsent } from '../drive/driveErrors'
import { useDriveSession } from '../drive/driveSession'

export type ClipSource = {
  readonly src: string | undefined
  readonly fetching: boolean
  readonly unreachable: boolean
  /* How far along, 0 to 1 — the same shape `Library.uploading` uses for the
     other direction. Undefined means "no fraction to give", which covers both
     the moment before the first byte and a Drive that would not say how big the
     clip is. It is deliberately not zero: a bar stuck at nothing reads as a
     download that has stalled. */
  readonly progress: number | undefined
}

/* Where a clip's bytes come from, which is one of three places and never more
   than one at a time:

     the local file  it was added in this session, and the url is already held
     the cache       this device has fetched it before (US-01-16)
     Drive           neither of the above, so ~7 s for 9 MB, once

   The local file comes first because re-fetching what was just uploaded would
   be strictly worse than keeping the url in hand. The cache comes next, and
   crucially *before* the token — see below. Drive is the last resort, and the
   only one of the three that costs anything. */
/* Stale only when both sides can be compared *and* they disagree. An unknown
   checksum on either side means "nothing to compare", never "changed" — and the
   difference is nine megabytes: a clip whose listing never arrived carries no
   checksum at all, so reading that as "may have moved on" would re-download
   every clip on every open in a studio with no signal, which is precisely the
   condition the cache exists for. */
const movedOn = (cached: string | undefined, inDrive: string | undefined) =>
  cached !== undefined && inDrive !== undefined && cached !== inDrive

export const useClipSource = (
  clip: Clip | undefined,
  api: DriveApi,
  cache: ClipCache,
  /* Called once with the bytes, however they arrived — #77's backfill. Every
     clip uploaded before that ticket has no still, and making one needs
     exactly these bytes, which have just been fetched or read from the cache
     to play the clip. Handing them over is what lets the library heal itself
     without downloading it wholesale.

     Not called for a clip playing from its own local file: nothing was
     fetched, and its still was captured at the add. */
  onBytes?: (bytes: Blob) => void,
): ClipSource => {
  const { requireToken, reportConsentWithdrawn } = useDriveSession()
  const [fetched, setFetched] = useState<string | undefined>(undefined)
  const [unreachable, setUnreachable] = useState(false)
  const [progress, setProgress] = useState<number | undefined>(undefined)

  const held = clip?.src
  const driveId = clip?.driveId
  const clipId = clip?.id
  const checksum = clip?.checksum
  const wanted = held === undefined && driveId !== undefined

  useEffect(() => {
    if (!wanted || driveId === undefined || clipId === undefined) return

    let listening = true
    let minted: string | undefined

    /* One place mints, whichever way the bytes arrived, and it asks first
       whether anyone is still watching — see `download`'s note below. */
    const play = (bytes: Blob) => {
      if (!listening) return

      const url = api.toUrl(bytes)

      minted = url

      setFetched(url)
      onBytes?.(bytes)
    }

    const fetch = async () => {
      try {
        /* The cache is asked **before** the token, and the order is the whole
           story rather than an optimisation. `requireToken` renews an expired
           token through Google's sign-in popup, so asking it first would flash
           a window mid-move for bytes already on the device — and would fail
           outright in a studio with no signal, where the renewal cannot
           complete. Asking the cache first is what makes speed, offline and
           no-popup one decision instead of three. */
        /* A cache that cannot be read at all — a private window, storage the
           browser has locked — is a reason to go to Drive, not a reason to give
           up on the clip. */
        const cached = await cache.get(clipId).catch(() => null)

        if (cached !== null && !movedOn(cached.checksum, checksum)) {
          play(cached.bytes)

          return
        }

        const token = await requireToken()

        if (!token.available) {
          if (listening) setUnreachable(true)

          return
        }

        /* A total of zero is Drive declining to say how big the file is, not a
           file of no size — `Content-Length` is readable in practice, but a
           fraction computed from a missing one would be a lie rather than a
           gap. */
        const bytes = await api.download(
          token.value,
          driveId,
          (loaded, total) => {
            if (listening && total > 0) setProgress(loaded / total)
          },
        )

        /* `play` asks whether anyone is still watching before it mints: a
           download takes seven seconds, which is long enough to open a clip and
           change your mind, and a url minted for a player that has already gone
           is one nothing holds and nothing can release. */
        play(bytes)

        /* Best-effort, and deliberately after the clip is already on screen. A
           cache that will not take the bytes — a full quota, a private window,
           storage just evicted — makes the *next* open slow, and must not turn
           this one into a clip that could not be played. Kept even when nobody
           is watching any more: the seven seconds have already been paid. */
        try {
          await cache.put(clipId, bytes, checksum)
        } catch {
          /* the next open pays for it */
        }
      } catch (error) {
        if (withdrewConsent(error)) reportConsentWithdrawn()

        if (listening) setUnreachable(true)
      }
    }

    void fetch()

    /* Nine megabytes a time, so a url left behind is not a rounding error —
       and caching the bytes does not make the urls over them free. Only ever
       released if this hook is what minted it: the local file's url belongs to
       the add flow, and releasing it here would break the tile still showing. */
    return () => {
      listening = false

      if (minted !== undefined) api.releaseUrl(minted)
    }
  }, [
    api,
    cache,
    checksum,
    clipId,
    driveId,
    onBytes,
    wanted,
    requireToken,
    reportConsentWithdrawn,
  ])

  return {
    src: held ?? fetched,
    fetching: wanted && fetched === undefined && !unreachable,
    unreachable,
    progress,
  }
}
