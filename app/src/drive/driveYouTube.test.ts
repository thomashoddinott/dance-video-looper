import { describe, expect, it } from 'vitest'

import type { FetchLike } from './driveApi'
import { DriveError } from './driveApi'
import type { DriveFile } from './driveClips'
import { clipFromDriveFile, isClipFile } from './driveClips'
import {
  A_FOLDER,
  A_TOKEN,
  anApiOver,
  answering,
  fetchAnswering,
  initOf,
  urlOf,
} from './driveHost.factory'

const A_VIDEO = 'EuT94T544Mg'

/* What Drive hands back for a YouTube entry the app added (#20): a file with no
   bytes worth playing, whose name is the title and whose properties say which
   video it stands for. */
const aYouTubeFile = (overrides: Partial<DriveFile> = {}): DriveFile => ({
  id: 'drive-yt-1',
  name: 'Cuban Salsa for Beginners - Class 12 (Paseala).youtube',
  mimeType: 'text/uri-list',
  createdTime: '2026-11-09T19:12:00.000Z',
  appProperties: { clipId: `yt:${A_VIDEO}`, youtube: A_VIDEO },
  ...overrides,
})

/* #20. A YouTube entry is a clip in every way the grid cares about — listed,
   renamed, styled, deleted and looped like one — so it is read as one, and only
   says where its pictures come from. */
describe('reading a YouTube entry off its file in Drive', () => {
  it('is read as a clip', () => {
    expect(isClipFile(aYouTubeFile())).toBe(true)
  })

  it('says it is YouTube’s, and which video it plays', () => {
    const clip = clipFromDriveFile(aYouTubeFile())

    expect(clip).toMatchObject({ source: 'youtube', videoId: A_VIDEO })
  })

  it('keeps the id its loops are saved under', () => {
    expect(clipFromDriveFile(aYouTubeFile()).id).toBe(`yt:${A_VIDEO}`)
  })

  /* The `.youtube` on the end is what a title with a dot in it survives on:
     the name is read back with everything after the last dot stripped. */
  it('reads the title back whole, dots and all', () => {
    const clip = clipFromDriveFile(
      aYouTubeFile({ name: 'Salsa Vol. 2 - turns.youtube' }),
    )

    expect(clip.name).toBe('Salsa Vol. 2 - turns')
  })

  it('reads a plain clip as no one’s but the dancer’s', () => {
    const clip = clipFromDriveFile(
      aYouTubeFile({
        name: 'Shuffle drill.mp4',
        mimeType: 'video/mp4',
        appProperties: { clipId: 'added-shuffle-drill-1-1', seconds: '26' },
      }),
    )

    expect(clip.source).toBeUndefined()
    expect(clip.videoId).toBeUndefined()
  })
})

const apiAnswering = (...answers: readonly ReturnType<typeof answering>[]) => {
  const fetch = fetchAnswering(...answers)

  return { ...anApiOver({ fetch }), fetch }
}

const sentBody = (fetch: FetchLike) =>
  JSON.parse(String(initOf(fetch)?.body)) as unknown

describe('adding a YouTube entry to Drive', () => {
  it('puts a file in the app’s folder carrying the video and the title', async () => {
    const { api, fetch } = apiAnswering(answering(aYouTubeFile()))

    await api.addYouTube(A_TOKEN, {
      folderId: A_FOLDER,
      videoId: A_VIDEO,
      title: 'Cuban Salsa for Beginners - Class 12 (Paseala)',
    })

    expect(initOf(fetch)?.method).toBe('POST')
    expect(sentBody(fetch)).toEqual({
      name: 'Cuban Salsa for Beginners - Class 12 (Paseala).youtube',
      parents: [A_FOLDER],
      mimeType: 'text/uri-list',
      appProperties: { clipId: `yt:${A_VIDEO}`, youtube: A_VIDEO },
    })
  })

  /* Metadata only: there are no bytes to send, which is the whole point. */
  it('sends nothing to the upload endpoint', async () => {
    const { api, fetch } = apiAnswering(answering(aYouTubeFile()))

    await api.addYouTube(A_TOKEN, { folderId: A_FOLDER, videoId: A_VIDEO, title: 'T' })

    expect(urlOf(fetch)).toContain('/drive/v3/files')
    expect(urlOf(fetch)).not.toContain('/upload/')
  })

  /* The listing's fields, so the file comes back as the clip a listing would
     read — `appProperties` above all, which is where its identity is. */
  it('hands back the file as Drive stored it, read the way a listing reads it', async () => {
    const { api, fetch } = apiAnswering(answering(aYouTubeFile()))

    const stored = await api.addYouTube(A_TOKEN, {
      folderId: A_FOLDER,
      videoId: A_VIDEO,
      title: 'Cuban Salsa for Beginners - Class 12 (Paseala)',
    })

    expect(urlOf(fetch)).toContain('appProperties')
    expect(clipFromDriveFile(stored)).toMatchObject({
      id: `yt:${A_VIDEO}`,
      source: 'youtube',
      driveId: 'drive-yt-1',
    })
  })

  it('refuses loudly, carrying the status', async () => {
    const { api } = apiAnswering(
      answering({ error: { message: 'the grant was withdrawn' } }, 401),
    )

    const refused = await api
      .addYouTube(A_TOKEN, { folderId: A_FOLDER, videoId: A_VIDEO, title: 'T' })
      .catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(DriveError)
    expect(refused).toMatchObject({ status: 401 })
  })
})
