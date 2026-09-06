import { describe, expect, it } from 'vitest'

import {
  thumbnailFileFor,
  thumbnailsFromDriveFiles,
} from './driveThumbnails'

const A_FOLDER = '1c0JePvIVQayCo5nR2xxwZBgHRXCxdxwZ'
const A_CLIP_ID = 'added-shuffle-drill-26-1756000000000'

describe('describing a still as the file Drive will hold', () => {
  it('puts it in the stills folder it was given, not beside the clips', () => {
    expect(thumbnailFileFor(A_CLIP_ID, A_FOLDER).parents).toEqual([A_FOLDER])
  })

  /* The dancer opens this folder in their own Drive. A name that says which
     clip a still belongs to is the difference between a folder they can make
     sense of and a wall of identical thumbnails. */
  it('names it for the clip it was taken from', () => {
    expect(thumbnailFileFor(A_CLIP_ID, A_FOLDER).name).toContain(A_CLIP_ID)
  })

  /* The name is for the dancer; `appProperties` is what the app reads. Drive
     lets a file be renamed, and a still whose identity lived only in its name
     would come back attached to nothing the moment one was. */
  it('carries the clip id where a rename cannot reach it', () => {
    expect(thumbnailFileFor(A_CLIP_ID, A_FOLDER).appProperties.clipId).toBe(
      A_CLIP_ID,
    )
  })
})

/* The round trip, tested as one: a key renamed on one side alone is exactly
   the failure neither half catches on its own. */
describe('reading the stills Drive holds back', () => {
  it('finds a still under the clip id it was stored with', () => {
    const { name, appProperties } = thumbnailFileFor(A_CLIP_ID, A_FOLDER)

    expect(
      thumbnailsFromDriveFiles([{ id: 'still-1', name, appProperties }]),
    ).toEqual({ [A_CLIP_ID]: 'still-1' })
  })

  /* Anything the dancer drops in this folder themselves. It belongs to no
     clip, so it is not a still — and treating it as one would put a holiday
     photo on a tile. */
  it('ignores a file that names no clip', () => {
    expect(
      thumbnailsFromDriveFiles([{ id: 'stray-1', name: 'holiday.jpg' }]),
    ).toEqual({})
  })

  /* Two stills for one clip is what a re-upload leaves behind. The listing
     comes back newest first, so the first one wins and the older is simply
     never asked for. */
  it('keeps the newest of two stills for the same clip', () => {
    const { appProperties } = thumbnailFileFor(A_CLIP_ID, A_FOLDER)

    expect(
      thumbnailsFromDriveFiles([
        { id: 'still-new', name: 'a.jpg', appProperties },
        { id: 'still-old', name: 'b.jpg', appProperties },
      ]),
    ).toEqual({ [A_CLIP_ID]: 'still-new' })
  })
})
