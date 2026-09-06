import { useCallback, useEffect, useRef, useState } from 'react'

import type { DriveApi } from '../drive/driveApi'
import { withdrewConsent } from '../drive/driveErrors'
import { useDriveSession } from '../drive/driveSession'
import { THUMBNAILS_FOLDER } from '../drive/driveThumbnails'
import type { ThumbnailCache } from './clipCache'
import type { ThumbnailCapture } from './thumbnail'

export type ThumbnailsHandle = {
  /* A url per clip that has a still, and no entry at all for one that does
     not — which is the grey placeholder `Poster` already draws. Deliberately
     not a url-or-undefined per clip: the grid asks by id and absence is the
     answer, so there is nothing to distinguish "no still" from "not looked
     yet" *for the tile*, which paints the same either way. */
  readonly urls: Readonly<Record<string, string>>
  /* Make and store the still for a clip that has none, from bytes already in
     hand. Never rejects, and never runs twice for one clip: it is called from
     the player every time a clip is opened, and a clip is opened over and over
     — that is what practice is. */
  readonly capture: (clipId: string, bytes: Blob) => Promise<void>
  /* Lose the still of a clip that has been deleted (#78). Never rejects: by
     the time this runs the clip is already gone from the grid, and failing
     loudly here would report a delete that did work as one that did not. */
  readonly forget: (clipId: string) => Promise<void>
}

/* The stills, above both screens for `useLoops`'s reason: the grid paints them
   and the player makes the ones that are missing, so a second copy read
   separately would be a second copy free to disagree.

   `clipIds` is joined into the effect's dependency rather than depended on
   directly — a new array every render would re-list Drive on every render. */
export const useThumbnails = (
  api: DriveApi,
  cache: ThumbnailCache,
  clipIds: readonly string[],
  capture: ThumbnailCapture,
): ThumbnailsHandle => {
  const { requireToken, reportConsentWithdrawn } = useDriveSession()
  const [urls, setUrls] = useState<Readonly<Record<string, string>>>({})
  /* Which clips Drive already has a still for. A ref rather than state: it is
     read by `capture` at the moment it runs, and state would hand it whatever
     was true in the render its closure was made in — the staleness that would
     let a clip be uploaded a second still. */
  const stored = useRef<Readonly<Record<string, string>>>({})
  /* Every url this hook minted, so the cleanup can let go of exactly those and
     nothing else. Kept beside `urls` rather than read off it because a url
     replaced mid-life — a backfill landing on a tile that had none — must
     still be released. */
  const minted = useRef<readonly string[]>([])

  const keep = useCallback(
    (clipId: string, url: string) => {
      minted.current = [...minted.current, url]
      setUrls((held) => ({ ...held, [clipId]: url }))
    },
    [],
  )

  /* Both folders, in the order they nest. Two `files.list` calls per load
     against holding an id nothing may hold — the folder is re-found every
     session on purpose (`CLIPS_FOLDER`), and #77's subfolder inherits that. */
  const stillsFolder = useCallback(async () => {
    const held = await requireToken()

    if (!held.available) return null

    const clips = await api.findOrCreateFolder(held.value)

    return {
      token: held.value,
      folderId: await api.findOrCreateFolder(
        held.value,
        THUMBNAILS_FOLDER,
        clips,
      ),
    }
  }, [api, requireToken])

  const clips = clipIds.join(' ')

  useEffect(() => {
    let listening = true

    const paint = async () => {
      const wanted = clips === '' ? [] : clips.split(' ')

      /* The cache first, and for every clip, before a token is asked for.
         Criterion 7 is that a still already fetched is served locally, and the
         order is what also makes a studio with no signal paint the tiles this
         device already has. */
      const cached = await Promise.all(
        wanted.map(async (clipId) => ({
          clipId,
          bytes: await cache.get(clipId),
        })),
      )

      if (!listening) return

      cached.forEach(({ clipId, bytes }) => {
        if (bytes !== null) keep(clipId, api.toUrl(bytes))
      })

      const missing = cached
        .filter(({ bytes }) => bytes === null)
        .map(({ clipId }) => clipId)

      /* Nothing to fetch and nothing to learn: asking Drive would be a token,
         two folder lookups and a listing to be told what we already have. */
      if (missing.length === 0) return

      try {
        const reached = await stillsFolder()

        if (reached === null) return

        const listed = await api.listThumbnails(reached.token, reached.folderId)

        if (!listening) return

        stored.current = listed

        await Promise.all(
          missing.map(async (clipId) => {
            const driveId = listed[clipId]

            /* A clip uploaded before #77, or one whose still never landed. The
               tile stays grey until its bytes are next in hand — it must not
               become a download of the nine-megabyte clip, which is the cost
               this whole ticket exists to avoid. */
            if (driveId === undefined) return

            const bytes = await api.download(reached.token, driveId)

            await cache.put(clipId, bytes)

            if (listening) keep(clipId, api.toUrl(bytes))
          }),
        )
      } catch (error) {
        if (withdrewConsent(error)) reportConsentWithdrawn()

        /* Whatever was served from the cache above stays on screen. A grid that
           threw away the stills it has because Drive had a bad minute would be
           strictly worse than one that simply learned nothing new. */
      }
    }

    void paint()

    return () => {
      listening = false
    }
  }, [api, cache, clips, keep, reportConsentWithdrawn, stillsFolder])

  useEffect(
    () => () => {
      minted.current.forEach((url) => {
        api.releaseUrl(url)
      })
    },
    [api],
  )

  const captureFor = useCallback(
    async (clipId: string, bytes: Blob) => {
      /* Criterion 5's guard. The player calls this on every open, so without it
         a clip practised for an hour would leave an hour of identical stills in
         the dancer's Drive. */
      if (stored.current[clipId] !== undefined) return

      try {
        const still = await capture(bytes)

        /* A clip that will not yield a frame. Criterion 4: a grey tile, never
           a failure. Not recorded as attempted, deliberately — the next open
           tries again, which costs a local decode and is the right trade for a
           failure that may have been the browser being busy rather than the
           clip being undecodable. */
        if (still === null) return

        const reached = await stillsFolder()

        if (reached === null) return

        const file = await api.uploadThumbnail(reached.token, {
          bytes: still,
          clipId,
          folderId: reached.folderId,
        })

        stored.current = { ...stored.current, [clipId]: file.id }

        await cache.put(clipId, still)

        keep(clipId, api.toUrl(still))
      } catch (error) {
        if (withdrewConsent(error)) reportConsentWithdrawn()

        /* Nothing to say. The clip plays either way, and the caller is the
           player mid-download, which has no place to put this. */
      }
    },
    [api, cache, capture, keep, reportConsentWithdrawn, stillsFolder],
  )

  const forget = useCallback(
    async (clipId: string) => {
      const driveId = stored.current[clipId]

      /* Both sides, and the local one first: a still left in the cache would be
         handed straight to a tile if the same file were ever added again,
         showing a frame from the clip that was thrown away. */
      await cache.forget(clipId)

      stored.current = Object.fromEntries(
        Object.entries(stored.current).filter(([held]) => held !== clipId),
      )
      setUrls((held) =>
        Object.fromEntries(
          Object.entries(held).filter(([id]) => id !== clipId),
        ),
      )

      /* Nothing to trash for a clip whose still never reached Drive — every
         clip added before #77 that has not been opened since. */
      if (driveId === undefined) return

      try {
        const reached = await stillsFolder()

        if (reached === null) return

        await api.trash(reached.token, driveId)
      } catch (error) {
        if (withdrewConsent(error)) reportConsentWithdrawn()

        /* A still orphaned in Drive is thirty kilobytes of the dancer's quota
           and nothing else. The clip itself is already gone. */
      }
    },
    [api, cache, reportConsentWithdrawn, stillsFolder],
  )

  return { urls, capture: captureFor, forget }
}
