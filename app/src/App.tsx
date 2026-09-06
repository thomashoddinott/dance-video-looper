import { useCallback } from 'react'
import { Route, Routes } from 'react-router'

import type { Clip } from './clips/clip'
import type { ClipCache, ThumbnailCache } from './clips/clipCache'
import { browserClipCache, browserThumbnailCache } from './clips/clipCache'
import type { ClipProbe } from './clips/clipProbe'
import { browserClipProbe } from './clips/clipProbe'
import { ClipsScreen } from './clips/ClipsScreen'
import { withLoopCounts, withPractised } from './clips/library'
import type { ThumbnailCapture } from './clips/thumbnail'
import { browserThumbnailCapture } from './clips/thumbnail'
import { useLibrary } from './clips/useLibrary'
import { useThumbnails } from './clips/useThumbnails'
import type { DriveApi } from './drive/driveApi'
import { browserDriveApi } from './drive/driveApi'
import { countOf, practisedAt } from './loops/loopsChange'
import type { LoopsCache } from './loops/loopsCache'
import { browserLoopsCache } from './loops/loopsCache'
import { useLoops } from './loops/useLoops'
import { PlayerScreen } from './player/PlayerScreen'

/* The library lives above the routes rather than beside either of them. Both
   screens read the same list, so a clip added on one is openable on the other
   without a reload — which it could not be while each route held its own
   reference to a module constant.

   It is Drive's library now: there is no seeded array anywhere, so an empty
   grid means the dancer has uploaded nothing (or has not connected), which is
   UC-01 alternate flow 2a rather than a gap. */
export function App({
  probe = browserClipProbe,
  driveApi = browserDriveApi,
  clipCache = browserClipCache,
  loopsCache = browserLoopsCache,
  thumbnailCache = browserThumbnailCache,
  capture = browserThumbnailCapture,
}: {
  readonly probe?: ClipProbe
  readonly driveApi?: DriveApi
  readonly clipCache?: ClipCache
  readonly loopsCache?: LoopsCache
  readonly thumbnailCache?: ThumbnailCache
  readonly capture?: ThumbnailCapture
} = {}) {
  /* The cache goes in as well as down to the player: a deleted clip's bytes are
     budget held against something that is not coming back, and this is the only
     place that holds both the library and the cache. */
  const { library, notice, add, remove } = useLibrary(driveApi, {
    cache: clipCache,
  })
  /* Beside the library rather than inside the player, because both screens
     read them: the player lists a clip's loops, and the Clips screen puts the
     count in each tile and orders by it under **Most looped**. One `loops.json`
     holds every clip's, so there is one place to read it from (US-01-15). */
  const loops = useLoops(driveApi, loopsCache)
  /* The clips as the grid draws them: counts, and when each was last practised
     (#12). All of it arrives separately — Drive's file listing knows nothing
     about loops, and `loops.json` is fetched on its own — so this is where they
     are put together, once, for both screens. */
  const counted = withPractised(
    withLoopCounts(library, (clipId) => countOf(loops.loops, clipId)),
    (clipId) => practisedAt(loops.loops, clipId),
  )
  /* Beside the loops, and above both routes for the same reason: the grid
     paints the stills and the player makes the ones that are missing, so a
     second copy read separately would be free to disagree with this one. */
  const {
    urls: stills,
    capture: captureStill,
    forget: forgetStill,
  } = useThumbnails(
    driveApi,
    thumbnailCache,
    counted.clips.map((clip) => clip.id),
    capture,
  )

  /* Stable, and that is load-bearing rather than tidiness: `useClipSource`
     depends on this to decide whether to fetch, so a fresh arrow every render
     would re-run the effect and re-download a nine-megabyte clip on each one. */
  /* The still goes with the clip. Fired alongside the delete rather than after
     it, because `remove` reports failure through the library's own notice and
     has no success to hand back — and being wrong costs one grey tile on a
     clip that survived, which the backfill puts right the next time it is
     opened. */
  const onDelete = (clip: Clip) => {
    void remove(clip)
    void forgetStill(clip.id)
  }

  const onClipBytes = useCallback(
    (clipId: string, bytes: Blob) => {
      void captureStill(clipId, bytes)
    },
    [captureStill],
  )

  /* The still is captured from the file the dancer picked rather than from the
     re-encode that goes up, and starts the moment the clip does. It is the same
     footage, it is already in hand, and not waiting on a ~13 s upload is what
     puts a frame on the tile while they are still looking at it.

     Nothing awaits it. A still is a convenience and the clip is what was asked
     for, so criterion 4 — a failure leaves a grey tile, never a failed add —
     falls out of the two being independent rather than out of a catch. */
  const onAdd = (clip: Clip, file: File, seconds: number) => {
    void add(clip, file, seconds)
    void captureStill(clip.id, file)
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ClipsScreen
            library={counted}
            thumbnails={stills}
            onAdd={onAdd}
            onDelete={onDelete}
            probe={probe}
            notice={notice}
          />
        }
      />
      <Route
        path="/clip/:clipId"
        element={
          <PlayerScreen
            clips={counted.clips}
            loops={loops}
            driveApi={driveApi}
            clipCache={clipCache}
            onBytes={onClipBytes}
            stillLoading={library.state === 'loading'}
          />
        }
      />
    </Routes>
  )
}
