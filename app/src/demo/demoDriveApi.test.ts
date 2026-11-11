import { describe, expect, it, vi } from 'vitest'

import { inMemoryStorage } from '../drive/keyValueStorage.factory'
import { getLoop } from '../loops/loop.factory'
import { applyToLoops, LOOPS_FILE, readLoops } from '../loops/driveLoops'
import { SCHEMA, serialiseLoops } from '../loops/loopsFile'
import { withLoop } from '../loops/loopsChange'
import type { DemoClip, DemoYouTube } from './demoDriveApi'
import { demoDriveApi } from './demoDriveApi'

const A_TOKEN = 'demo'

const theDemoClip: DemoClip = {
  id: 'demo-clip',
  name: 'Passitos',
  added: '2026-09-25',
  seconds: 16.8,
  style: 'bachata',
  url: '/assets/demo-clip.mp4',
}

const aDemoVideo = (overrides: Partial<DemoYouTube> = {}): DemoYouTube => ({
  videoId: 'aaaaaaaaaaa',
  name: 'A class',
  added: '2026-09-24',
  seconds: 600,
  style: 'salsa',
  ...overrides,
})

const clipBytes = new Blob([new Uint8Array(12)], { type: 'video/mp4' })
const aStill = new Blob([new Uint8Array(3)], { type: 'image/jpeg' })

const theBundledLoops = {
  [LOOPS_FILE]: serialiseLoops({
    schema: SCHEMA,
    clips: {
      'yt:l-H1OAu9N28': [{ id: 'cambre', name: 'Cambré', a: 18.8, b: 45.76, speed: 1 }],
    },
    touched: {},
  }),
}

const aDemoApi = ({
  storage = inMemoryStorage(),
  fetchBytes = vi.fn(async () => clipBytes),
  capture = vi.fn(async (_bytes: Blob): Promise<Blob | null> => aStill),
  youtube = [] as readonly DemoYouTube[],
  bundled = {} as Readonly<Record<string, string>>,
} = {}) =>
  demoDriveApi({
    clip: theDemoClip,
    youtube,
    bundled,
    storage,
    fetchBytes,
    capture,
    toUrl: () => 'blob:demo',
    releaseUrl: () => {},
  })

const folderOf = (api: ReturnType<typeof aDemoApi>) =>
  api.findOrCreateFolder(A_TOKEN)

describe('the demo library', () => {
  it('holds the bundled clip, with its style', async () => {
    const api = aDemoApi()

    const clips = await api.listClips(A_TOKEN, await folderOf(api))

    expect(clips).toHaveLength(1)
    expect(clips[0]).toMatchObject({
      id: 'demo-clip',
      name: 'Passitos',
      added: '2026-09-25',
      seconds: 16.8,
      style: 'bachata',
      loops: 0,
    })
  })

  /* #58. YouTube's own player plays them, so nothing of theirs is hosted
     here — which is what makes them safe to show a visitor. */
  it('holds the YouTube videos beside it, after the bundled clip', async () => {
    const api = aDemoApi({
      youtube: [
        aDemoVideo({ videoId: 'l-H1OAu9N28' }),
        aDemoVideo({ videoId: 'CkZO6nyJwjw' }),
      ],
    })

    const clips = await api.listClips(A_TOKEN, await folderOf(api))

    expect(clips.map(({ id }) => id)).toEqual([
      'demo-clip',
      'yt:l-H1OAu9N28',
      'yt:CkZO6nyJwjw',
    ])
  })

  it('lists a YouTube video as a library entry played from YouTube', async () => {
    const api = aDemoApi({
      youtube: [
        aDemoVideo({
          videoId: 'CkZO6nyJwjw',
          name: 'Cuban Salsa — Class 10',
          added: '2026-09-23',
          seconds: 767,
          style: 'salsa',
        }),
      ],
    })

    const [, video] = await api.listClips(A_TOKEN, await folderOf(api))

    expect(video).toMatchObject({
      id: 'yt:CkZO6nyJwjw',
      source: 'youtube',
      videoId: 'CkZO6nyJwjw',
      name: 'Cuban Salsa — Class 10',
      added: '2026-09-23',
      seconds: 767,
      style: 'salsa',
      loops: 0,
    })
  })

  /* The player opens an entry with no file id as undecodable, so each video
     gets one, as a real `.youtube` file has — one per video, since loops and
     tiles are told apart by it. */
  it('gives each YouTube video a file id of its own', async () => {
    const api = aDemoApi({
      youtube: [aDemoVideo({ videoId: 'l-H1OAu9N28' }), aDemoVideo({ videoId: 'CkZO6nyJwjw' })],
    })

    const [clip, ...videos] = await api.listClips(A_TOKEN, await folderOf(api))
    const ids = videos.map(({ driveId }) => driveId)

    expect(ids).not.toContain(undefined)
    expect(new Set([clip?.driveId, ...ids]).size).toBe(3)
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

  it('keeps no dance style', async () => {
    await expect(
      aDemoApi().setStyle(A_TOKEN, 'demo-clip', 'salsa'),
    ).rejects.toThrow()
  })

  it('keeps no YouTube video', async () => {
    await expect(
      aDemoApi().addYouTube(A_TOKEN, { folderId: 'f', videoId: 'EuT94T544Mg', title: 'T' }),
    ).rejects.toThrow()
  })

  it('renames nothing', async () => {
    await expect(
      aDemoApi().rename(A_TOKEN, 'demo-clip', 'Mine now'),
    ).rejects.toThrow()
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
  it('start empty when the site bundles none', async () => {
    const api = aDemoApi()

    expect(await readLoops(api, A_TOKEN, await folderOf(api))).toMatchObject({
      readable: true,
      loops: { clips: {} },
    })
  })

  /* #63. A visitor cannot reach anyone's Drive, so the loops the demo opens
     with ship with the site. */
  it('start from the loops bundled with the site', async () => {
    const api = aDemoApi({ bundled: theBundledLoops })

    expect(await readLoops(api, A_TOKEN, await folderOf(api))).toMatchObject({
      loops: { clips: { 'yt:l-H1OAu9N28': [{ id: 'cambre', name: 'Cambré' }] } },
    })
  })

  it('keep a visitor’s loop beside the bundled ones', async () => {
    const api = aDemoApi({ bundled: theBundledLoops })
    const folder = await folderOf(api)

    await applyToLoops(api, A_TOKEN, folder, (held) =>
      withLoop(held, 'yt:l-H1OAu9N28', getLoop({ id: 'mine' })),
    )

    expect(await readLoops(api, A_TOKEN, folder)).toMatchObject({
      loops: { clips: { 'yt:l-H1OAu9N28': [{ id: 'cambre' }, { id: 'mine' }] } },
    })
  })

  /* One visitor's saves are theirs: the next browser starts from what the
     site ships, not from what someone else did with it. */
  it('start from the bundled loops again in a browser that has saved none', async () => {
    const before = aDemoApi({ bundled: theBundledLoops })

    await applyToLoops(before, A_TOKEN, await folderOf(before), (held) =>
      withLoop(held, 'yt:l-H1OAu9N28', getLoop({ id: 'mine' })),
    )

    const elsewhere = aDemoApi({ bundled: theBundledLoops, storage: inMemoryStorage() })

    expect(await readLoops(elsewhere, A_TOKEN, await folderOf(elsewhere))).toMatchObject({
      loops: { clips: { 'yt:l-H1OAu9N28': [{ id: 'cambre' }] } },
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
