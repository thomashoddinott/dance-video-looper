import { describe, expect, it } from 'vitest'

import { getLoop } from './loop.factory'
import { NO_LOOPS, readLoopsFile, serialiseLoops } from './loopsFile'

/* `JSON.stringify` drops an undefined value rather than writing `null`, so
   omitting the second argument writes a file with no `touched` key at all —
   which is every file written before #12. */
const written = (clips: Record<string, unknown>, touched?: unknown) =>
  JSON.stringify({ schema: 1, clips, touched })

const PRACTISED = '2026-09-06T18:04:11.000Z'

/* The whole point of this module is that a bad file cannot cost the dancer
   their loops, so every case below is about telling three things apart:
   nothing saved yet, something saved, and something we refuse to touch. */
describe('reading a loops.json body', () => {
  it('reads back the loops a clip has saved', () => {
    const loop = getLoop()

    expect(readLoopsFile(written({ 'shuffle-drill': [loop] }))).toEqual({
      readable: true,
      loops: { schema: 1, clips: { 'shuffle-drill': [loop] }, touched: {} },
    })
  })

  it('survives a round trip through the writer', () => {
    const loops = {
      schema: 1 as const,
      clips: { 'shuffle-drill': [getLoop()] },
      touched: {},
    }

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
      loops: { schema: 1, clips: { 'shuffle-drill': [good] }, touched: {} },
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
      loops: { schema: 1, clips: { kept: [good] }, touched: {} },
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

/* When each clip was last opened (#12), which is what the **Last opened**
   chip orders by.

   Recency is not the asset — the loops are — and every rule below follows from
   that one asymmetry. A stamp that cannot be read is dropped; a *loop* that
   cannot be read makes the whole file untouchable. Losing a stamp costs an
   ordering until the next save. Losing a loop costs the dancer their work. */
describe('when a clip was last opened', () => {
  it('reads back the stamps beside the loops', () => {
    const loop = getLoop()

    expect(
      readLoopsFile(
        written({ 'shuffle-drill': [loop] }, { 'shuffle-drill': PRACTISED }),
      ),
    ).toEqual({
      readable: true,
      loops: {
        schema: 1,
        clips: { 'shuffle-drill': [loop] },
        touched: { 'shuffle-drill': PRACTISED },
      },
    })
  })

  /* Every `loops.json` in Drive predates this, and the dancer's loops are in
     them. Reading one as anything other than "opened nothing yet" would be
     the feature arriving by destroying what it was built to order. */
  it('reads a file written before stamps existed as nothing opened yet', () => {
    const loop = getLoop()

    expect(readLoopsFile(written({ 'shuffle-drill': [loop] }))).toEqual({
      readable: true,
      loops: { schema: 1, clips: { 'shuffle-drill': [loop] }, touched: {} },
    })
  })

  it('survives a round trip through the writer', () => {
    const loops = {
      schema: 1 as const,
      clips: { 'shuffle-drill': [getLoop()] },
      touched: { 'shuffle-drill': PRACTISED },
    }

    expect(readLoopsFile(serialiseLoops(loops))).toEqual({
      readable: true,
      loops,
    })
  })

  /* Removing a clip's last loop drops it out of `clips` and is itself an act of
     practising it, so the stamp has to outlive the loops it was made by. */
  it('keeps a stamp for a clip that has no loops left', () => {
    expect(readLoopsFile(written({}, { 'shuffle-drill': PRACTISED }))).toEqual({
      readable: true,
      loops: { schema: 1, clips: {}, touched: { 'shuffle-drill': PRACTISED } },
    })
  })

  it('drops a stamp that is not a string and keeps its siblings', () => {
    expect(
      readLoopsFile(
        written({}, { broken: 1757181851000, kept: PRACTISED }),
      ),
    ).toEqual({
      readable: true,
      loops: { schema: 1, clips: {}, touched: { kept: PRACTISED } },
    })
  })

  /* The other half of that same argument. `Date.parse` understands far more
     than this app writes, and a stamp carrying an offset is a time that reads
     perfectly and still sorts wrong: `laterOf` and the chip both compare these
     as plain strings, so `…T19:04:11+02:00` sorts *after* `…T18:00:00.000Z`
     while being the earlier instant. The type says "always UTC" — the door is
     where that is made true, rather than trusted.

     Not hypothetical: `loops.json` is indented precisely so the dancer can open
     it in their own Drive, and UC-01 Q-06 will read this shape back in. */
  it('normalises a stamp that arrived in some other time zone', () => {
    expect(
      readLoopsFile(written({}, { 'shuffle-drill': '2026-09-06T19:04:11+02:00' })),
    ).toEqual({
      readable: true,
      loops: {
        schema: 1,
        clips: {},
        touched: { 'shuffle-drill': '2026-09-06T17:04:11.000Z' },
      },
    })
  })

  /* A string is not yet a time. This one sorts somewhere arbitrary rather than
     failing loudly, so it is refused at the door instead. */
  it('drops a stamp that is not a time', () => {
    expect(
      readLoopsFile(written({}, { broken: 'last Tuesday-ish' })),
    ).toEqual({ readable: true, loops: NO_LOOPS })
  })

  /* The asymmetry, stated as a test: `clips` being the wrong shape refuses the
     whole file, because the loops in it are unaccounted for. `touched` being
     the wrong shape must not, because refusing would throw away readable loops
     to punish a broken ordering. */
  it('keeps the file when the stamps themselves are the wrong shape', () => {
    const loop = getLoop()
    const readable = {
      readable: true,
      loops: { schema: 1, clips: { 'shuffle-drill': [loop] }, touched: {} },
    }

    expect(readLoopsFile(written({ 'shuffle-drill': [loop] }, []))).toEqual(
      readable,
    )
    expect(
      readLoopsFile(written({ 'shuffle-drill': [loop] }, 'yesterday')),
    ).toEqual(readable)
  })
})
