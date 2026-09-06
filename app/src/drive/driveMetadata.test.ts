import { describe, expect, it } from 'vitest'

import { clipFromDriveFile, driveFileFor } from './driveClips'

const A_FOLDER = '1c0JePvIVQayCo5nR2xxwZBgHRXCxdxwZ'

/* The id the tile was built with, back on the Clips screen. It arrives here as
   a value precisely so nothing can derive a second one. */
const A_CLIP_ID = 'added-shuffle-drill-26-1756000000000'

const aFile = (name = 'Shuffle drill.mp4') =>
  new File([new Uint8Array(26)], name, { lastModified: 1_756_000_000_000 })

describe('describing a clip as the file Drive will hold', () => {
  it('keeps the filename whole, extension and all', () => {
    const metadata = driveFileFor(aFile(), A_CLIP_ID, 27, A_FOLDER)

    expect(metadata.name).toBe('Shuffle drill.mp4')
  })

  it('puts the file in the app’s own folder', () => {
    const metadata = driveFileFor(aFile(), A_CLIP_ID, 27, A_FOLDER)

    expect(metadata.parents).toEqual([A_FOLDER])
  })

  it('stores the length, which Drive itself has nowhere to keep', () => {
    const metadata = driveFileFor(aFile(), A_CLIP_ID, 27, A_FOLDER)

    expect(metadata.appProperties.seconds).toBe('27')
  })

  it('stores the identity the clip had while it was local', () => {
    const metadata = driveFileFor(aFile(), A_CLIP_ID, 27, A_FOLDER)

    expect(metadata.appProperties.clipId).toBe(A_CLIP_ID)
  })

  /* US-01-17. The bytes going up are a re-encode: different name, different
     size, and so a different id had anything here derived one. The dancer
     picked the .MOV, the tile carries the .MOV's id, and a duplicate-add has to
     keep colliding with it — so the id cannot come from what is being sent. */
  it('keeps the picked file’s identity when compressed bytes are what go up', () => {
    const compressed = new File([new Uint8Array(9)], 'Shuffle drill.mp4', {
      lastModified: 1_756_000_009_999,
    })

    const metadata = driveFileFor(compressed, A_CLIP_ID, 27, A_FOLDER)

    expect(metadata.appProperties.clipId).toBe(A_CLIP_ID)
  })

  /* The two halves are one contract, and a test of either alone would not catch
     a key renamed on one side. */
  it('round-trips: what is stored is what comes back', () => {
    const metadata = driveFileFor(aFile(), A_CLIP_ID, 27, A_FOLDER)

    const clip = clipFromDriveFile({
      id: 'drive-file-id',
      name: metadata.name,
      createdTime: '2026-08-28T09:14:22.000Z',
      appProperties: metadata.appProperties,
    })

    expect(clip).toEqual({
      id: A_CLIP_ID,
      driveId: 'drive-file-id',
      name: 'Shuffle drill',
      added: '2026-08-28',
      seconds: 27,
      loops: 0,
    })
  })

  it('round-trips a length that is not whole', () => {
    const metadata = driveFileFor(aFile(), A_CLIP_ID, 41.2, A_FOLDER)

    const clip = clipFromDriveFile({
      id: 'drive-file-id',
      name: metadata.name,
      appProperties: metadata.appProperties,
    })

    expect(clip.seconds).toBe(41.2)
  })
})
