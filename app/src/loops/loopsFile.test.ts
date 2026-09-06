import { describe, expect, it } from 'vitest'

import { getLoop } from './loop.factory'
import { NO_LOOPS, readLoopsFile, serialiseLoops } from './loopsFile'

const written = (clips: Record<string, unknown>) =>
  JSON.stringify({ schema: 1, clips })

/* The whole point of this module is that a bad file cannot cost the dancer
   their loops, so every case below is about telling three things apart:
   nothing saved yet, something saved, and something we refuse to touch. */
describe('reading a loops.json body', () => {
  it('reads back the loops a clip has saved', () => {
    const loop = getLoop()

    expect(readLoopsFile(written({ 'shuffle-drill': [loop] }))).toEqual({
      readable: true,
      loops: { schema: 1, clips: { 'shuffle-drill': [loop] } },
    })
  })

  it('survives a round trip through the writer', () => {
    const loops = { schema: 1 as const, clips: { 'shuffle-drill': [getLoop()] } }

    expect(readLoopsFile(serialiseLoops(loops))).toEqual({
      readable: true,
      loops,
    })
  })

  /* The first save creates the file's metadata and then patches its content,
     so a failure between the two leaves a real `loops.json` holding nothing.
     Reading that as unreadable would refuse every subsequent save and brick
     the feature on the one device that hit it. */
  it('reads an empty body as nothing saved yet, not as a broken file', () => {
    expect(readLoopsFile('')).toEqual({ readable: true, loops: NO_LOOPS })
    expect(readLoopsFile('   \n ')).toEqual({ readable: true, loops: NO_LOOPS })
  })

  it('reads a file with no clips in it as nothing saved yet', () => {
    expect(readLoopsFile(written({}))).toEqual({
      readable: true,
      loops: NO_LOOPS,
    })
  })
})

/* Unreadable is not a synonym for empty. It is what stops a save writing over
   a file nobody has understood — the one failure mode that destroys the asset
   rather than merely failing to add to it. */
describe('refusing a loops.json nobody can understand', () => {
  it('refuses a body that is not JSON at all', () => {
    expect(readLoopsFile('not json {')).toEqual({ readable: false })
  })

  it('refuses a body that is JSON but not an object', () => {
    expect(readLoopsFile('[]')).toEqual({ readable: false })
    expect(readLoopsFile('null')).toEqual({ readable: false })
    expect(readLoopsFile('42')).toEqual({ readable: false })
  })

  /* A schema this app has never written is a file from a version that knew
     something we do not. Overwriting it would be the newer app's loops gone. */
  it('refuses a schema it does not know', () => {
    expect(readLoopsFile(JSON.stringify({ schema: 2, clips: {} }))).toEqual({
      readable: false,
    })
  })

  it('refuses a file whose clips are missing or the wrong shape', () => {
    expect(readLoopsFile(JSON.stringify({ schema: 1 }))).toEqual({
      readable: false,
    })
    expect(readLoopsFile(JSON.stringify({ schema: 1, clips: [] }))).toEqual({
      readable: false,
    })
  })
})

/* One bad entry is a different question from one bad file: the rest of the
   file is still the dancer's work, and dropping all of it to punish one
   malformed loop would be the app losing loops on their behalf. */
describe('a malformed loop among good ones', () => {
  it('drops the bad entry and keeps its siblings', () => {
    const good = getLoop({ id: 'keeps' })

    expect(
      readLoopsFile(
        written({ 'shuffle-drill': [good, { id: 'no-name-no-points' }] }),
      ),
    ).toEqual({
      readable: true,
      loops: { schema: 1, clips: { 'shuffle-drill': [good] } },
    })
  })

  it('drops an entry whose boundaries are not numbers', () => {
    expect(
      readLoopsFile(written({ 'shuffle-drill': [getLoop({ a: '0' as never })] })),
    ).toEqual({ readable: true, loops: NO_LOOPS })
  })

  /* NaN survives `typeof x === 'number'` and would reach the video element as
     a seek to nowhere, which is a loop that silently does not play. */
  it('drops an entry whose boundaries are not finite', () => {
    expect(
      readLoopsFile(
        JSON.stringify({
          schema: 1,
          clips: { 'shuffle-drill': [{ ...getLoop(), b: null }] },
        }),
      ),
    ).toEqual({ readable: true, loops: NO_LOOPS })
  })

  it('drops a clip whose loops are not a list, and keeps the other clips', () => {
    const good = getLoop()

    expect(
      readLoopsFile(written({ broken: 'not a list', kept: [good] })),
    ).toEqual({
      readable: true,
      loops: { schema: 1, clips: { kept: [good] } },
    })
  })

  /* A clip left with nothing is a clip with no loops, and the file should not
     carry an empty list forever once its last loop was dropped. */
  it('leaves out a clip whose every loop was dropped', () => {
    expect(readLoopsFile(written({ 'shuffle-drill': [{}] }))).toEqual({
      readable: true,
      loops: NO_LOOPS,
    })
  })
})
