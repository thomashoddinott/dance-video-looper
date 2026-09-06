import { useCallback, useEffect, useState } from 'react'

import type { DriveApi } from '../drive/driveApi'
import { useDriveSession } from '../drive/driveSession'
import { withdrewConsent } from '../drive/driveErrors'
import type { Clip } from './clip'
import type { ClipCache } from './clipCache'
import { browserClipCache } from './clipCache'
import type { ClipCompressor } from './clipCompressor'
import { browserClipCompressor } from './mediabunnyHost'
import type { Library } from './library'
import {
  abandoned,
  adding,
  deleted,
  failed,
  LOADING,
  loaded,
  progressed,
  stored,
} from './library'

export type LibraryHandle = {
  readonly library: Library
  /* What to tell the dancer about the last thing that went wrong at the Drive
     end. The screen's own notices — a duplicate, a file that would not
     decode — stay with the screen (US-01-04); this is only for the failures
     that happen after the tile is already there. */
  readonly notice: string | null
  readonly status: ReturnType<typeof useDriveSession>['status']
  readonly add: (clip: Clip, file: File, seconds: number) => Promise<void>
  /* The whole clip rather than its id, because a delete needs three different
     things off it — the `driveId` to trash, the `id` the cache is keyed on, and
     the `name` to put in the sentence if it fails. */
  readonly remove: (clip: Clip) => Promise<void>
}

export const useLibrary = (
  api: DriveApi,
  {
    cache = browserClipCache,
    compress = browserClipCompressor,
  }: {
    readonly cache?: ClipCache
    readonly compress?: ClipCompressor
  } = {},
): LibraryHandle => {
  const { status, requireToken, reportConsentWithdrawn } = useDriveSession()
  const [library, setLibrary] = useState<Library>(LOADING)
  const [notice, setNotice] = useState<string | null>(null)

  /* Every Drive call goes through here, and none of them keeps the result. The
     session retires a token 30 seconds early on purpose, so a held copy is the
     one thing that reintroduces a mid-flight 401 — and on this story that
     matters more than on any before it, because a 13-second upload is long
     enough to straddle an expiry. */
  const folderToken = useCallback(async () => {
    const held = await requireToken()

    if (!held.available) return null

    return { token: held.value, folderId: await api.findOrCreateFolder(held.value) }
  }, [api, requireToken])

  /* A 401 is the dancer having revoked access in their Google account — the
     session's skew rules out an expiry arriving as one — and `DriveStatus`
     already has a sentence for it. Anything else is left to the caller. */
  const reportIfWithdrawn = useCallback(
    (error: unknown) => {
      if (withdrewConsent(error)) reportConsentWithdrawn()
    },
    [reportConsentWithdrawn],
  )

  useEffect(() => {
    let listening = true

    const read = async () => {
      try {
        const reached = await folderToken()

        /* Not connected is not a failure. Nothing has been uploaded because
           nothing could have been, so an empty grid is the honest answer and
           alternate flow 2a is what the screen already shows for it. */
        if (reached === null) {
          if (listening) setLibrary((held) => loaded(held, []))

          return
        }

        const clips = await api.listClips(reached.token, reached.folderId)

        if (listening) setLibrary((held) => loaded(held, clips))
      } catch (error) {
        reportIfWithdrawn(error)

        if (listening) setLibrary(failed)
      }
    }

    void read()

    return () => {
      listening = false
    }
  }, [api, folderToken, reportIfWithdrawn, status])

  const add = useCallback(
    async (clip: Clip, file: File, seconds: number) => {
      /* In the grid first, and playable from the local file while the bytes go
         up. The alternative was a thirteen-second wait on an empty screen. */
      setLibrary((held) => adding(held, clip))
      setNotice(null)

      try {
        const reached = await folderToken()

        if (reached === null) throw new Error('no Drive to upload to')

        /* Practice quality, so the quota holds a library rather than a handful
           of clips. Roughly five seconds on a two-minute clip, and every one of
           them is behind the tile: it went into the grid above and is already
           playing from the local file, so nothing the dancer can see is waiting
           on this. The progress bar sits at 0% throughout, which is accepted —
           a "compressing…" state would be the UI this story exists without.

           It never rejects. A clip that cannot be compressed here, or that
           encodes larger than it started, comes back as the file that went in
           and goes up untouched. */
        const bytes = await compress(file)

        const file_ = await api.upload(reached.token, {
          file: bytes,
          /* The picked file's id, not the sent file's. `bytes` may be a
             re-encode with a different name and size, and the clip has to come
             back from Drive as the one the tile was built for. */
          clipId: clip.id,
          seconds,
          folderId: reached.folderId,
          onProgress: (sent, total) => {
            setLibrary((held) => progressed(held, clip.id, sent, total))
          },
        })

        setLibrary((held) => stored(held, clip.id, file_.id))
      } catch (error) {
        reportIfWithdrawn(error)

        /* The tile is already on screen, so this takes it back — the cost the
           approval gate accepted when it put the tile first. Naming the clip is
           what makes that survivable: the dancer knows which one to add again. */
        setLibrary((held) => abandoned(held, clip.id))
        setNotice(`${clip.name} could not be saved to Drive, so it was not added.`)
      }
    },
    [api, compress, folderToken, reportIfWithdrawn],
  )

  /* The mirror image of `add`, and deliberately so. That one puts the tile up
     before a byte has gone because it is covering thirteen seconds of upload;
     this waits for Drive because it is covering about two hundred milliseconds
     of metadata patch — and the one thing it must never do is leave the grid
     showing a library the dancer's Drive disagrees with. Q-03 settled the same
     trade for loop writes.

     Cache first, then Drive, then the tile, so no failure leaves the screen
     lying. A cache that would not clear has changed nothing yet. A trash Drive
     refuses has cost one re-download of a clip that is still right there. The
     other two orderings each have a moment where the grid and Drive disagree
     and the dancer is the one who finds out. */
  const remove = useCallback(
    async (clip: Clip) => {
      setNotice(null)

      try {
        await cache.forget(clip.id)

        /* No `driveId` is a clip whose upload never landed, so there is no file
           to ask Drive about — and `files/undefined` is the quiet way to turn
           that into a 404 the dancer reads as a delete that failed. */
        if (clip.driveId !== undefined) {
          const reached = await folderToken()

          if (reached === null) throw new Error('no Drive to delete from')

          await api.trash(reached.token, clip.driveId)
        }

        setLibrary((held) => deleted(held, clip.id))
      } catch (error) {
        reportIfWithdrawn(error)

        setNotice(
          `${clip.name} could not be deleted from Drive, so it is still in your library.`,
        )
      }
    },
    [api, cache, folderToken, reportIfWithdrawn],
  )

  return { library, notice, status, add, remove }
}
