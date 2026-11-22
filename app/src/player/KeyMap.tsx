import { Key } from './Key'
import { KEY_TIMINGS } from './keys'
import { NUDGE, SCRUB_STEP } from './loopRange'
import { SPEED_MAX, SPEED_MIN, SPEED_STEP } from './speed'

type Row = {
  readonly keys: readonly string[]
  readonly does: string
  /* Small lines under it: how a held key repeats, and the like. */
  readonly notes?: readonly string[]
}

const T = KEY_TIMINGS

/* #115. Every key the player answers to, grouped. It repeats the hint line on
   purpose: the hint says what the next key does, and this is the whole map.
   The numbers are the ones the keys run on, read from where they are set, so
   the map cannot say one thing while the keys do another. */
const KEY_MAP: readonly { readonly group: string; readonly rows: readonly Row[] }[] = [
  {
    group: 'Play',
    rows: [
      { keys: ['space'], does: 'plays and pauses' },
      { keys: ['f'], does: 'zen mode' },
      { keys: ['esc'], does: 'leaves zen mode' },
    ],
  },
  {
    group: 'Arrows',
    rows: [
      {
        keys: ['↑', '↓'],
        does: `speed ±${SPEED_STEP}, ${SPEED_MIN}x to ${SPEED_MAX}x`,
        notes: [`held: after ${T.speedHoldDelay}ms, a step every ${T.speedRepeatEvery}ms`],
      },
      {
        keys: ['←', '→'],
        does: `scrub ${SCRUB_STEP}s, inside the loop`,
        notes: [
          `held: after ${T.scrubHoldDelay}ms, a step every ${T.scrubRepeatEvery}ms (YouTube ${T.scrubRepeatEveryYouTube}ms)`,
          `while playing: pauses, plays on ${T.resumeAfter / 1000}s after the last step`,
        ],
      },
    ],
  },
  {
    group: 'Loop',
    rows: [
      { keys: ['enter'], does: 'sets A, then B' },
      { keys: ['s'], does: 'saves the loop, or updates the open one' },
      { keys: ['⇧s'], does: 'saves it as a new one' },
      { keys: ['enter'], does: 'in the name field: saves' },
      { keys: ['←', '→'], does: `on a focused A or B handle: moves it ${NUDGE}s` },
      { keys: ['home', 'end'], does: 'on a focused handle: to the start or end' },
    ],
  },
]

/* In the corner, closed until it is clicked, so it is there for whoever wants
   it and in nobody's way: closed, it hugs its label, and only open does it
   take the width the map needs. A `details` because opening and closing is
   all it does, and the browser already does that. */
export function KeyMap() {
  return (
    <details
      aria-label="Keys"
      className="fixed right-3 bottom-3 z-40 rounded-xl bg-panel px-3 py-2 text-xs text-ink/80 shadow-lg ring-1 ring-ink/10 open:w-96 open:p-3"
    >
      <summary className="cursor-pointer font-semibold">Keys</summary>
      {KEY_MAP.map(({ group, rows }) => (
        <section key={group} aria-label={group} className="mt-3">
          <h3 className="mb-1.5 text-[10px] font-semibold tracking-wider text-ink/40 uppercase">
            {group}
          </h3>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5">
            {rows.map(({ keys, does, notes = [] }) => (
              <div key={keys.join() + does} className="contents">
                <dt className="flex flex-wrap items-start gap-1">
                  {keys.map((key) => (
                    <Key key={key}>{key}</Key>
                  ))}
                </dt>
                <dd>
                  {does}
                  {notes.map((note) => (
                    <span key={note} className="block tabular-nums text-ink/45">
                      {note}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </details>
  )
}
