import { describe, expect, it, vi } from 'vitest'

import type { DriveApi, DriveResponse, PutBytes } from './driveApi'
import {
  A_FOLDER,
  A_TOKEN,
  anApiOver,
  answeringWith,
  fetchAnswering,
  initOf,
} from './driveHost.factory'

const A_SESSION = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=x'

const aFile = () =>
  new File([new Uint8Array(9_784_045)], 'Shuffle drill.mp4', {
    type: 'video/mp4',
    lastModified: 1_756_000_000_000,
  })

const started = (sessionUri: string | null = A_SESSION): DriveResponse =>
  answeringWith({
    headers: {
      get: (name) => (name.toLowerCase() === 'location' ? sessionUri : null),
    },
  })

const STORED = {
  id: 'drive-file-id',
  name: 'Shuffle drill.mp4',
  createdTime: '2026-08-28T09:14:22.000Z',
  appProperties: { clipId: 'shuffle', seconds: '27' },
}

/* Progress at a couple of points and then the whole file, which is the shape a
   real upload's events take. */
const putSucceeding = (body: unknown = STORED) =>
  vi.fn<PutBytes>(async ({ onProgress, body: bytes }) => {
    onProgress(0, bytes.size)
    onProgress(bytes.size / 2, bytes.size)
    onProgress(bytes.size, bytes.size)

    return { ok: true, body: JSON.stringify(body) }
  })

const apiUploading = (
  putBytes: PutBytes,
  start: DriveResponse = started(),
) => {
  const fetch = fetchAnswering(start)

  return { ...anApiOver({ fetch, putBytes }), fetch }
}

const anUpload = (api: DriveApi, onProgress = vi.fn()) =>
  api.upload(A_TOKEN, {
    file: aFile(),
    clipId: 'added-shuffle-drill-26-1756000000000',
    seconds: 27,
    folderId: A_FOLDER,
    onProgress,
  })

describe('uploading a clip to Drive', () => {
  it('resolves with the file Drive stored', async () => {
    const { api } = apiUploading(putSucceeding())

    await expect(anUpload(api)).resolves.toEqual(STORED)
  })

  /* The whole reason resumable is used rather than a single request: `fetch`
     still has no upload progress event, and criterion 2 is unanswerable without
     one. */
  it('reports how far along it is as the bytes go', async () => {
    const { api } = apiUploading(putSucceeding())
    const onProgress = vi.fn()

    await anUpload(api, onProgress)

    expect(onProgress.mock.calls).toEqual([
      [0, 9_784_045],
      [4_892_022.5, 9_784_045],
      [9_784_045, 9_784_045],
    ])
  })

  it('sends the clip’s identity and length with the file', async () => {
    const { api, fetch } = apiUploading(putSucceeding())

    await anUpload(api)

    const sent: unknown = JSON.parse(String(initOf(fetch)?.body))

    expect(sent).toMatchObject({
      name: 'Shuffle drill.mp4',
      parents: [A_FOLDER],
      appProperties: { seconds: '27' },
    })
  })

  /* Drive wants the size and type up front so it can reject an upload before
     the bytes are sent rather than after. */
  it('declares the size and type before sending anything', async () => {
    const { api, fetch } = apiUploading(putSucceeding())

    await anUpload(api)

    expect(initOf(fetch)?.headers).toMatchObject({
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': '9784045',
    })
  })

  it('sends the bytes to the session Drive opened, not to the API', async () => {
    const putBytes = putSucceeding()
    const { api } = apiUploading(putBytes)

    await anUpload(api)

    expect(putBytes).toHaveBeenCalledWith(
      expect.objectContaining({ url: A_SESSION }),
    )
  })

  /* The spike's one real unknown: whether JS could read the session URI out of
     the Location header at all. It could — but if that ever changes, the upload
     has to fail loudly rather than quietly doing something else. */
  it('fails plainly when Drive opens a session it will not let us read', async () => {
    const { api } = apiUploading(putSucceeding(), started(null))

    await expect(anUpload(api)).rejects.toMatchObject({ name: 'DriveError' })
  })

  it('fails with the status when Drive refuses the bytes', async () => {
    const { api } = apiUploading(
      vi.fn<PutBytes>().mockResolvedValue({
        ok: false,
        status: 403,
        body: 'quota',
      }),
    )

    await expect(anUpload(api)).rejects.toMatchObject({
      name: 'DriveError',
      status: 403,
    })
  })

  it('fails rather than resolving with a body it cannot read', async () => {
    const { api } = apiUploading(
      vi.fn<PutBytes>().mockResolvedValue({ ok: true, body: 'not json' }),
    )

    await expect(anUpload(api)).rejects.toMatchObject({ name: 'DriveError' })
  })

  /* A body that reads but names no file is the same failure as one that does
     not read at all: nothing downstream can address the bytes, and the clip
     would sit in the library looking stored while carrying no Drive id. Loud,
     for the reason the missing session URI above is loud. */
  it('fails rather than resolving with a file it cannot address', async () => {
    const { api } = apiUploading(putSucceeding({ name: 'Shuffle drill.mp4' }))

    await expect(anUpload(api)).rejects.toMatchObject({ name: 'DriveError' })
  })
})

/* #77's stills, up the same resumable path the clips take. Two round trips for
   thirty kilobytes is nothing against an add already measured at ~13 s, and a
   second upload mechanism is precisely what the spike declined to keep. */
describe('uploading a still to Drive', () => {
  const A_STILLS_FOLDER = 'stills-folder-1'
  const A_CLIP_ID = 'added-shuffle-drill-26-1756000000000'

  const aStill = () =>
    new Blob([new Uint8Array(31_204)], { type: 'image/jpeg' })

  const aStillUpload = (api: DriveApi) =>
    api.uploadThumbnail(A_TOKEN, {
      bytes: aStill(),
      clipId: A_CLIP_ID,
      folderId: A_STILLS_FOLDER,
    })

  it('resolves with the file Drive stored', async () => {
    const { api } = apiUploading(putSucceeding({ id: 'still-1' }))

    await expect(aStillUpload(api)).resolves.toMatchObject({ id: 'still-1' })
  })

  it('opens the session with the still’s own metadata, not a clip’s', async () => {
    const { api, fetch } = apiUploading(putSucceeding({ id: 'still-1' }))

    await aStillUpload(api)

    expect(String(initOf(fetch)?.body)).toContain(A_CLIP_ID)
    expect(String(initOf(fetch)?.body)).toContain(A_STILLS_FOLDER)
    /* A clip's metadata carries its length. A still has none, and sending a
       `seconds` of anything would make the folder listing lie. */
    expect(String(initOf(fetch)?.body)).not.toContain('seconds')
  })

  it('sends the bytes as the image they are', async () => {
    const putBytes = putSucceeding({ id: 'still-1' })
    const { api } = apiUploading(putBytes)

    await aStillUpload(api)

    expect(putBytes).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'image/jpeg' }),
    )
  })

  it('reports a refusal with the status Drive gave it', async () => {
    const { api } = apiUploading(
      vi.fn<PutBytes>(async () => ({ ok: false, status: 403, body: 'no' })),
    )

    await expect(aStillUpload(api)).rejects.toMatchObject({
      name: 'DriveError',
      status: 403,
    })
  })
})
