import { describe, expect, it } from 'vitest'

import { type Gate, idle, requested, settled } from './seekGate'

const inFlight = ({ pending = null }: Partial<Gate> = {}): Gate => ({
  inFlight: true,
  pending,
})

/* A pointermove fires far faster than a seek on a ~6MB clip can land — the mockup
   gate measured a median of 49 ms for a small drag against a pointer stream
   arriving every few milliseconds. Assigning `currentTime` on every one of them
   builds a queue the decoder then works through late, and the clip ends up
   chasing where the finger was half a second ago.

   The fix is not to go faster. It is to notice that every target but the newest
   is already wrong by the time it could be issued, and to forget them rather than
   promise them. */
describe('asking the gate for a seek', () => {
  it('issues it straight away when nothing is in flight', () => {
    expect(requested(idle, 5)).toEqual({
      gate: { inFlight: true, pending: null },
      seek: 5,
    })
  })

  it('holds it back while a seek is still in flight', () => {
    expect(requested(inFlight(), 7)).toEqual({
      gate: { inFlight: true, pending: 7 },
      seek: null,
    })
  })

  /* The whole point, and the line between this and a queue. A second ask does not
     get in line behind the first — it replaces it, because the first is already
     somewhere the finger has left. */
  it('replaces a held target rather than queueing behind it', () => {
    expect(requested(inFlight({ pending: 7 }), 9)).toEqual({
      gate: { inFlight: true, pending: 9 },
      seek: null,
    })
  })
})

describe('a seek landing', () => {
  it('issues the newest target that was held back', () => {
    expect(settled(inFlight({ pending: 9 }))).toEqual({
      gate: { inFlight: true, pending: null },
      seek: 9,
    })
  })

  it('goes idle when nothing was held back', () => {
    expect(settled(inFlight())).toEqual({ gate: idle, seek: null })
  })

  /* Loop enforcement writes `currentTime` straight onto the element — it is a
     correctness rule rather than a drag, and it does not ask the gate. The
     `seeked` it fires still arrives here, so a settle against an idle gate has to
     be a no-op rather than something that leaves it wedged open. */
  it('is a no-op when no seek was in flight at all', () => {
    expect(settled(idle)).toEqual({ gate: idle, seek: null })
  })
})
