import { describe, expect, it } from 'vitest'

import {
  A_FOLDER,
  A_TOKEN,
  anApiOver,
  answering,
  fetchAnswering,
  urlOf,
} from './driveHost.factory'

const A_STILLS_FOLDER = 'stills-folder-1'

const aStoredFile = (name: string, clipId: string, seconds: string) => ({
  id: `drive-${clipId}`,
  name,
  mimeType: 'video/mp4',
  createdTime: '2026-08-28T09:14:22.000Z',
  appProperties: { clipId, seconds },
})

/* The app's own file, as the same listing hands it back — one folder, one
   `loops.json`, re-found by name every session (US-01-15). It has an id, a name
   and a created time, which is everything a clip has. */
const theLoopsFile = () => ({
  id: 'drive-loops-json',
  name: 'loops.json',
  mimeType: 'application/json',
  createdTime: '2026-08-29T18:02:11.000Z',
})

/* What #77 will put in the folder. A folder comes back from a listing exactly
   as a file does. */
const aSubfolder = (name: string) => ({
  id: `drive-${name}`,
  name,
  mimeType: 'application/vnd.google-apps.folder',
  createdTime: '2026-08-29T18:02:11.000Z',
})

const apiListing = (body: unknown) => {
  const fetch = fetchAnswering(answering(body))

  return { ...anApiOver({ fetch }), fetch }
}

describe('listing the clips the app has uploaded', () => {
  it('reads each stored file back as a clip', async () => {
    const { api } = apiListing({
      files: [aStoredFile('Shuffle drill.mp4', 'shuffle', '27')],
    })

    await expect(api.listClips(A_TOKEN, A_FOLDER)).resolves.toEqual([
      {
        id: 'shuffle',
        driveId: 'drive-shuffle',
        name: 'Shuffle drill',
        added: '2026-08-28',
        seconds: 27,
        loops: 0,
      },
    ])
  })

  it('keeps the order Drive gave them in', async () => {
    const { api } = apiListing({
      files: [
        aStoredFile('Newest.mp4', 'newest', '5'),
        aStoredFile('Older.mp4', 'older', '9'),
      ],
    })

    const clips = await api.listClips(A_TOKEN, A_FOLDER)

    expect(clips.map(({ id }) => id)).toEqual(['newest', 'older'])
  })

  /* #79. The folder holds the clips *and* the app's own loops file, and the
     listing asks for its whole contents — so `loops.json` arrived, was mapped
     like everything else, and sat in the grid as a grey tile with no duration.
     It belongs in that folder; it does not belong in the grid. */
  it('leaves the app’s own loops file out of the grid', async () => {
    const { api } = apiListing({
      files: [
        aStoredFile('Shuffle drill.mp4', 'shuffle', '27'),
        theLoopsFile(),
        aStoredFile('Pivot turn.mp4', 'pivot', '14'),
      ],
    })

    const clips = await api.listClips(A_TOKEN, A_FOLDER)

    expect(clips.map(({ id }) => id)).toEqual(['shuffle', 'pivot'])
  })

  /* And it is not a rule about one filename: anything in the folder that is not
     a clip stays out, which is what makes #77's thumbnail folder free. */
  it('leaves a subfolder out of the grid', async () => {
    const { api } = apiListing({
      files: [
        aSubfolder('Thumbnails'),
        aStoredFile('Shuffle drill.mp4', 'shuffle', '27'),
      ],
    })

    const clips = await api.listClips(A_TOKEN, A_FOLDER)

    expect(clips.map(({ id }) => id)).toEqual(['shuffle'])
  })

  /* An empty library and a failed call are different facts, and the screen says
     different things about them (criterion 8). */
  it('reads an empty folder as no clips rather than as a failure', async () => {
    const { api } = apiListing({ files: [] })

    await expect(api.listClips(A_TOKEN, A_FOLDER)).resolves.toEqual([])
  })

  it('survives Drive omitting the list entirely', async () => {
    const { api } = apiListing({})

    await expect(api.listClips(A_TOKEN, A_FOLDER)).resolves.toEqual([])
  })

  /* The one field the app writes itself, and the only place a duration exists.
     Leaving it out of `fields` makes Drive omit it silently, and every tile on
     a second device loses its length. */
  it('asks for the properties the app stored, which is where duration lives', async () => {
    const { api, fetch } = apiListing({ files: [] })

    await api.listClips(A_TOKEN, A_FOLDER)

    expect(urlOf(fetch)).toContain('appProperties')
  })

  /* Same trap as `appProperties` above, and the same silence: a field left out
     of `fields` is simply absent from the answer. Without it every cached clip
     would have nothing to be compared against and would look changed. */
  it('asks for the checksum the cache tells a stale copy by', async () => {
    const { api, fetch } = apiListing({ files: [] })

    await api.listClips(A_TOKEN, A_FOLDER)

    expect(urlOf(fetch)).toContain('md5Checksum')
  })

  /* Same trap a third time, and this one decides whether a file is listed at
     all rather than what a tile says: without it every file in the folder comes
     back typeless, and `loops.json` is indistinguishable from a clip again. */
  it('asks for the type it tells a clip from the app’s own files by', async () => {
    const { api, fetch } = apiListing({ files: [] })

    await api.listClips(A_TOKEN, A_FOLDER)

    expect(urlOf(fetch)).toContain('mimeType')
  })

  it('looks only in the app’s own folder, and not at trash', async () => {
    const { api, fetch } = apiListing({ files: [] })

    await api.listClips(A_TOKEN, A_FOLDER)

    expect(urlOf(fetch)).toContain(`'${A_FOLDER}' in parents`)
    expect(urlOf(fetch)).toContain('trashed=false')
  })
})

/* The stills of #77, listed as a map from clip to the Drive file holding its
   still — which is the question every caller actually asks. */
describe('listing the stills the app has stored', () => {
  it('reads each stored still back under the clip it belongs to', async () => {
    const { api } = apiListing({
      files: [{ id: 'still-1', name: 'shuffle.jpg', appProperties: { clipId: 'shuffle' } }],
    })

    await expect(api.listThumbnails(A_TOKEN, A_STILLS_FOLDER)).resolves.toEqual({
      shuffle: 'still-1',
    })
  })

  it('asks the stills folder, and asks it for the clip ids', async () => {
    const { api, fetch } = apiListing({ files: [] })

    await api.listThumbnails(A_TOKEN, A_STILLS_FOLDER)

    expect(urlOf(fetch)).toContain(`'${A_STILLS_FOLDER}' in parents`)
    expect(urlOf(fetch)).toContain('appProperties')
  })

  it('refuses trashed stills, which are not stills', async () => {
    const { api, fetch } = apiListing({ files: [] })

    await api.listThumbnails(A_TOKEN, A_STILLS_FOLDER)

    expect(urlOf(fetch)).toContain('trashed=false')
  })
})
