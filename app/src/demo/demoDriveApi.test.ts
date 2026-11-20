import { describe, expect, it } from 'vitest'

import { inMemoryStorage } from '../drive/keyValueStorage.factory'
import { getLoop } from '../loops/loop.factory'
import { applyToLoops, LOOPS_FILE, readLoops } from '../loops/driveLoops'
import { SCHEMA, serialiseLoops } from '../loops/loopsFile'
import { withLoop } from '../loops/loopsChange'
import type { DemoYouTube } from './demoDriveApi'
import { demoDriveApi } from './demoDriveApi'

const A_TOKEN = 'demo'

const aDemoVideo = (overrides: Partial<DemoYouTube> = {}): DemoYouTube => ({
  videoId: 'aaaaaaaaaaa',
  name: 'A class',
  added: '2026-09-24',
  seconds: 600,
  style: 'salsa',
  ...overrides,
})

const theBundledLoops = {
  [LOOPS_FILE]: serialiseLoops({
    schema: SCHEMA,
    clips: {
      'yt:NJxnD75rSAA': [
        { id: 'bad2c2fa-8498-4c52-9c0c-3ef3c7e4dc35', name: 'Loop 1', a: 57.6, b: 75.09, speed: 1 },
      ],
    },
    touched: {},
  }),
}

const aDemoApi = ({
  storage = inMemoryStorage(),
  youtube = [] as readonly DemoYouTube[],
  bundled = {} as Readonly<Record<string, string>>,
} = {}) =>
  demoDriveApi({
    youtube,
    bundled,
    storage,
    toUrl: () => 'blob:demo',
    releaseUrl: () => {},
  })

const folderOf = (api: ReturnType<typeof aDemoApi>) =>
  api.findOrCreateFolder(A_TOKEN)

/* #77. The showcase is YouTube videos only: nothing of them is hosted here,
   which is what makes them safe to show a visitor (#58). */
describe('the showcase library', () => {
  it('holds the YouTube videos it is given, in that order', async () => {
    const api = aDemoApi({
      youtube: [aDemoVideo({ videoId: 'R4qPshBIK7M' }), aDemoVideo({ videoId: 'NJxnD75rSAA' })],
    })

    const clips = await api.listClips(A_TOKEN, await folderOf(api))

    expect(clips.map(({ id }) => id)).toEqual(['yt:R4qPshBIK7M', 'yt:NJxnD75rSAA'])
  })

  it('lists a YouTube video as a library entry played from YouTube', async () => {
    const api = aDemoApi({
      youtube: [
        aDemoVideo({
          videoId: 'NJxnD75rSAA',
          name: '20230225 Igor & Rocio Bachata sensual workshop warm up at Dancelife X Toronto',
          added: '2026-11-14',
          seconds: 199,
          style: 'bachata',
        }),
      ],
    })

    const [video] = await api.listClips(A_TOKEN, await folderOf(api))

    expect(video).toMatchObject({
      id: 'yt:NJxnD75rSAA',
      source: 'youtube',
      videoId: 'NJxnD75rSAA',
      name: '20230225 Igor & Rocio Bachata sensual workshop warm up at Dancelife X Toronto',
      added: '2026-11-14',
      seconds: 199,
      style: 'bachata',
      loops: 0,
    })
  })

  /* A snapshot keeps the library's styles as they were, and a video nobody
     had given one yet arrives with none. */
  it('lists a video with no style as one with none', async () => {
    const api = aDemoApi({ youtube: [aDemoVideo({ style: undefined })] })

    const [video] = await api.listClips(A_TOKEN, await folderOf(api))

    expect(video?.style).toBeUndefined()
  })

  /* The player opens an entry with no file id as undecodable, so each video
     gets one, as a real `.youtube` file has — one per video, since loops and
     tiles are told apart by it. */
  it('gives each YouTube video a file id of its own', async () => {
    const api = aDemoApi({
      youtube: [aDemoVideo({ videoId: 'R4qPshBIK7M' }), aDemoVideo({ videoId: 'NJxnD75rSAA' })],
    })

    const ids = (await api.listClips(A_TOKEN, await folderOf(api))).map(({ driveId }) => driveId)

    expect(ids).not.toContain(undefined)
    expect(new Set(ids).size).toBe(2)
  })

  it('has nothing to download', async () => {
    await expect(aDemoApi().download(A_TOKEN, 'someone-elses-file')).rejects.toThrow()
  })

  /* YouTube publishes a picture of every video, which the tile shows. */
  it('has no stills of its own', async () => {
    const api = aDemoApi({ youtube: [aDemoVideo()] })

    expect(await api.listThumbnails(A_TOKEN, await folderOf(api))).toEqual({})
  })

  /* Read-only, because the grid is. Nothing may pretend to have stored a clip
     it has nowhere to put. */
  it('keeps no clip a visitor tries to add', async () => {
    const api = aDemoApi()

    await expect(
      api.upload(A_TOKEN, {
        file: new File([new Uint8Array(3)], 'mine.mp4'),
        clipId: 'mine',
        seconds: 3,
        folderId: await folderOf(api),
        onProgress: () => {},
      }),
    ).rejects.toThrow()
  })

  it('deletes nothing', async () => {
    await expect(aDemoApi().trash(A_TOKEN, 'yt:NJxnD75rSAA')).rejects.toThrow()
  })

  it('keeps no dance style', async () => {
    await expect(aDemoApi().setStyle(A_TOKEN, 'yt:NJxnD75rSAA', 'salsa')).rejects.toThrow()
  })

  /* #70. Nor a group: the grid offers the showcase no group label. */
  it('keeps no group', async () => {
    await expect(aDemoApi().setGroup(A_TOKEN, 'yt:NJxnD75rSAA', 'Shines')).rejects.toThrow()
  })

  it('keeps no YouTube video', async () => {
    await expect(
      aDemoApi().addYouTube(A_TOKEN, { folderId: 'f', videoId: 'EuT94T544Mg', title: 'T' }),
    ).rejects.toThrow()
  })

  it('renames nothing', async () => {
    await expect(aDemoApi().rename(A_TOKEN, 'yt:NJxnD75rSAA', 'Mine now')).rejects.toThrow()
  })
})

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
      loops: {
        clips: {
          'yt:NJxnD75rSAA': [{ id: 'bad2c2fa-8498-4c52-9c0c-3ef3c7e4dc35', name: 'Loop 1' }],
        },
      },
    })
  })

  it('keep a visitor’s loop beside the bundled ones', async () => {
    const api = aDemoApi({ bundled: theBundledLoops })
    const folder = await folderOf(api)

    await applyToLoops(api, A_TOKEN, folder, (held) =>
      withLoop(held, 'yt:NJxnD75rSAA', getLoop({ id: 'mine' })),
    )

    expect(await readLoops(api, A_TOKEN, folder)).toMatchObject({
      loops: {
        clips: {
          'yt:NJxnD75rSAA': [{ id: 'bad2c2fa-8498-4c52-9c0c-3ef3c7e4dc35' }, { id: 'mine' }],
        },
      },
    })
  })

  /* One visitor's saves are theirs: the next browser starts from what the
     site ships, not from what someone else did with it. */
  it('start from the bundled loops again in a browser that has saved none', async () => {
    const before = aDemoApi({ bundled: theBundledLoops })

    await applyToLoops(before, A_TOKEN, await folderOf(before), (held) =>
      withLoop(held, 'yt:NJxnD75rSAA', getLoop({ id: 'mine' })),
    )

    const elsewhere = aDemoApi({ bundled: theBundledLoops, storage: inMemoryStorage() })

    expect(await readLoops(elsewhere, A_TOKEN, await folderOf(elsewhere))).toMatchObject({
      loops: { clips: { 'yt:NJxnD75rSAA': [{ id: 'bad2c2fa-8498-4c52-9c0c-3ef3c7e4dc35' }] } },
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
