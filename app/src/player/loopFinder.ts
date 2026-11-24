/* #121. The Loop Finder's arithmetic, apart from the screen that draws it.

   One 8 count is found by hand, as where its first 1 is and how long it lasts.
   Everything else follows from those two numbers: the bars are a fixed grid
   laid from the first 1, and the wiggle only moves where each loop starts and
   stops around its bars, never the grid itself. */

export type Count = {
  /* Where the first bar starts: the first press. */
  readonly one: number
  readonly length: number
}

export type Bar = {
  readonly start: number
  readonly end: number
}

/* One loop: a bar, or bars joined across the lines between them, with the
   reach either side that makes it practisable. */
export type Group = Bar & {
  readonly first: number
  readonly last: number
  readonly a: number
  readonly b: number
  readonly name: string
  readonly label: string
}

/* As picked at the mockup gate: two counts either way, so a bar leads in on
   7 8 and runs on to 1 2. */
export const WIGGLE = 50

/* A bar may end this close past the end of the clip and still count as
   whole: presses and lengths are floats, and a last bar that lands on the end
   would otherwise come and go with the rounding. */
const ROUNDING = 0.01

/* Every whole bar from the first 1 to the end of the clip. Nothing before the
   first 1: whatever comes before it, an intro or a walk-on, is not a bar. */
export const barsFrom = ({ one, length }: Count, duration: number): readonly Bar[] => {
  const bars: Bar[] = []

  for (let k = 0; one + (k + 1) * length <= duration + ROUNDING; k++) {
    bars.push({ start: one + k * length, end: one + (k + 1) * length })
  }

  return bars
}

const named = (first: number, last: number) =>
  first === last
    ? { name: `Bar ${first + 1}`, label: `${first + 1}` }
    : { name: `Bars ${first + 1}–${last + 1}`, label: `${first + 1}–${last + 1}` }

/* The bars as loops. Bars joined across a line make one, and each reaches past
   itself by `wiggle` percent of a bar: half of it a lead-in before its 1, half
   a run-on past the next 1. At 100 a one-bar loop is twice the bar. `joins`
   holds k for the line between bar k and bar k + 1. */
export const groupsOf = ({
  bars,
  joins,
  length,
  wiggle,
  duration,
}: {
  readonly bars: readonly Bar[]
  readonly joins: readonly number[]
  readonly length: number
  readonly wiggle: number
  readonly duration: number
}): readonly Group[] => {
  const reach = (length * wiggle) / 100 / 2
  const runs: { first: number; last: number; start: number; end: number }[] = []

  bars.forEach((bar, k) => {
    const run = runs.at(-1)

    if (run && joins.includes(k - 1)) {
      run.last = k
      run.end = bar.end
    } else {
      runs.push({ first: k, last: k, start: bar.start, end: bar.end })
    }
  })

  return runs.map((run) => ({
    ...run,
    a: Math.max(0, run.start - reach),
    b: Math.min(duration, run.end + reach),
    ...named(run.first, run.last),
  }))
}

/* The counts a reach takes in either side of a bar, as a dancer counts them:
   at 50%, two counts each way, so it leads in on 7 8 and runs on to 1 2. A
   reach of part of a count is said as a number. */
export const countsReached = (wiggle: number) => {
  const counts = (wiggle / 100) * 4

  if (counts === 0) return { before: '–', after: '–' }

  if (!Number.isInteger(counts) || counts > 8) {
    const said = `${Math.round(counts * 10) / 10} counts`

    return { before: said, after: said }
  }

  return {
    before: Array.from({ length: counts }, (_, k) => 9 - counts + k).join(' '),
    after: Array.from({ length: counts }, (_, k) => k + 1).join(' '),
  }
}

/* Eight beats to an 8 count. */
export const bpmOf = (length: number) => Math.round((8 * 60) / length)

/* Enter while the finder counts. The first press is the 1 the bars start from,
   and each after it ends an 8 count; once `over` of them are in, the next
   press starts again. */
export const pressed = ({
  marks,
  over,
  at,
}: {
  readonly marks: readonly number[]
  readonly over: number
  readonly at: number
}): readonly number[] =>
  marks.length === 0 || marks.length === over + 1 ? [at] : [...marks, at]

/* How far the presses strayed: the furthest any one 8 count was from their
   average. Nothing to say over a single 8 count, which is its own average. */
export const spreadOf = (marks: readonly number[], length: number) =>
  marks.length > 2
    ? Math.max(
        ...marks.slice(1).map((mark, k) => Math.abs(mark - (marks[k] ?? mark) - length)),
      )
    : null
