import { describe, expect, it } from 'vitest'

import { youTubeIdFor } from '../clips/youtube'
import { readLoopsFile } from '../loops/loopsFile'
import { DEMO_CLIP, DEMO_YOUTUBE } from './demoClip'
import demoLoops from './demoLoops.json'

/* #63. The loops the demo opens with are a file edited by hand, so these are
   the checks a hand edit can fail. */
describe('the loops bundled with the demo', () => {
  it('are a loops file the app can read', () => {
    expect(readLoopsFile(JSON.stringify(demoLoops))).toMatchObject({ readable: true })
  })

  /* A mistyped id would ship loops no tile ever shows. */
  it('belong only to clips the demo holds', () => {
    const held = [DEMO_CLIP.id, ...DEMO_YOUTUBE.map(({ videoId }) => youTubeIdFor(videoId))]

    expect(held).toEqual(expect.arrayContaining(Object.keys(demoLoops.clips)))
  })
})
