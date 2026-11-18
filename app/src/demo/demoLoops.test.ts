import { describe, expect, it } from 'vitest'

import { youTubeIdFor } from '../clips/youtube'
import { readLoopsFile } from '../loops/loopsFile'
import demoLoops from './demoLoops.json'
import { DEMO_YOUTUBE } from './demoVideos'

/* #63. The loops the showcase opens with are a snapshot written by hand
   (#77), so these are the checks a hand edit can fail. */
describe('the loops bundled with the showcase', () => {
  it('are a loops file the app can read', () => {
    expect(readLoopsFile(JSON.stringify(demoLoops))).toMatchObject({ readable: true })
  })

  /* A mistyped id would ship loops no tile ever shows. */
  it('belong only to videos the showcase holds', () => {
    const held = DEMO_YOUTUBE.map(({ videoId }) => youTubeIdFor(videoId))

    expect(held).toEqual(expect.arrayContaining(Object.keys(demoLoops.clips)))
  })

  /* #77. The showcase is the videos with loops: one without would be a tile
     with nothing to show for itself. */
  it('give every video in the showcase some', () => {
    DEMO_YOUTUBE.forEach(({ videoId }) => {
      expect(Object.keys(demoLoops.clips)).toContain(youTubeIdFor(videoId))
    })
  })
})
