import type { Clip } from './clip'

export const orderings = [
  {
    id: 'added',
    label: 'Recent',
    compare: (a: Clip, b: Clip) => b.added.localeCompare(a.added),
  },
  {
    id: 'name',
    label: 'Name',
    compare: (a: Clip, b: Clip) => a.name.localeCompare(b.name),
  },
  {
    id: 'loops',
    label: 'Most looped',
    compare: (a: Clip, b: Clip) => b.loops - a.loops,
  },
  /* #12 — the chip that answers "what am I working on". **Recent** above is the
     day a clip was uploaded and never changes again, so a clip added in July and
     drilled last night sorts below six that were added and never opened.

     `''` for a clip never opened, which puts the whole never-opened tail
     below every clip that has been — most of a real library. A fallback date
     would be worse than wrong: it would let one of them tie with a clip that
     genuinely was opened then.

     Last of the four rather than beside **Recent**, so Recent still leads the
     row. It is also where the grid jumps back to after an add (`ClipsScreen`),
     but not where it starts: that is `OPENING_ORDERING` below. */
  {
    id: 'opened',
    label: 'Last opened',
    compare: (a: Clip, b: Clip) =>
      (b.opened ?? '').localeCompare(a.opened ?? ''),
  },
] as const

export type OrderingId = (typeof orderings)[number]['id']

/* #73. What the grid is ordered by when the dashboard opens: **Last opened**,
   because a dancer coming back is usually after the clip they were just
   practising, and **Recent** buries it under every clip added since. Named
   rather than read off the row's first chip, so the order the chips are read
   in and the one the grid starts on can each be decided on its own. */
export const OPENING_ORDERING: OrderingId = 'opened'
