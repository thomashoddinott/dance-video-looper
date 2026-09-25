import { useMemo } from 'react'
import { Navigate } from 'react-router'

import { App } from '../App'
import type { ClipCache, ThumbnailStore } from '../clips/clipCache'
import { thumbnailCacheOver } from '../clips/clipCache'
import { localOpenedStore } from '../clips/openedStore'
import type { ThumbnailCapture } from '../clips/thumbnail'
import { browserThumbnailCapture } from '../clips/thumbnail'
import type { DriveApi } from '../drive/driveApi'
import { browserDriveApi } from '../drive/driveApi'
import { useDriveSession } from '../drive/driveSession'
import { isConnected } from '../drive/session'
import type { KeyValueStorage } from '../drive/tokenStore'
import { localLoopsCache } from '../loops/loopsCache'
import { DEMO_CLIP } from './demoClip'
import { demoDriveApi } from './demoDriveApi'
import { DemoSession } from './DemoSession'
import { prefixedStorage } from './prefixedStorage'

/* Every key the demo writes starts with this, so nothing it keeps can be read
   back as the dancer's own. */
export const DEMO_PREFIX = 'looper.demo.'

export type DemoProps = {
  readonly storage?: KeyValueStorage
  readonly fetchBytes?: (url: string) => Promise<Blob>
  readonly capture?: ThumbnailCapture
  readonly urls?: Pick<DriveApi, 'toUrl' | 'releaseUrl'>
}

/* Wrapped rather than handed over whole, so importing this module never
   touches the global — the care `browserLoopsCache` takes, for its reason. */
const browserStorage: KeyValueStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => {
    localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    localStorage.removeItem(key)
  },
}

const fetchOverNetwork = async (url: string) => {
  const response = await fetch(url)

  if (!response.ok) throw new Error(`the demo clip did not load: ${response.status}`)

  return response.blob()
}

/* The clip is same-origin and a megabyte, so the browser's own HTTP cache is
   all the caching it needs — and the real clip cache is the dancer's, which
   a visitor's bytes have no business taking budget from. */
const noClipCache: ClipCache = {
  get: async () => null,
  put: async () => {},
  forget: async () => {},
}

/* The still lasts the visit. It is captured from the clip in a moment, so
   keeping it any longer would be storage spent to save a local decode. */
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

/* #33. The whole app, at `/demo`, over seams that need no Google account: one
   bundled clip, loops kept in this browser under a prefix of their own, and a
   session that always has a token without asking Google for one. Nothing in
   the player knows the difference, which is the point — it is the player a
   visitor has come to try.

   Signing in is how a visitor leaves: the moment the real session is
   connected, this hands over to the dancer's own library. */
export function DemoApp({
  storage = browserStorage,
  fetchBytes = fetchOverNetwork,
  capture = browserThumbnailCapture,
  urls = browserDriveApi,
}: DemoProps) {
  const { status } = useDriveSession()

  /* Built once. Every hook in the app keys an effect on these, and a fresh
     api each render would re-list the library and re-fetch the clip on every
     one of them. */
  const seams = useMemo(() => {
    const kept = prefixedStorage(storage, DEMO_PREFIX)

    return {
      driveApi: demoDriveApi({
        clip: DEMO_CLIP,
        storage: kept,
        fetchBytes,
        capture,
        toUrl: urls.toUrl,
        releaseUrl: urls.releaseUrl,
      }),
      loopsCache: localLoopsCache(kept),
      openedStore: localOpenedStore(kept),
      thumbnailCache: thumbnailCacheOver(stillsInMemory()),
    }
  }, [storage, fetchBytes, capture, urls])

  if (isConnected(status)) return <Navigate to="/" replace />

  return (
    <DemoSession>
      <App {...seams} clipCache={noClipCache} capture={capture} demo />
    </DemoSession>
  )
}
