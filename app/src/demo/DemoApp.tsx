import { useMemo, useState } from 'react'

import { App } from '../App'
import type { ClipCache, ThumbnailStore } from '../clips/clipCache'
import { thumbnailCacheOver } from '../clips/clipCache'
import { localOpenedStore } from '../clips/openedStore'
import type { ShapeYouTube } from '../clips/youtube'
import type { DriveApi } from '../drive/driveApi'
import { browserDriveApi } from '../drive/driveApi'
import { LOOPS_FILE } from '../loops/driveLoops'
import { localLoopsCache } from '../loops/loopsCache'
import type { MountYouTube } from '../player/youtubeMount'
import { demoDriveApi } from './demoDriveApi'
import demoLoops from './demoLoops.json'
import { DemoSession } from './DemoSession'
import { DEMO_YOUTUBE } from './demoVideos'
import { memoryStorage } from './memoryStorage'

export type DemoProps = {
  readonly urls?: Pick<DriveApi, 'toUrl' | 'releaseUrl'>
  /* #77, #90. Straight through to the player, for `App`'s reason. */
  readonly mountYouTube?: MountYouTube | undefined
  readonly shapeYouTube?: ShapeYouTube | undefined
}

/* Nothing in the showcase has bytes to cache: YouTube plays every video. */
const noClipCache: ClipCache = {
  get: async () => null,
  put: async () => {},
  forget: async () => {},
}

/* Nor stills of its own — the tile shows YouTube's picture — but the grid
   asks for somewhere to keep them, and a visit is as long as it should last. */
const stillsInMemory = (): ThumbnailStore => {
  const held = new Map<string, Blob>()

  return {
    read: async (clipId) => held.get(clipId) ?? null,
    save: async (clipId, bytes) => {
      held.set(clipId, bytes)
    },
    remove: async (clipId) => {
      held.delete(clipId)
    },
  }
}

/* #77. What a visitor who is not signed in lands on: the whole app over seams
   that need no Google account — a snapshot of Thomas's YouTube entries with
   their loops (`demoVideos.ts`, `demoLoops.json`), and a session that always
   has a token without asking Google for one. Nothing in the player knows the
   difference, which is the point: it is the player a visitor has come to try.

   Once demo mode (#33), a page of its own behind a button; now it is what the
   site opens on. `Root` swaps it for the dancer's own library the moment the
   real session is connected.

   Not persistent (#66): what a visitor does here lasts while they stay, and
   is gone the next time they come, so every visit opens on the loops it ships
   with. */
export function DemoApp({
  urls = browserDriveApi,
  mountYouTube,
  shapeYouTube,
}: DemoProps) {
  /* One per visit: made when it mounts, gone when it unmounts. */
  const [kept] = useState(memoryStorage)

  /* Built once. Every hook in the app keys an effect on these, and a fresh
     api each render would re-list the library on every one of them. */
  const seams = useMemo(
    () => ({
      driveApi: demoDriveApi({
        youtube: DEMO_YOUTUBE,
        /* #63. The loops a visitor opens onto. Edit `demoLoops.json` to change
           them; it is `loops.json`'s own shape. */
        bundled: { [LOOPS_FILE]: JSON.stringify(demoLoops) },
        storage: kept,
        toUrl: urls.toUrl,
        releaseUrl: urls.releaseUrl,
      }),
      loopsCache: localLoopsCache(kept),
      openedStore: localOpenedStore(kept),
      thumbnailCache: thumbnailCacheOver(stillsInMemory()),
    }),
    [kept, urls],
  )

  return (
    <DemoSession>
      <App
        {...seams}
        clipCache={noClipCache}
        mountYouTube={mountYouTube}
        shapeYouTube={shapeYouTube}
        demo
      />
    </DemoSession>
  )
}
