import { describe, expect, it, vi } from 'vitest'

import { inMemoryStorage } from '../drive/keyValueStorage.factory'
import { getLoop } from '../loops/loop.factory'
import { applyToLoops, readLoops } from '../loops/driveLoops'
import { withLoop } from '../loops/loopsChange'
import type { DemoClip } from './demoDriveApi'
import { demoDriveApi } from './demoDriveApi'

const A_TOKEN = 'demo'

const theDemoClip: DemoClip = {
  id: 'demo-clip',
  name: 'Passitos',
  added: '2026-09-25',
  seconds: 16.8,
  url: '/assets/demo-clip.mp4',
}

const clipBytes = new Blob([new Uint8Array(12)], { type: 'video/mp4' })
const aStill = new Blob([new Uint8Array(3)], { type: 'image/jpeg' })

const aDemoApi = ({
  storage = inMemoryStorage(),
  fetchBytes = vi.fn(async () => clipBytes),
  capture = vi.fn(async (_bytes: Blob): Promise<Blob | null> => aStill),
} = {}) =>
  demoDriveApi({
    clip: theDemoClip,
    storage,
    fetchBytes,
    capture,
    toUrl: () => 'blob:demo',
    releaseUrl: () => {},
  })

const folderOf = (api: ReturnType<typeof aDemoApi>) =>
  api.findOrCreateFolder(A_TOKEN)

describe('the demo library', () => {
  it('holds exactly the one bundled clip', async () => {
    const api = aDemoApi()

    const clips = await api.listClips(A_TOKEN, await folderOf(api))

    expect(clips).toHaveLength(1)
    expect(clips[0]).toMatchObject({
      id: 'demo-clip',
      name: 'Passitos',
      added: '2026-09-25',
      seconds: 16.8,
      loops: 0,
    })
  })

  /* The player plays a clip by downloading it and minting a url, so the demo
     clip has to be addressable the way a Drive clip is — which is also what
     keeps the player's code the same in both modes. */
  it('plays the bundled clip through a download, as a Drive clip plays', async () => {
    const fetchBytes = vi.fn(async () => clipBytes)
    const api = aDemoApi({ fetchBytes })
    const [clip] = await api.listClips(A_TOKEN, await folderOf(api))

    const bytes = await api.download(A_TOKEN, clip?.driveId ?? '')

    expect(fetchBytes).toHaveBeenCalledWith('/assets/demo-clip.mp4')
    expect(bytes).toBe(clipBytes)
  })

  it('has nothing else to download', async () => {
    await expect(aDemoApi().download(A_TOKEN, 'someone-elses-file')).rejects.toThrow()
  })

  /* Read-only, because the gallery is: a visitor sees one clip and practises
     on it. Nothing may pretend to have stored a clip it has nowhere to put. */
  it('keeps no clip a visitor tries to add', async () => {
    const api = aDemoApi()

    await expect(
      api.upload(A_TOKEN, {
        file: new File([clipBytes], 'mine.mp4'),
        clipId: 'mine',
        seconds: 3,
        folderId: await folderOf(api),
        onProgress: () => {},
      }),
    ).rejects.toThrow()
  })

  it('deletes nothing', async () => {
    await expect(aDemoApi().trash(A_TOKEN, 'demo-clip')).rejects.toThrow()
  })
})

/* A grey tile is the first thing a visitor would see, so the still is made
   from the clip itself rather than shipped beside it — which also means a new
   demo clip can never be paired with a still from the old one. */
describe('the demo clip’s still', () => {
  it('is listed for the demo clip', async () => {
    const api = aDemoApi()

    const stills = await api.listThumbnails(A_TOKEN, await folderOf(api))

    expect(Object.keys(stills)).toEqual(['demo-clip'])
  })

  it('is a frame captured from the bundled clip', async () => {
    const capture = vi.fn(async (_bytes: Blob): Promise<Blob | null> => aStill)
    const api = aDemoApi({ capture })
    const stills = await api.listThumbnails(A_TOKEN, await folderOf(api))

    const still = await api.download(A_TOKEN, stills['demo-clip'] ?? '')

    expect(capture).toHaveBeenCalledWith(clipBytes)
    expect(still).toBe(aStill)
  })

  it('fails, leaving the tile grey, when no frame can be captured', async () => {
    const api = aDemoApi({ capture: vi.fn(async () => null) })
    const stills = await api.listThumbnails(A_TOKEN, await folderOf(api))

    await expect(api.download(A_TOKEN, stills['demo-clip'] ?? '')).rejects.toThrow()
  })
})

/* The loops go through the same read-apply-write path they take to Drive, so
   everything the player does with them — save, correct, remove — works in the
   demo without a line of it knowing. */
describe('the demo’s saved loops', () => {
  it('start empty', async () => {
    const api = aDemoApi()

    expect(await readLoops(api, A_TOKEN, await folderOf(api))).toMatchObject({
      readable: true,
      loops: { clips: {} },
    })
  })

  it('give back a loop that was saved', async () => {
    const api = aDemoApi()
    const folder = await folderOf(api)

    await applyToLoops(api, A_TOKEN, folder, (held) =>
      withLoop(held, 'demo-clip', getLoop({ id: 'the-hard-bit' })),
    )

    expect(await readLoops(api, A_TOKEN, folder)).toMatchObject({
      loops: { clips: { 'demo-clip': [{ id: 'the-hard-bit' }] } },
    })
  })

  /* A reload builds the whole app again, and a fresh api with it. The loops
     survive it because they live in the storage, not in the api. */
  it('are still there for a fresh demo over the same storage', async () => {
    const storage = inMemoryStorage()
    const before = aDemoApi({ storage })

    await applyToLoops(before, A_TOKEN, await folderOf(before), (held) =>
      withLoop(held, 'demo-clip', getLoop({ id: 'the-hard-bit' })),
    )

    const after = aDemoApi({ storage })

    expect(await readLoops(after, A_TOKEN, await folderOf(after))).toMatchObject({
      loops: { clips: { 'demo-clip': [{ id: 'the-hard-bit' }] } },
    })
  })

  it('keep every loop across successive saves', async () => {
    const api = aDemoApi()
    const folder = await folderOf(api)

    await applyToLoops(api, A_TOKEN, folder, (held) =>
      withLoop(held, 'demo-clip', getLoop({ id: 'first' })),
    )
    await applyToLoops(api, A_TOKEN, folder, (held) =>
      withLoop(held, 'demo-clip', getLoop({ id: 'second' })),
    )

    expect(await readLoops(api, A_TOKEN, folder)).toMatchObject({
      loops: {
        clips: { 'demo-clip': [{ id: 'first' }, { id: 'second' }] },
      },
    })
  })
})
