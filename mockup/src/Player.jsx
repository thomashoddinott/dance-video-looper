import { useEffect, useRef, useState } from 'react'
import YouTubeFrame from './YouTubeFrame.jsx'
import { KEY_DEFAULTS } from './keys.js'
import { ERRORS } from './youtube.js'

const NUDGE = 1
const SPEED_STEP = 0.05
const SPEED_STEP_BIG = 0.1
const SPEED_MIN = 0.1
const SPEED_MAX = 2
const MIN_LOOP = 0.2

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function formatTenths(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds - mins * 60
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`
}

/* #115 + #116: every key the player answers to, in one place. It repeats the
   hint line on purpose: the hint says what the next key does, this is the
   whole map. The timings are frozen, read from keys.js. Wide screens only,
   like the other experiments. */
const K = KEY_DEFAULTS
const KEY_MAP = [
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
        notes: [`held: after ${K.speedHoldDelay}ms, a step every ${K.speedRepeatEvery}ms`],
      },
      {
        keys: ['←', '→'],
        does: `scrub ${K.scrubStep}s, inside the loop`,
        notes: [
          `held: after ${K.scrubHoldDelay}ms, a step every ${K.scrubRepeatEvery}ms (YouTube ${K.scrubRepeatEveryYouTube}ms)`,
          `while playing: pauses, plays on ${K.resumeAfter}s after the last step`,
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
      {
        keys: ['←', '→'],
        does: `on a focused A or B handle: moves it ${NUDGE}s`,
      },
      { keys: ['home', 'end'], does: 'on a focused handle: to the start or end' },
    ],
  },
]

function KeysPanel() {
  return (
    <details className="fixed right-3 bottom-3 z-40 hidden rounded-xl bg-panel px-3 py-2 text-xs text-ink/80 shadow-lg ring-1 ring-ink/10 open:w-96 open:p-3 lg:block">
      <summary className="cursor-pointer font-semibold">Keys</summary>
      {KEY_MAP.map(({ group, rows }) => (
        <section key={group} className="mt-3">
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
                    <span key={note} className="block text-ink/45 tabular-nums">
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

/* #107 spike. Every whole bar from the first 1 to the end of the clip, laid end
   to end. Nothing before the first 1: whatever comes before it, an intro or a
   walk-on, is not a bar. */
function barsFrom({ one, length }, duration) {
  const made = []

  for (let k = 0; one + (k + 1) * length <= duration + 0.01; k++) {
    made.push({ start: one + k * length, end: one + (k + 1) * length })
  }

  return made
}

/* #107 spike. The bars as loops: bars joined across a line make one, and each
   reaches past itself by `wiggle` percent of a bar, half of it a lead-in
   before its 1, half a run-on past the next 1. At 100 a one-bar loop is twice
   the bar. `joins` holds k for the line between bar k and bar k + 1. */
function groupsOf(bars, joins, { length }, wiggle, duration) {
  const reach = (length * wiggle) / 100 / 2
  const groups = []

  bars.forEach((bar, k) => {
    const last = groups[groups.length - 1]

    if (last && joins.includes(k - 1)) {
      last.last = k
      last.end = bar.end
    } else {
      groups.push({ first: k, last: k, start: bar.start, end: bar.end })
    }
  })

  return groups.map((group) => ({
    ...group,
    a: Math.max(0, group.start - reach),
    b: Math.min(duration, group.end + reach),
    label: group.first === group.last ? `${group.first + 1}` : `${group.first + 1}–${group.last + 1}`,
    name:
      group.first === group.last
        ? `Bar ${group.first + 1}`
        : `Bars ${group.first + 1}–${group.last + 1}`,
  }))
}

/* #107 spike. The counts a reach takes in, either side of a bar: at 50%, two
   counts each way, so it leads in on 7 8 and runs on to 1 2. */
function countsReached(wiggle) {
  const counts = (wiggle / 100) * 8 / 2

  if (counts === 0) return { before: '–', after: '–' }
  if (!Number.isInteger(counts) || counts > 8) {
    const said = `${Math.round(counts * 10) / 10} counts`
    return { before: said, after: said }
  }

  const before = Array.from({ length: counts }, (_, k) => 9 - counts + k)
  const after = Array.from({ length: counts }, (_, k) => k + 1)
  return { before: before.join(' '), after: after.join(' ') }
}

/* #107 spike. One 8-count, as length and tempo: eight beats in it. */
function countReadout(length) {
  return `${length.toFixed(2)}s · ${Math.round((8 * 60) / length)} BPM`
}

function formatSpeed(speed) {
  return String(Math.round(speed * 100) / 100)
}

/* Written once, because the panel says it twice: under the field as what a write
   would keep, and under each entry as what one already did. The line above the
   list is a preview of the line below it, so two copies would be free to drift. */
function summarise(loop, speed) {
  return `${formatTime(loop.a)} - ${formatTime(loop.b)} · ${formatSpeed(speed)}x`
}

/* Ticking saved loops chains them into one: earliest start to latest end. Drill
   segment 1, drill segment 2, then run 1+2 — that habit is what this is for, and
   it beats saving a third loop that duplicates the other two.

   Whether the segments actually meet is deliberately NOT a condition. A and B
   are dragged by hand and never land on the same frame twice, so a near miss
   would otherwise decide whether the box is even there, which is a rule you can
   feel but not see. Tick whatever you like; the span is what you get. */

const inTimeOrder = (loops) => [...loops].sort((one, two) => one.a - two.a)

/* Sorted by where each loop starts — the only ordering under which a chain reads
   down the list as one run. The end is the furthest B in the selection rather
   than the last row's, which is the same thing for segments laid end to end and
   still a valid loop when one of them happens to swallow another. */
function spanOf(loops) {
  const [first] = inTimeOrder(loops)
  return {
    a: first.a,
    b: loops.reduce((end, loop) => Math.max(end, loop.b), first.b),
    speed: first.speed,
  }
}

const CONTROL = 'bg-control text-ink/90 hover:bg-control-hi'

/* Inline SVG rather than glyphs: ⏮ and ⏸ carry emoji presentation on macOS and
   iOS, so they rendered as colour emoji regardless of the surrounding text. */

function Glyph({ size = 'h-7 w-7', outline, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={size}
      fill={outline ? 'none' : 'currentColor'}
      stroke={outline ? 'currentColor' : 'none'}
      strokeWidth={outline ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const StartIcon = () => (
  <Glyph>
    <rect x="5" y="5" width="2.8" height="14" rx="1.2" />
    <path d="M20 5v14l-10-7z" />
  </Glyph>
)

const LoopIcon = () => (
  <Glyph outline>
    <path d="M17 2.5l3.5 3.5L17 9.5" />
    <path d="M3.5 11.5V10a4 4 0 0 1 4-4h13" />
    <path d="M7 21.5L3.5 18 7 14.5" />
    <path d="M20.5 12.5V14a4 4 0 0 1-4 4h-13" />
  </Glyph>
)

const PlayIcon = () => (
  <Glyph>
    <path d="M7.5 4.5l12 7.5-12 7.5z" />
  </Glyph>
)

const PauseIcon = () => (
  <Glyph>
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </Glyph>
)

const ExpandIcon = () => (
  <Glyph size="h-5 w-5" outline>
    <path d="M4 9V4h5" />
    <path d="M20 9V4h-5" />
    <path d="M4 15v5h5" />
    <path d="M20 15v5h-5" />
  </Glyph>
)

/* #123: an arrow down into a tray, for a clip whose bytes the app has */
const DownloadIcon = () => (
  <Glyph size="h-5 w-5" outline>
    <path d="M12 4v11" />
    <path d="M7 10l5 5 5-5" />
    <path d="M5 20h14" />
  </Glyph>
)

/* #123: a link, for a YouTube entry, which can only be sent as one */
const LinkIcon = () => (
  <Glyph size="h-5 w-5" outline>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Glyph>
)

/* #123. Where a YouTube loop can be sent: the video, from A. A link cannot
   say where to stop. youtu.be with `t` opens a Short in the ordinary player,
   which is the only one that takes a start. */
const linkFrom = (videoId, a) => `youtu.be/${videoId}?t=${Math.floor(a)}`

/* #123 mockup gate only: where the control sits, to pick from */
const DOWNLOAD_SPOTS = [
  { key: 'A', label: 'On each saved loop' },
  { key: 'B', label: 'Over the clip' },
  { key: 'C', label: 'Beside Save' },
]

function DownloadSpotPicker({ spot, onSpot }) {
  return (
    <div className="fixed bottom-3 left-3 z-40 flex items-center gap-1 rounded-xl bg-panel p-1.5 text-xs shadow-lg ring-1 ring-ink/10">
      <span className="px-1.5 font-semibold text-ink/60">Download</span>
      {DOWNLOAD_SPOTS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={spot === key}
          onClick={() => onSpot(key)}
          className={`rounded-lg px-2.5 py-1 font-semibold ${
            spot === key ? 'bg-accent text-on-accent' : 'bg-control text-ink/70 hover:bg-control-hi'
          }`}
        >
          {key} · {label}
        </button>
      ))}
    </div>
  )
}

const CloseIcon = () => (
  <Glyph size="h-5 w-5" outline>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Glyph>
)

const BackIcon = () => (
  <Glyph size="h-5 w-5">
    <path d="M11 6v12l-8-6z" />
    <path d="M21 6v12l-8-6z" />
  </Glyph>
)

const ForwardIcon = () => (
  <Glyph size="h-5 w-5">
    <path d="M13 6v12l8-6z" />
    <path d="M3 6v12l8-6z" />
  </Glyph>
)

function SeekButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-lg px-5 py-3 active:scale-95 ${CONTROL}`}
    >
      {children}
    </button>
  )
}

function SpeedStepper({ speed, onChange }) {
  const step = (delta) => () =>
    onChange(
      Math.round(clamp(speed + delta, SPEED_MIN, SPEED_MAX) * 100) / 100,
    )

  const button = `rounded-lg px-3 py-2.5 text-sm font-semibold active:scale-95 ${CONTROL}`

  return (
    <div className="flex items-stretch gap-1.5">
      <button type="button" aria-label="Much slower" onClick={step(-SPEED_STEP_BIG)} className={button}>
        &minus;&minus;
      </button>
      <button type="button" aria-label="Slower" onClick={step(-SPEED_STEP)} className={button}>
        &minus;
      </button>
      <output
        aria-label="Playback speed"
        className="min-w-14 rounded-lg bg-panel px-3 py-2.5 text-center text-sm font-semibold tabular-nums text-ink"
      >
        {formatSpeed(speed)}
      </output>
      <button type="button" aria-label="Faster" onClick={step(SPEED_STEP)} className={button}>
        +
      </button>
      <button type="button" aria-label="Much faster" onClick={step(SPEED_STEP_BIG)} className={button}>
        ++
      </button>
    </div>
  )
}

function LoopSlider({
  duration,
  time,
  loop,
  onScrub,
  onLoopChange,
  onHold,
  tone = 'accent',
  marks,
  lane,
}) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(null)

  const timeAt = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect()
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration
  }

  const startDrag = (handle) => (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(handle)
    onHold?.(true)
  }

  const onPointerMove = (event) => {
    if (!dragging) return
    const t = timeAt(event.clientX)
    const next =
      dragging === 'a'
        ? { ...loop, a: clamp(t, 0, loop.b - MIN_LOOP) }
        : { ...loop, b: clamp(t, loop.a + MIN_LOOP, duration) }
    onLoopChange(next)
    onScrub(next[dragging])
  }

  const endDrag = (event) => {
    if (!dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDragging(null)
    onHold?.(false)
  }

  const pct = (t) => (duration ? (t / duration) * 100 : 0)

  /* #107 spike: once the Loop Finder has its 8-count, the slider is the bars.
     Every one is drawn grey, the one being tried in the finder's colour with
     its lead-in and run-on behind it. The line between two bars joins them
     into one loop, and splits them again. */
  if (lane) {
    const active = lane.groups.find((group) => group.first === lane.trying) ?? null
    const joined = (k) => lane.joins.includes(k)

    return (
      <div className="relative h-24 select-none">
        {active && (
          <>
            <span
              className="absolute top-1 -translate-x-1/2 text-sm tabular-nums text-ink/70"
              style={{ left: `${pct(active.a)}%` }}
            >
              {formatTime(active.a)}
            </span>
            <span
              className="absolute bottom-1 -translate-x-1/2 text-sm tabular-nums text-ink/70"
              style={{ left: `${pct(active.b)}%` }}
            >
              {formatTime(active.b)}
            </span>
          </>
        )}
        <div
          className="absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 cursor-pointer rounded-md bg-control/60"
          ref={trackRef}
          onPointerDown={(event) => onScrub(timeAt(event.clientX))}
        >
          {active && (
            <div
              className="absolute inset-y-0 rounded-md bg-finder/25"
              style={{ left: `${pct(active.a)}%`, width: `${pct(active.b - active.a)}%` }}
            />
          )}
          {lane.groups.map((group) => (
            <button
              key={group.first}
              type="button"
              aria-label={group.name}
              aria-pressed={group === active}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => lane.onTry(group)}
              className={`absolute inset-y-1.5 overflow-hidden rounded text-[10px] font-semibold tabular-nums ${
                group === active ? 'bg-finder text-white' : 'bg-ink/20 text-ink/60 hover:bg-finder/40'
              }`}
              style={{
                left: `calc(${pct(group.start)}% + 1px)`,
                width: `calc(${pct(group.end - group.start)}% - 2px)`,
              }}
            >
              {group.label}
            </button>
          ))}
          {lane.bars.slice(1).map((bar, k) => (
            <button
              key={bar.start}
              type="button"
              aria-label={`${joined(k) ? 'Split' : 'Join'} bars ${k + 1} and ${k + 2}`}
              title={joined(k) ? 'Split' : 'Join'}
              aria-pressed={joined(k)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => lane.onJoin(k)}
              className="group absolute -inset-y-1.5 z-10 flex w-3 -translate-x-1/2 cursor-pointer justify-center"
              style={{ left: `${pct(bar.start)}%` }}
            >
              {/* Joined, the line keeps only its ends, so a label across it reads */}
              {joined(k) ? (
                <span className="flex h-full flex-col justify-between py-1.5">
                  <span className="block h-1.5 w-0.5 rounded bg-white/80 group-hover:bg-ink/60" />
                  <span className="block h-1.5 w-0.5 rounded bg-white/80 group-hover:bg-ink/60" />
                </span>
              ) : (
                <span className="block h-full w-0.5 rounded group-hover:bg-ink/60" />
              )}
            </button>
          ))}
          <div
            className="pointer-events-none absolute -inset-y-1 z-20 w-0.5 -translate-x-1/2 rounded bg-ink/80"
            style={{ left: `${pct(time)}%` }}
          />
        </div>
      </div>
    )
  }

  // A sits above the track with its point down, B below with its point up —
  // the same arrangement LoopTube uses, so the labels never collide.
  const handle =
    'absolute flex h-10 w-10 touch-none items-center justify-center ' +
    '-translate-x-1/2 cursor-grab active:cursor-grabbing'
  /* #107 spike: the Loop Finder colours the slider its own */
  const drop = `h-4 w-4 shadow ${tone === 'finder' ? 'bg-finder' : 'bg-ink'}`

  return (
    <div className="relative h-24 select-none">
      <div
        ref={trackRef}
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 cursor-pointer rounded-full bg-control"
        onPointerDown={(event) => onScrub(timeAt(event.clientX))}
      >
        <div
          className={`absolute inset-y-0 rounded-full ${tone === 'finder' ? 'bg-finder' : 'bg-accent'}`}
          style={{ left: `${pct(loop.a)}%`, width: `${pct(loop.b - loop.a)}%` }}
        />
        {/* #107 spike: each press while the Loop Finder counts */}
        {marks?.map((mark) => (
          <div
            key={mark}
            className="pointer-events-none absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded bg-finder"
            style={{ left: `${pct(mark)}%` }}
          />
        ))}
        <div
          className="pointer-events-none absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-ink/80"
          style={{ left: `${pct(time)}%` }}
        />
      </div>

      <div
        role="slider"
        aria-label="Loop start"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={loop.a}
        tabIndex={0}
        onPointerDown={startDrag('a')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`${handle} top-1/2 -translate-y-full`}
        style={{ left: `${pct(loop.a)}%` }}
      >
        <span className={`${drop} rounded-[50%_50%_50%_0] rotate-45`} />
      </div>
      <span
        className="absolute top-1/2 mt-3 -translate-x-1/2 text-sm tabular-nums text-ink/70"
        style={{ left: `${pct(loop.a)}%` }}
      >
        {formatTime(loop.a)}
      </span>

      <div
        role="slider"
        aria-label="Loop end"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={loop.b}
        tabIndex={0}
        onPointerDown={startDrag('b')}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`${handle} top-1/2`}
        style={{ left: `${pct(loop.b)}%` }}
      >
        <span className={`${drop} rounded-[0_50%_50%_50%] rotate-45`} />
      </div>
      <span
        className="absolute top-1/2 -mt-8 -translate-x-1/2 text-sm tabular-nums text-ink/70"
        style={{ left: `${pct(loop.b)}%` }}
      >
        {formatTime(loop.b)}
      </span>
    </div>
  )
}

function Key({ children }) {
  return (
    <kbd className="rounded bg-control px-1.5 py-0.5 font-sans text-ink/70">
      {children}
    </kbd>
  )
}

function BigButton({ label, active, onClick, children }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-16 w-24 items-center justify-center rounded-xl transition active:scale-95 ${
          active
            ? 'bg-gradient-to-br from-accent to-accent-2 text-on-accent shadow-lg'
            : CONTROL
        }`}
      >
        {children}
      </button>
      <span className="text-xs font-semibold tracking-wide text-ink/60">
        {label}
      </span>
    </div>
  )
}

/* Where you are in the clip, drawn on the clip itself, and how you go somewhere
   else. Deliberately the same shape as the loop slider below it, because the two
   answer different questions about the same timeline: this one is "where am I",
   that one is "which few seconds am I working on". Neither can do the other's job.

   Rides inside the video wrapper rather than under the card, so it survives zen
   mode — which is where it matters most, since the whole control strip is hidden
   there and the clip is otherwise playing completely blind.

   The container stays `pointer-events-none` and only the grab strip takes them
   back: the video surface is the play/pause target, so a bar that swallowed the
   whole bottom of the frame would cost you tapping the clip to pause it. */
/* The drag is 1:1 with the finger, and stays that way. Velocity-adaptive gain
   and the iPhone's drag-down precision modes were both built here and tried
   against it on 2026-09-07; both lost. The bar felt wrong because seeks were
   queueing behind the finger, not because a pixel was worth the wrong number of
   seconds, and no gain curve fixes latency. Gain that varies also gives up the
   one property this has and the loop slider does not — drag out and back and you
   land exactly where you started.

   What buys precision instead is #21's rescale, which is reversible, visible,
   and already there. */
function VideoProgress({
  time,
  duration,
  loop,
  looping,
  onScrub,
  onHold,
  rounded,
}) {
  const track = useRef(null)
  const [dragging, setDragging] = useState(false)

  /* Whether the loop pens the playhead in. A loop spanning the whole clip
     constrains nothing, so scrubbing is free — which is the case that matters,
     because it is how you get to look at the rest of the clip at all.

     The epsilon is not fussiness: A and B arrive from a drag across real
     geometry, so "the whole clip" is 0.0000001 short of it about half the time. */
  const penned =
    looping && duration > 0 && loop.b > loop.a && (loop.a > 0.05 || loop.b < duration - 0.05)

  /* The bar spans the loop, not the clip, whenever there is a loop to span. Six
     seconds of a 2:28 clip is 4% of the width — technically scrubbable, actually
     impossible, and the narrower the loop the worse it gets, which is backwards:
     a tight loop is exactly when you most need to move within it.

     Rescaling turns that around. The full width always buys you the loop, so the
     tighter the loop the finer the scrub — 40x here, and it costs nothing to
     reach because it is the width you were already dragging across.

     It also subsumes the clamping this used to do. Nothing has to refuse a drag
     or dim what is out of reach: outside the loop is simply off the end of the
     bar, and a ratio cannot leave 0..1. */
  const domain = penned ? { from: loop.a, to: loop.b } : { from: 0, to: duration }
  const span = domain.to - domain.from

  const pct = (seconds) =>
    span > 0 ? Math.min(Math.max(((seconds - domain.from) / span) * 100, 0), 100) : 0

  const timeAt = (clientX) => {
    const rect = track.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return domain.from

    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)

    return domain.from + ratio * span
  }

  const grab = (event) => {
    setDragging(true)
    onHold?.(true)
    onScrub(timeAt(event.clientX))
  }

  const move = (event) => {
    if (dragging) onScrub(timeAt(event.clientX))
  }

  const letGo = () => {
    setDragging(false)
    onHold?.(false)
  }

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 select-none bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 ${rounded}`}
    >

      {/* Two facts, and the row has room for both. Left: what the bar spans, shown
          only when that is no longer the whole clip — without it a playhead
          sitting mid-bar at 01:03 of a 02:28 clip is simply wrong-looking, and
          the rescale is invisible. Right: where you actually are, unchanged and
          always absolute, because that is the number you came for. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] tabular-nums text-white/60 drop-shadow">
          {penned ? `${formatTime(domain.from)} – ${formatTime(domain.to)}` : ''}
        </span>
        <span className="text-[11px] tabular-nums text-white/80 drop-shadow">
          {formatTime(time)} / {formatTime(duration)}
        </span>
      </div>

      {/* A 2px line is not a touch target. The padding gives the thumb ~28px to
          land in while the line stays hairline-thin, and `touch-none` stops the
          drag being read as a page scroll on a phone. */}
      <div
        ref={track}
        className="group pointer-events-auto -my-3 cursor-pointer touch-none py-3"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          grab(event)
        }}
        onPointerMove={move}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId)
          letGo()
        }}
        onPointerCancel={letGo}
      >
        {/* The bar thickens under the thumb the way the iPhone's does. It is not
            decoration — it is the only confirmation that the drag was caught,
            and on a phone the finger is covering the knob. */}
        <div
          className={`relative w-full rounded-full bg-white/25 transition-[height] duration-150 ${
            dragging ? 'h-1.5' : 'h-0.5 group-hover:h-1'
          }`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${pct(time)}%` }}
          />
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-[height,width,transform] duration-150 ${
              dragging
                ? 'h-4 w-4 scale-100'
                : 'h-3 w-3 scale-0 group-hover:scale-100'
            }`}
            style={{ left: `${pct(time)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/* #20 spike only. What the IFrame API actually does on this device, read off
   while the clip is being used, so the phone can answer the questions a
   compatibility table cannot. */
const median = (values) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((one, two) => one - two)
  return sorted[Math.floor(sorted.length / 2)]
}

function SpikeReadings({ open, rates, speed, actualRate, readings, onCheckSeeks }) {
  const ms = (value) => (value === null ? '—' : `${Math.round(value)} ms`)
  const cadence = median(readings.cadence)
  const overshoot = readings.overshoot.map((past) => past * 1000)

  return (
    <details open={open} className="mt-4 rounded-xl bg-shell/60 p-4 text-xs text-ink/70">
      <summary className="cursor-pointer text-xs font-bold tracking-widest text-ink/50">
        SPIKE READINGS
      </summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
        <dt>Rates YouTube offers</dt>
        <dd>{rates.length ? rates.join(', ') : '—'}</dd>
        <dt>Speed asked / playing</dt>
        <dd>
          {formatSpeed(speed)}x / {formatSpeed(actualRate)}x
        </dd>
        <dt>Time reported every</dt>
        <dd>
          {ms(cadence)} median, {ms(readings.cadence.length ? Math.max(...readings.cadence) : null)} worst
          {' '}({readings.cadence.length} reports)
        </dd>
        <dt>Loop ran past B by</dt>
        <dd>
          {ms(median(overshoot))} median, {ms(overshoot.length ? Math.max(...overshoot) : null)} worst
          {' '}({overshoot.length} loops)
        </dd>
        <dt>Seek error</dt>
        <dd>
          {readings.seekErrors.length ? readings.seekErrors.map((error) => `${error} ms`).join(', ') : '—'}{' '}
          <button type="button" onClick={onCheckSeeks} className="ml-1 font-medium text-accent hover:underline">
            Check
          </button>
        </dd>
      </dl>
    </details>
  )
}

/* #81. Tailwind's `lg` (1024px), read in script rather than CSS because the
   controls and the loops move to another place in the tree on a wide screen,
   which a class cannot do. */
const WIDE = '(min-width: 64rem)'

function useMedia(media) {
  const [matches, setMatches] = useState(() => window.matchMedia(media).matches)

  useEffect(() => {
    const query = window.matchMedia(media)
    const update = () => setMatches(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [media])

  return matches
}

function Player({
  clip,
  onBack,
  onDuration,
  tryNewUi = false,
  onTryNewUi,
  countdown = true,
  onCountdown,
}) {
  /* #20 spike: a YouTube entry plays in the IFrame player, which hands back a
     surface shaped like the <video> this ref otherwise holds. Nothing below the
     render knows which it got. */
  const youtube = clip.source === 'youtube'
  const videoRef = useRef(null)
  /* What YouTube is actually doing, as against what was asked of it. */
  const [actualRate, setActualRate] = useState(1)
  const [rates, setRates] = useState([])
  const [ytError, setYtError] = useState(null)
  /* Before the first play the tap has to reach YouTube's own button, because
     iOS may insist that playback starts inside the iframe. After it, a layer
     over the iframe takes the taps, so play/pause is ours and the keyboard
     focus stays on the page where the shortcuts listen. */
  const [started, setStarted] = useState(false)
  /* The spike's instruments. Filled by the loop tick and the seek check below,
     copied out twice a second for the panel to draw. */
  const readingsRef = useRef({ cadence: [], overshoot: [], lastRaw: null, lastRawAt: 0 })
  const [readings, setReadings] = useState({ cadence: [], overshoot: [], seekErrors: [] })
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [looping, setLooping] = useState(true)
  const [loop, setLoop] = useState({ a: 0, b: 0 })
  const [speed, setSpeed] = useState(1)
  /* #81: an entry can arrive with loops already saved against it */
  const [saved, setSaved] = useState(clip.savedLoops ?? [])
  const [chain, setChain] = useState([])
  const [name, setName] = useState('')
  const [nextId, setNextId] = useState((clip.savedLoops?.length ?? 0) + 1)
  /* Which saved loop the controls are currently *on*. Set only by opening one
     from the list, and let go by every write (#71). Saving used to set it too,
     so the next section framed and saved went over the loop just kept. Once a
     loop is opened, Update corrects it and "Save as new" is the deliberate way
     to a second one: the common move after loading a loop is to fix it. */
  const [editingId, setEditingId] = useState(null)
  const [nextPoint, setNextPoint] = useState('a')
  const [zen, setZen] = useState(false)
  /* #94, #96, on trial: whether the new layout has the A/B slider out. Put
     away to begin with, and brought out by the Slider checkbox alone. */
  const [sliderOut, setSliderOut] = useState(false)
  /* #105, retrofitted from the build: a 3, 2, 1 count before the loop comes
     round, on a wide screen with the Countdown pill on. Null while nothing is
     counting. */
  const [count, setCount] = useState(null)
  /* #107 spike, mockup only: the Loop Finder, a mode of its own. Null while
     off. On, it holds the 8-count found (`bar`, null until confirmed), the
     bar being tried, and what the player was set to before, to go back to. */
  const [finder, setFinder] = useState(null)
  /* How far each bar's loop reaches past it, as a percentage of a bar. */
  const [wiggle, setWiggle] = useState(50)
  /* How many 8-counts the tempo is taken over, and the presses so far: the
     first on a 1, then one at the end of each 8-count. */
  const [over, setOver] = useState(1)
  const [marks, setMarks] = useState([])
  const finderEnterRef = useRef(null)
  /* #123 mockup gate: where the download control is drawn */
  const [downloadSpot, setDownloadSpot] = useState('A')

  /* #86, on trial. With **Try new UI** on, a wide screen puts the controls and
     the loops in a column left of the clip, and the clip has the rest. Off, or
     on a narrower screen, the player is one column, as it was before #81. */
  const wide = useMedia(WIDE)
  const columns = wide && tryNewUi

  // the rAF loop and the key handler read these, so neither needs re-subscribing
  const loopRef = useRef(loop)
  const loopingRef = useRef(looping)
  const nextPointRef = useRef(nextPoint)
  /* #116: what the keys need without re-subscribing — the timings, the speed,
     the seek, and the held key's timers */
  const keysRef = useRef(KEY_DEFAULTS)
  const speedRef = useRef(speed)
  const scrubRef = useRef(null)
  const togglePlayRef = useRef(null)
  const heldRef = useRef(null)
  const scrubbedToRef = useRef(null)
  const resumeRef = useRef(null)
  const pausedByScrubRef = useRef(false)
  /* #116: what the last key did, shown over the clip for a moment */
  const [badge, setBadge] = useState(null)

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    if (!badge) return
    const gone = setTimeout(() => setBadge(null), badge.for ?? 900)
    return () => clearTimeout(gone)
  }, [badge])
  const countingInRef = useRef(false)
  const saveLoopRef = useRef(null)
  const saveAsNewRef = useRef(null)

  useEffect(() => {
    loopRef.current = loop
    loopingRef.current = looping
    nextPointRef.current = nextPoint
  }, [loop, looping, nextPoint])

  /* #105. The loop tick subscribes once, so it reads whether to count through
     a ref; and the count runs a second a number, then plays the clip on. */
  useEffect(() => {
    countingInRef.current = wide && countdown
  }, [wide, countdown])

  useEffect(() => {
    if (count === null) return

    const next = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1)
        return
      }

      setCount(null)
      videoRef.current?.play()
    }, 1000)

    return () => clearTimeout(next)
  }, [count])

  /* Held while a finger is on the scrub bar. Two things stand down for it, and
     the second is the whole responsiveness fix. */
  const holdingRef = useRef(false)
  /* The newest seek the drag has asked for, and whether one is already in
     flight. Only ever one outstanding: a seek that has not landed yet is not
     replaced by queueing another behind it, it is replaced by forgetting it. */
  const pendingRef = useRef(null)
  const targetRef = useRef(0)
  const seekingRef = useRef(false)
  const flushSeekRef = useRef(null)

  // enforce the loop far more tightly than timeupdate's ~4hz would
  useEffect(() => {
    let frame
    const tick = () => {
      const video = videoRef.current
      if (video) {
        /* Backstop only — the drag flushes itself, and `seeked` flushes the
           next one. This catches a `seeked` that never arrives, which would
           otherwise wedge the gate shut for the rest of the drag. */
        flushSeekRef.current?.()

        const { a, b } = loopRef.current
        /* Dragging to the far end of a rescaled bar lands exactly on B, and this
           fires on `>= b` — so without standing it down the clip jumps to A
           while the finger is still at the right-hand edge. */
        if (
          !holdingRef.current &&
          loopingRef.current &&
          b > a &&
          video.currentTime >= b
        ) {
          const past = video.currentTime - b
          const r = readingsRef.current
          r.overshoot = [...r.overshoot.slice(-49), past]
          video.currentTime = a

          /* #105: held at A while the count runs, which plays it on */
          if (countingInRef.current) {
            video.pause()
            setCount(3)
          }
        }

        /* How often YouTube actually tells us where it is. The loop can only be
           as tight as this, because the tick above reads nothing finer. */
        if (video.player && !video.paused) {
          const raw = video.player.getCurrentTime()
          const r = readingsRef.current
          const now = performance.now()

          if (raw !== r.lastRaw) {
            if (r.lastRawAt) r.cadence = [...r.cadence.slice(-99), now - r.lastRawAt]
            r.lastRaw = raw
            r.lastRawAt = now
          }
        }

        /* The drawn playhead follows the finger, not the decoder. This line used
           to run unconditionally, which chained the knob to whatever frame had
           actually been decoded — so every optimistic update from a scrub was
           overwritten a frame later and the bar rubber-banded behind the thumb.
           While the drag holds, `scrub` is the only thing that moves it. */
        if (!holdingRef.current) setTime(video.currentTime)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed])

  /* Space sets the loop points and is deliberately NOT play/pause. Setting A and
     B is what you do while watching, so it earns the most reachable key; play
     has three other ways to reach it. Pressing cycles A, B, A...
     S saves the loop under whatever name the field below is showing — writing
     over the open loop if there is one, and shift-S forcing a new one. */
  useEffect(() => {
    const typing = (target) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)

    /* #116. A held arrow repeats on its own timer: one step now, then after a
       pause a step every so often, until the key comes up. */
    const stopHeld = () => {
      if (!heldRef.current) return
      clearTimeout(heldRef.current.wait)
      clearInterval(heldRef.current.every)
      heldRef.current = null
    }

    const hold = (code, step, wait, every) => {
      stopHeld()
      step()
      const held = { code }
      held.wait = setTimeout(() => {
        if (heldRef.current === held) held.every = setInterval(step, every)
      }, wait)
      heldRef.current = held
    }

    const nudgeSpeed = (by) => () => {
      const next =
        Math.round(clamp(speedRef.current + by, SPEED_MIN, SPEED_MAX) * 100) / 100
      speedRef.current = next
      setSpeed(next)
      setBadge({ text: `${formatSpeed(next)}x` })
    }

    /* Each step builds on the last while the clip is still near it — YouTube's
       report of where it is trails a seek (#98) — and stays inside the loop
       while it is held. */
    const scrubStep = (direction) => () => {
      const video = videoRef.current
      if (!video) return

      const reported = video.currentTime
      const last = scrubbedToRef.current
      const from = last !== null && Math.abs(reported - last) < 0.35 ? last : reported
      const { a, b } = loopingRef.current ? loopRef.current : { a: 0, b: video.duration }
      const to = clamp(from + direction * keysRef.current.scrubStep, a, b)

      scrubbedToRef.current = to
      scrubRef.current?.(to)
      setBadge({ text: formatTenths(to) })
    }

    const stopResume = () => {
      clearTimeout(resumeRef.current)
      resumeRef.current = null
    }

    const onKeyDown = (event) => {
      if (typing(event.target)) return
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return

      /* ←→ scrub, playing or paused: a press while it plays pauses it first */
      if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault()
        if (event.repeat) return
        stopResume()
        if (!video.paused) {
          pausedByScrubRef.current = true
          video.pause()
        }
        const k = keysRef.current
        hold(
          event.code,
          scrubStep(event.code === 'ArrowLeft' ? -1 : 1),
          k.scrubHoldDelay,
          youtube ? k.scrubRepeatEveryYouTube : k.scrubRepeatEvery,
        )
        return
      }

      /* ↑↓ speed, 0.05 a step */
      if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault()
        if (event.repeat) return
        const k = keysRef.current
        hold(
          event.code,
          nudgeSpeed(event.code === 'ArrowUp' ? SPEED_STEP : -SPEED_STEP),
          k.speedHoldDelay,
          k.speedRepeatEvery,
        )
        return
      }

      if (event.repeat) return

      if (event.code === 'KeyS') {
        event.preventDefault()
        if (event.shiftKey) saveAsNewRef.current()
        else saveLoopRef.current()
        return
      }

      // f matches YouTube's fullscreen key, which is the habit already in the hand
      if (event.code === 'KeyF') {
        event.preventDefault()
        setZen((current) => !current)
        return
      }

      if (event.code === 'Escape') {
        setZen(false)
        return
      }

      /* #116: space plays and pauses, as it does everywhere else */
      if (event.code === 'Space') {
        event.preventDefault()
        stopResume()
        pausedByScrubRef.current = false
        togglePlayRef.current?.()
        return
      }

      /* #116: enter frames the loop — A, then B — which space used to */
      if (event.code !== 'Enter') return

      // Also stops enter activating a focused button
      event.preventDefault()

      const t = video.currentTime
      /* #107 spike: while the Loop Finder counts, it takes the press */
      if (finderEnterRef.current?.(t)) return
      if (nextPointRef.current === 'a') {
        // B parks at the end of the clip, so the loop stays valid until B is set
        setLoop({ a: t, b: video.duration })
        setNextPoint('b')
        return
      }
      setLoop((current) => ({
        ...current,
        b: clamp(t, current.a + MIN_LOOP, video.duration),
      }))
      setNextPoint('a')
    }

    /* The key coming up ends the hold. A scrub begun while the clip was
       playing plays on by itself a few seconds after the last step; one begun
       from paused stays paused. */
    const onKeyUp = (event) => {
      if (heldRef.current?.code !== event.code) return
      stopHeld()

      const scrubbing = event.code === 'ArrowLeft' || event.code === 'ArrowRight'
      const after = keysRef.current.resumeAfter
      if (scrubbing && pausedByScrubRef.current && after > 0) {
        resumeRef.current = setTimeout(() => {
          pausedByScrubRef.current = false
          videoRef.current?.play()
        }, after * 1000)
      }
    }

    const onBlur = () => stopHeld()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      stopHeld()
      stopResume()
    }
  }, [youtube])

  /* #102, retrofitted from the build: a showcase video opens on its first loop
     (the top row, the earliest to start), as if it had been tapped, and
     playing, so a visitor sees what the app is for. Once per open; a browser
     that will not start a video by itself still gets the loop. */
  const openedOnFirstLoop = useRef(false)

  const openOnFirstLoop = (video) => {
    if (!clip.showcase || openedOnFirstLoop.current) return

    const [first] = inTimeOrder(saved)

    if (!first) return

    openedOnFirstLoop.current = true
    loadLoop(first)
    Promise.resolve(video.play()).catch(() => {})
  }

  const loaded = (video) => {
    setDuration(video.duration)
    setLoop({ a: 0, b: video.duration })
    video.playbackRate = speed
    onDuration?.(video.duration)
    openOnFirstLoop(video)
  }

  const onLoadedMetadata = (event) => loaded(event.currentTarget)

  const youtubeReady = (surface) => {
    videoRef.current = surface
    setRates(surface.player.getAvailablePlaybackRates())
    setActualRate(surface.player.getPlaybackRate())
    loaded(surface)
  }

  useEffect(() => {
    if (!youtube) return
    const copy = setInterval(() => {
      const { cadence, overshoot } = readingsRef.current
      setReadings((held) => ({ ...held, cadence, overshoot }))
    }, 500)
    return () => clearInterval(copy)
  }, [youtube])

  /* Paused, five seeks to awkward times, each read back once YouTube has had
     the better part of a second to land it. The error is what a saved loop's A
     would be off by when it is opened. */
  const checkSeeks = async () => {
    const video = videoRef.current
    if (!video?.player) return
    video.pause()
    const errors = []
    for (const target of [3, 7.25, 12.5, 20.1, 33.33]) {
      video.currentTime = target
      await new Promise((resolve) => setTimeout(resolve, 900))
      errors.push(Math.round((video.player.getCurrentTime() - target) * 1000))
    }
    setReadings((held) => ({ ...held, seekErrors: errors }))
  }

  /* One seek in flight, always to the newest position asked for. A pointermove
     fires far faster than a seek can land, so assigning currentTime on every one
     of them builds a queue the decoder then works through late — the clip ends
     up chasing where the finger was half a second ago, which is the freeze.

     Dropping the intermediate targets instead means a fast drag shows fewer
     frames but never falls behind, and a slow drag — where seeks land faster
     than the finger asks for them — still resolves every frame. Exact seeks
     throughout: fastSeek would snap to keyframes seconds apart and take the
     frame-by-frame resolution with it. */
  const flushSeek = () => {
    const video = videoRef.current
    const target = pendingRef.current

    if (!video || target === null || seekingRef.current) return

    pendingRef.current = null
    seekingRef.current = true
    video.currentTime = target
  }

  // the rAF loop subscribes once, so it reaches the flush through a ref
  useEffect(() => {
    flushSeekRef.current = flushSeek
  })

  const scrub = (t) => {
    targetRef.current = t
    pendingRef.current = t
    setTime(t)
    flushSeek()
  }

  /* The clip goes quiet for as long as a hand is on it. Scrubbing resolves frame
     by frame now, and every one of those frames lands its own fragment of sound —
     scanning slowly through a turn is a burst of clicks and half-syllables, and
     the finer the scrub the worse it gets. Dragging A or B is the same noise by a
     different route: the clip sped up or slowed to whatever rate the hand happens
     to be moving at.

     Put back the way it was rather than switched on, because a clip practised
     silently is already muted and handing it audio would be worse than the noise
     this removes. */
  const mutedBefore = useRef(false)

  /* Release also settles the clip exactly where the finger left it. Mid-drag the
     newest target wins and the rest are dropped, so the last one asked for may
     well have been dropped too — this is what puts it back. */
  const holdScrub = (held) => {
    holdingRef.current = held

    const video = videoRef.current
    if (video) {
      if (held) mutedBefore.current = video.muted
      video.muted = held || mutedBefore.current
    }

    if (held) return

    pendingRef.current = targetRef.current
    flushSeek()
  }

  const nudge = (delta) => () =>
    scrub(clamp(time + delta, 0, duration || 0))

  // dragging B by hand finishes a loop that space left half-set
  const changeLoop = (next) => {
    if (finder && !finder.bar) setMarks([])
    if (next.b !== loop.b) setNextPoint('a')
    setLoop(next)
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (video.paused) video.play()
    else video.pause()
  }

  /* Half a loop is not a loop. Between space-A and space-B, B is still parked at
     the end of the clip, so saving would store something nobody chose. Guarded
     here rather than at the key handler, so the button obeys the same rule. */
  const halfSet = nextPoint === 'b'

  /* Looked up rather than held, so deleting the loop you were editing simply
     stops there being one and the button goes back to Save. */
  const editing = saved.find((item) => item.id === editingId) ?? null

  /* An emptied field falls back rather than saving a nameless loop — to the open
     loop's own name where there is one, because clearing the box is not a
     request to rename `chasse` to `Loop 4`. */
  const willName = name.trim() || editing?.name || `Loop ${saved.length + 1}`

  /* Whether Update would actually write anything. Only used to mark the row —
     the button stays live either way, because a disabled Save is a worse
     answer to "did that save?" than a save that changed nothing. */
  const dirty =
    !!editing &&
    (editing.a !== loop.a ||
      editing.b !== loop.b ||
      editing.speed !== speed ||
      editing.name !== willName)

  /* After every write, back to the way a clip opens: the whole clip framed,
     nothing open, nothing ticked, nothing typed — so the next Save is a new
     loop rather than a correction of the one just kept (#71). Correcting one
     starts from tapping it in the list. */
  const startAfresh = () => {
    setLoop({ a: 0, b: duration })
    setNextPoint('a')
    setEditingId(null)
    setChain([])
    setName('')
  }

  const saveLoop = () => {
    if (halfSet) return
    if (!editing) return saveAsNew()

    setSaved(
      saved.map((item) =>
        item.id === editing.id
          ? { ...item, name: willName, a: loop.a, b: loop.b, speed }
          : item,
      ),
    )
    startAfresh()
  }

  /* The way out. Loading a loop and then wanting a *second* one from the same
     stretch of clip is a real move — it is just the rarer one, so it gets the
     smaller button instead of the default.

     No `editing` in the name, so it takes the next number rather than the open
     loop's: two rows called `chasse` are indistinguishable in a list with no
     reorder. */
  const saveAsNew = () => {
    if (halfSet) return

    const added = {
      id: nextId,
      name: name.trim() || `Loop ${saved.length + 1}`,
      a: loop.a,
      b: loop.b,
      speed,
    }

    setSaved([...saved, added])
    setNextId(nextId + 1)
    startAfresh()
  }

  /* #107 spike. The Loop Finder starts from nothing, the whole clip framed and
     enter armed for the first 1, rather than from a loop already there.
     Leaving it puts the player back the way it was. */
  const openFinder = () => {
    setFinder({
      before: { loop, nextPoint, looping, editingId, chain },
      bar: null,
      trying: null,
      joins: [],
    })
    setMarks([])
    setLoop({ a: 0, b: duration })
    setNextPoint('a')
    setLooping(true)
    setEditingId(null)
    setChain([])
  }

  const closeFinder = () => {
    const { before } = finder

    setLoop(before.loop)
    setNextPoint(before.nextPoint)
    setLooping(before.looping)
    setEditingId(before.editingId)
    setChain(before.chain)
    setMarks([])
    setFinder(null)
  }

  /* Enter while counting: the first press is the 1 the bars start from, and
     each one after it ends an 8-count. Once `over` of them are in, the loop is
     all of them, to check against; a press after that starts again. Taken
     here, ahead of the A and B the key sets any other time. */
  const finderEnter = (t) => {
    if (!finder || finder.bar) return false

    const counted = marks.length === over + 1
    const next = marks.length === 0 || counted ? [t] : [...marks, t]

    setMarks(next)

    if (next.length === 1) {
      setLoop({ a: t, b: duration })
      setNextPoint('b')
    } else if (next.length === over + 1) {
      setLoop({ a: next[0], b: Math.max(t, next[0] + MIN_LOOP) })
      setNextPoint('a')
    }

    return true
  }

  const changeOver = (next) => {
    setOver(next)
    setMarks([])
    setLoop({ a: 0, b: duration })
    setNextPoint('a')
  }

  /* The 8-counts framed, as against the whole clip the finder opens on */
  const countFramed =
    !halfSet && loop.b - loop.a > MIN_LOOP && (loop.a > 0.05 || loop.b < duration - 0.05)

  /* One 8-count: the span framed, shared out over the counts in it */
  const countLength = (loop.b - loop.a) / over

  /* How far the presses strayed from that, when there are several */
  const spread =
    marks.length === over + 1 && over > 1
      ? Math.max(...marks.slice(1).map((mark, k) => Math.abs(mark - marks[k] - countLength)))
      : null

  const confirmCount = () => {
    if (!countFramed) return
    setFinder({ ...finder, bar: { one: loop.a, length: countLength }, trying: null, joins: [] })
  }

  /* Back to counting, from the 8-counts found last time */
  const findAgain = () => {
    const { bar } = finder

    setLoop({ a: bar.one, b: bar.one + bar.length * over })
    setNextPoint('a')
    setMarks([])
    setFinder({ ...finder, bar: null, trying: null, joins: [] })
  }

  const bars = finder?.bar ? barsFrom(finder.bar, duration) : []
  const groups = finder?.bar ? groupsOf(bars, finder.joins, finder.bar, wiggle, duration) : []

  /* A loop tried: looped with its lead-in and run-on, from the top */
  const tryGroup = (group) => {
    setLoop({ a: group.a, b: group.b })
    setLooping(true)
    setNextPoint('a')
    setFinder({ ...finder, trying: group.first })
    scrub(group.a)
    Promise.resolve(videoRef.current?.play()).catch(() => {})
  }

  /* The loop being tried, after the bars or the reach change under it */
  const keepTrying = (joins, reachWiggle) => {
    if (finder.trying === null) return null

    const now = groupsOf(bars, joins, finder.bar, reachWiggle, duration).find(
      (group) => group.first <= finder.trying && finder.trying <= group.last,
    )

    if (now) setLoop({ a: now.a, b: now.b })
    return now?.first ?? null
  }

  const toggleJoin = (k) => {
    const joins = finder.joins.includes(k)
      ? finder.joins.filter((one) => one !== k)
      : [...finder.joins, k]

    setFinder({ ...finder, joins, trying: keepTrying(joins, wiggle) })
  }

  const changeWiggle = (next) => {
    setWiggle(next)
    if (finder?.bar) keepTrying(finder.joins, next)
  }

  /* One loop a group into Saved loops, in time order, and the finder closes.
     Each is saved at 1x, whatever the player's speed: only the times are kept. */
  const saveGroups = () => {
    const made = groups.map((group, k) => ({
      id: nextId + k,
      name: group.name,
      a: group.a,
      b: group.b,
      speed: 1,
    }))

    setSaved([...saved, ...made])
    setNextId(nextId + made.length)
    setMarks([])
    setFinder(null)
    startAfresh()
  }

  /* #123, mockup only: says what it would do rather than doing it. A clip
     from Drive becomes its own MP4, A to B; a YouTube entry can only go as a
     link that starts at A. */
  const sendLoop = (span, name) => {
    setBadge({
      for: 2600,
      text: youtube
        ? `Link copied: ${linkFrom(clip.videoId, span.a)}`
        : `Downloading ${clip.name} – ${name}.mp4 (${formatTime(span.a)}–${formatTime(span.b)})`,
    })
  }

  const SendIcon = youtube ? LinkIcon : DownloadIcon
  const sendLabel = (name) => (youtube ? `Copy a link to ${name}` : `Download ${name}`)

  // the key handler subscribes once, so it reaches save through a ref
  useEffect(() => {
    saveLoopRef.current = saveLoop
    scrubRef.current = scrub
    togglePlayRef.current = togglePlay
    saveAsNewRef.current = saveAsNew
    finderEnterRef.current = finderEnter
  })

  const loadLoop = (item) => {
    setChain([])
    setLoop({ a: item.a, b: item.b })
    setSpeed(item.speed)
    setLooping(true)
    setNextPoint('a')
    setEditingId(item.id)
    /* Cleared rather than pre-filled with the name: a value would have to be
       deleted before a new one could be typed over it, and the placeholder says
       the same thing without being in the way. It also means whatever was
       half-typed before you tapped the row cannot quietly rename it. */
    setName('')
    scrub(item.a)
  }

  const removeLoop = (id) => {
    setSaved(saved.filter((item) => item.id !== id))
    setChain(chain.filter((one) => one !== id))
  }

  /* One loop or six, a run plays as a single loop, at the speed the earliest one
     was saved at. Nothing is written to the saved list — a chain is a way to
     play the loops you already have, not another loop. */
  const playRun = (run) => {
    // the last untick leaves the loop points exactly where they were
    if (run.length === 0) return
    const { a, b, speed: runSpeed } = spanOf(run)
    setLoop({ a, b })
    setSpeed(runSpeed)
    setLooping(true)
    setNextPoint('a')
    scrub(a)
  }

  const toggleChain = (id) => {
    const next = chain.includes(id)
      ? chain.filter((one) => one !== id)
      : [...chain, id]
    setChain(next)
    /* And nothing is open any more. A run is not a loop: four ticked rows have
       no single answer to which entry a save writes over, and leaving the last
       one open would let the next press replace it with a span covering all
       four. */
    setEditingId(null)
    playRun(saved.filter((item) => next.includes(item.id)))
  }

  /* #81. One panel, drawn in one of two places: inside the card under the
     controls, as it always was, or as a column of its own beside the card. In
     the column it is a card itself, the field stays put and the list scrolls. */
  const savedLoopsPanel = (
    <div
      className={
        columns
          ? 'flex min-h-0 flex-1 flex-col rounded-2xl bg-panel p-6'
          : 'mt-6 rounded-xl bg-shell/60 p-4'
      }
    >
      <h2 className="text-xs font-bold tracking-widest text-ink/50">
        SAVED LOOPS
      </h2>

      <div className="mt-2 flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={editing ? editing.name : `Loop ${saved.length + 1}`}
          aria-label="Loop name"
          className="min-w-0 flex-1 rounded-lg bg-ink/10 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/40"
        />
        {/* The one button, and it means whichever of the two things you
            are actually doing. Two side by side would put "make another
            one" under the thumb at exactly the moment it is wrong. */}
        <button
          type="button"
          onClick={saveLoop}
          disabled={halfSet}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${
            editing && dirty
              ? 'bg-gradient-to-br from-accent to-accent-2 text-on-accent shadow'
              : CONTROL
          }`}
        >
          {editing ? 'Update' : 'Save'}
        </button>
        {/* #123, spot C: the loop framed now, saved or not */}
        {downloadSpot === 'C' && (
          <button
            type="button"
            aria-label={sendLabel(willName)}
            title={sendLabel(willName)}
            onClick={() => sendLoop(loop, willName)}
            disabled={halfSet}
            className={`rounded-lg px-3 py-2.5 active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${CONTROL}`}
          >
            <SendIcon />
          </button>
        )}
      </div>

      {/* Says which loop is about to be written over, by the name it is
          still stored under — the field above may already be showing a
          new one, and "updates Loop 3" is the fact you need to not lose
          Loop 3 by accident. */}
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums text-ink/40">
        <span className={halfSet ? 'tracking-wide' : undefined}>
          {halfSet
            ? 'set B to finish the loop'
            : editing
              ? `updates ${editing.name} to ${summarise(loop, speed)}`
              : `saves ${summarise(loop, speed)}`}
        </span>
        {/* Stays put and greys while the loop is half-set rather than
            leaving with the line beside it — a control that vanishes on a
            press of space is a worse answer to "why can I not save" than
            one that is visibly refusing. */}
        {editing && (
          <button
            type="button"
            onClick={saveAsNew}
            disabled={halfSet}
            className="font-medium text-accent hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            Save as new
          </button>
        )}
      </p>

      {/* Ordered by where they start, not by when they were saved or what
          they were called: a chain is a run through the clip, so the rows
          you tick have to be the rows next to each other. Sorted any other
          way, ticking two segments that follow each other lights up two
          rows with something unrelated sitting between them, and the span
          it plays stops looking like the rows it came from. */}
      <ul
        className={`mt-3 flex flex-col gap-1.5 ${
          columns ? '-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1' : ''
        }`}
      >
        {inTimeOrder(saved).map((item) => (
          <li
            key={item.id}
            /* Held by id now, not by whether the numbers happen to match.
               The value match let go the instant you nudged A — which is
               the moment the highlight is doing its only real job:
               showing which row the next Save lands on. */
            className={`flex items-center gap-1 rounded-lg pr-1 ${
              item.id === editing?.id
                ? 'bg-accent/25 ring-1 ring-accent/60'
                : 'bg-control/50'
            }`}
          >
            {/* Nothing to chain a lone loop to, so the column only appears
                once there are two — no box, no gutter, nothing to explain. */}
            {saved.length > 1 && (
              <input
                type="checkbox"
                checked={chain.includes(item.id)}
                onChange={() => toggleChain(item.id)}
                aria-label={`Chain ${item.name}`}
                className="ml-3 h-4 w-4 shrink-0 accent-accent"
              />
            )}
            <button
              type="button"
              onClick={() => loadLoop(item)}
              className="min-w-0 flex-1 px-3 py-2 text-left"
            >
              <span className="block truncate text-sm font-medium">
                {item.name}
              </span>
              <span className="block text-xs tabular-nums text-ink/50">
                {summarise(item, item.speed)}
              </span>
            </button>
            {/* Still the stored numbers beside it, because they are what
                you stand to lose — the pending ones are already on the
                line under the field. Outside the row's own button rather
                than inside it: the button is named by what the loop *is*,
                and a word coming and going in there renames the control
                under anyone listening to the page. */}
            {dirty && item.id === editing.id && (
              <span className="shrink-0 px-1 text-[11px] font-medium text-accent">
                unsaved
              </span>
            )}
            {/* #123, spot A: this loop, as saved */}
            {downloadSpot === 'A' && (
              <button
                type="button"
                aria-label={sendLabel(item.name)}
                title={sendLabel(item.name)}
                onClick={() => sendLoop(item, item.name)}
                className="rounded p-1.5 text-ink/40 hover:text-ink"
              >
                <SendIcon />
              </button>
            )}
            <button
              type="button"
              aria-label={`Delete ${item.name}`}
              onClick={() => removeLoop(item.id)}
              className="rounded px-2 py-1 text-lg leading-none text-ink/40 hover:text-ink"
            >
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  /* #86. The controls as pieces, because the options put them in different
     places: under the clip, beside it, or up in the loops column. None of them
     is the clip, so moving them costs nothing. */
  const seekAndSpeed = (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${
          columns ? '' : 'mt-4 lg:mt-6'
        }`}
      >
        <div className="flex gap-1.5">
          <SeekButton label={`Back ${NUDGE} second`} onClick={nudge(-NUDGE)}>
            <BackIcon />
          </SeekButton>
          <SeekButton label={`Forward ${NUDGE} second`} onClick={nudge(NUDGE)}>
            <ForwardIcon />
          </SeekButton>
        </div>
        <SpeedStepper speed={speed} onChange={setSpeed} />
      </div>
      {/* The speed control does not lie: when YouTube plays at something
          other than what was asked, the screen says so. */}
      {youtube && Math.abs(actualRate - speed) > 0.001 && (
        <p className="mt-1.5 text-right text-xs text-accent">
          YouTube is playing this at {formatSpeed(actualRate)}x
        </p>
      )}
    </>
  )

  const slider = (
    <LoopSlider
      duration={duration}
      time={time}
      loop={loop}
      onScrub={scrub}
      onLoopChange={changeLoop}
      onHold={holdScrub}
      tone={finder ? 'finder' : 'accent'}
      marks={finder && !finder.bar ? marks : null}
      lane={
        finder?.bar
          ? { bars, groups, joins: finder.joins, trying: finder.trying, onTry: tryGroup, onJoin: toggleJoin }
          : null
      }
    />
  )

  /* #107 spike: the slider is out while the Loop Finder is, whatever the box says */
  const sliderShown = sliderOut || !!finder

  const reached = countsReached(wiggle)

  /* #107 spike: the Loop Finder's panel. First the 8-count, found with enter
     as any loop is; then every bar in the clip, to try one at a time and to
     save all at once. */
  const finderPanel = finder && (
    <div
      role="group"
      aria-label="Loop Finder"
      className={`rounded-2xl bg-panel p-4 ring-2 ring-finder/60 ${columns ? '' : 'mt-6'}`}
    >
      <h2 className="text-xs font-bold tracking-widest text-finder">LOOP FINDER</h2>

      {finder.bar === null ? (
        <>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="font-semibold">Find the 8 count</span>
            <span className="ml-auto text-ink/60">over</span>
            <button
              type="button"
              aria-label="Fewer 8 counts"
              onClick={() => changeOver(Math.max(1, over - 1))}
              className={`rounded-md px-2.5 py-1 font-semibold active:scale-95 ${CONTROL}`}
            >
              &minus;
            </button>
            <span aria-label="8 counts to average" className="w-5 text-center font-semibold tabular-nums">
              {over}
            </span>
            <button
              type="button"
              aria-label="More 8 counts"
              onClick={() => changeOver(over + 1)}
              className={`rounded-md px-2.5 py-1 font-semibold active:scale-95 ${CONTROL}`}
            >
              +
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="tabular-nums text-ink/60">
              {countFramed
                ? `${countReadout(countLength)}${spread !== null ? ` · ±${spread.toFixed(2)}s` : ''}`
                : over > 1 && marks.length > 0
                  ? `${marks.length - 1} of ${over}`
                  : ''}
            </span>
            <button
              type="button"
              onClick={confirmCount}
              disabled={!countFramed}
              className="ml-auto rounded-lg bg-finder px-3 py-2 text-sm font-semibold text-white shadow active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              Confirm
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="font-semibold">8 count</span>
            <span className="tabular-nums text-ink/60">{countReadout(finder.bar.length)}</span>
            <button
              type="button"
              onClick={findAgain}
              className="ml-auto text-xs font-medium text-finder hover:underline"
            >
              Find again
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="font-semibold">Wiggle</span>
            <button
              type="button"
              aria-label="Less wiggle"
              onClick={() => changeWiggle(Math.max(0, wiggle - 5))}
              className={`rounded-md px-2.5 py-1 font-semibold active:scale-95 ${CONTROL}`}
            >
              &minus;
            </button>
            <input
              type="number"
              min={0}
              step={5}
              value={wiggle}
              aria-label="Wiggle"
              onChange={(event) => changeWiggle(Math.max(0, Number(event.target.value) || 0))}
              className="w-14 rounded-md bg-ink/10 px-2 py-1 text-right tabular-nums outline-none"
            />
            <span className="text-ink/60">%</span>
            <button
              type="button"
              aria-label="More wiggle"
              onClick={() => changeWiggle(wiggle + 5)}
              className={`rounded-md px-2.5 py-1 font-semibold active:scale-95 ${CONTROL}`}
            >
              +
            </button>
            <span className="ml-auto text-xs tabular-nums text-ink/60">
              in {reached.before} · out {reached.after}
            </span>
          </div>

          <button
            type="button"
            onClick={saveGroups}
            disabled={groups.length === 0}
            className="mt-3 w-full rounded-lg bg-finder px-3 py-2 text-sm font-semibold text-white shadow active:scale-95 disabled:pointer-events-none disabled:opacity-40"
          >
            Save {groups.length} loops
          </button>
        </>
      )}
    </div>
  )

  const hint = (
    <p className="mb-4 hidden text-center text-xs text-ink/40 sm:block">
      <Key>enter</Key> sets{' '}
      <span className="font-semibold text-ink/70">
        {nextPoint.toUpperCase()}
      </span>
      <span className="px-2">&middot;</span>
      <span className={halfSet ? 'opacity-40' : undefined}>
        <Key>s</Key>{' '}
        {halfSet
          ? 'saves once B is set'
          : editing
            ? 'updates it'
            : 'saves the loop'}
      </span>
      {editing && !halfSet && (
        <>
          <span className="px-2">&middot;</span>
          <span>
            <Key>&#8679;s</Key> saves a new one
          </span>
        </>
      )}
      <span className="px-2">&middot;</span>
      <Key>f</Key> toggles zen mode
    </p>
  )

  const transport = (
    <div className="flex items-start justify-center gap-6">
      <BigButton label="START" onClick={() => scrub(loop.a)}>
        <StartIcon />
      </BigButton>
      <BigButton
        label={looping ? 'LOOPING' : 'START LOOP'}
        active={looping}
        onClick={() => setLooping(!looping)}
      >
        <LoopIcon />
      </BigButton>
      <BigButton label={playing ? 'PAUSE' : 'PLAY'} onClick={togglePlay}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </BigButton>
    </div>
  )

  const spike = youtube && (
    <SpikeReadings open={!columns} rates={rates} speed={speed} actualRate={actualRate} readings={readings} onCheckSeeks={checkSeeks} />
  )

  return (
    <div
      className={
        columns ? 'flex h-dvh flex-col bg-shell text-ink' : 'min-h-screen bg-shell text-ink'
      }
    >
      <header
        className={`flex items-center gap-2 px-4 py-3 ${
          columns ? 'mx-auto w-full max-w-[100rem]' : ''
        } ${zen ? 'hidden' : ''}`}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to clips"
          className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-ink/60 hover:text-ink"
        >
          <Glyph size="h-4 w-4" outline>
            <path d="M15 5l-7 7 7 7" />
          </Glyph>
          Clips
        </button>
        <span className="truncate text-sm font-semibold">{clip.name}</span>
        {/* #86, #100: on to begin with, and offered only where it changes
            anything */}
        {wide && (
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {/* #94, #96, on trial: the slider out or away, by hand */}
            {columns && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink/70">
                <input
                  type="checkbox"
                  checked={sliderOut}
                  onChange={(event) => setSliderOut(event.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                Slider
              </label>
            )}
            <button
              type="button"
              aria-pressed={countdown}
              onClick={() => onCountdown?.(!countdown)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                countdown ? 'bg-accent text-on-accent' : 'bg-control text-ink/70 hover:bg-control-hi'
              }`}
            >
              Countdown
            </button>
            {/* #107 spike: a mode, in its own colour while it is on */}
            <button
              type="button"
              aria-pressed={!!finder}
              disabled={!duration}
              onClick={() => (finder ? closeFinder() : openFinder())}
              className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40 ${
                finder ? 'bg-finder text-white' : 'bg-control text-ink/70 hover:bg-control-hi'
              }`}
            >
              Loop Finder
            </button>
            <button
              type="button"
              aria-pressed={tryNewUi}
              onClick={() => onTryNewUi?.(!tryNewUi)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                tryNewUi ? 'bg-accent text-on-accent' : 'bg-control text-ink/70 hover:bg-control-hi'
              }`}
            >
              Try new UI
            </button>
          </div>
        )}
      </header>

      {/* The card shrinks to whatever the clip actually is: a portrait clip gets a
          narrow card, a landscape one a wide card. Nothing here assumes 9:16. */}
      {/* Zen mode restyles this tree rather than rendering a second one: moving the
          <video> would remount it, and the clip would reload and lose the loop
          you were watching. Same element, different classes. */}
      <main
        className={
          zen
            ? undefined
            : columns
              ? 'mx-auto grid min-h-0 w-full max-w-[100rem] flex-1 grid-cols-[27rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 px-4 pb-4'
              : 'px-4 pb-4'
        }
      >
        {/* The player's own column (#81, #86). A size container, so the YouTube
            frame can size itself to the column rather than to the window. Not in
            zen, where the frame sizes itself to the screen. */}
        <div className={columns && !zen ? '@container min-h-0 overflow-y-auto' : undefined}>
          <div
            className={
              zen
                ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
                : columns
                  ? /* #86: fills its column, so the clip and the slider get the width */
                    'rounded-2xl bg-panel p-6'
                  : 'mx-auto w-fit max-w-full rounded-2xl bg-panel p-4 lg:p-6'
            }
          >
            {/* w-fit so the wrapper hugs the clip — otherwise it spans the card and
                the expand button lands out in the padding beside the video */}
            <div
              className={`relative w-fit ${zen ? 'flex max-h-dvh items-center' : 'mx-auto'}`}
            >
              {/* Never upscaled or stretched: the clip renders at its own size and only
                  shrinks to fit the viewport. Which limit binds depends on the clip —
                  height for a portrait one, width for a landscape one. */}
              {youtube ? (
                <>
                  <YouTubeFrame
                    videoId={clip.videoId}
                    zen={zen}
                    width={
                      columns
                        ? /* #86: the clip has the column to itself, less the slider */
                          `min(100cqw - 3rem, 1100px, (100dvh - ${sliderShown ? '14.5rem' : '7.5rem'}) * 16 / 9)`
                        : undefined
                    }
                    onReady={youtubeReady}
                    onState={(state) => {
                      setPlaying(state === 1 || state === 3)
                      if (state === 1) setCount(null)
                      if (state === 1) setStarted(true)
                    }}
                    onRate={setActualRate}
                    onError={(code) => setYtError(ERRORS[code] ?? `YouTube error ${code}`)}
                    onSeeked={() => {
                      seekingRef.current = false
                      flushSeekRef.current?.()
                    }}
                  />
                  {started && (
                    <div className="absolute inset-0" onClick={togglePlay} aria-hidden="true" />
                  )}
                  {ytError && (
                    <p className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/85 px-6 text-center text-sm text-white">
                      {ytError}
                    </p>
                  )}
                </>
              ) : (
              <video
                ref={videoRef}
                src={clip.src}
                className={
                  zen
                    ? 'max-h-dvh max-w-full object-contain'
                    : columns
                      ? /* #86: the height the slider under it leaves */
                        /* #94: the slider's room too, while it is put away */
                        `mx-auto block max-w-full rounded-lg bg-black ${
                          sliderShown ? 'max-h-[calc(100dvh-14.5rem)]' : 'max-h-[calc(100dvh-7.5rem)]'
                        }`
                      : 'mx-auto block max-h-[50vh] max-w-full rounded-lg bg-black lg:max-h-[80vh]'
                }
                playsInline
                /* The default only fetches metadata, so scrubbing past what
                   happens to have arrived turns every seek into a network fetch
                   and a decode — which is most of what reads as the clip freezing.
                   These are ~6MB and the app is cache-first anyway, so there is no
                   reason not to have the whole thing before the first drag. */
                preload="auto"
                onLoadedMetadata={onLoadedMetadata}
                /* The gate. The next seek goes out when the last one lands, so
                   there is never a queue to fall behind. */
                onSeeked={() => {
                  seekingRef.current = false
                  flushSeek()
                }}
                onPlay={() => {
                  setPlaying(true)
                  setCount(null)
                }}
                onPause={() => setPlaying(false)}
                onClick={togglePlay}
              />
              )}

              <VideoProgress
                time={time}
                duration={duration}
                loop={loop}
                looping={looping}
                onScrub={scrub}
                onHold={holdScrub}
                /* Follows the clip's own corners so the scrim doesn't square off a
                   rounded video. Zen has no rounding to follow. */
                rounded={zen ? undefined : 'rounded-b-lg'}
              />

              {/* #116: what the last key did, a moment over the clip */}
              {badge && (
                <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                  <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-semibold tabular-nums text-white">
                    {badge.text}
                  </span>
                </div>
              )}

              {/* #105: over the clip, so in zen mode too */}
              {count !== null && (
                <div
                  role="timer"
                  aria-label="Countdown"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex h-28 w-28 items-center justify-center rounded-full bg-black/55 text-6xl font-semibold tabular-nums text-white">
                    {count}
                  </span>
                </div>
              )}

              {/* #123, spot B: the loop framed now, from over the clip */}
              {downloadSpot === 'B' && !zen && (
                <button
                  type="button"
                  aria-label={sendLabel(willName)}
                  title={sendLabel(willName)}
                  onClick={() => sendLoop(loop, willName)}
                  disabled={halfSet}
                  className="absolute right-12 top-2 rounded-lg bg-shell/60 p-2 text-ink/60 backdrop-blur transition hover:text-ink active:scale-95 disabled:opacity-40"
                >
                  <SendIcon />
                </button>
              )}
              <button
                type="button"
                aria-label={zen ? 'Leave the isolated view' : 'Isolate the video'}
                onClick={() => setZen(!zen)}
                className="absolute right-2 top-2 rounded-lg bg-shell/60 p-2 text-ink/60 backdrop-blur transition hover:text-ink active:scale-95"
              >
                {zen ? <CloseIcon /> : <ExpandIcon />}
              </button>
            </div>

            {/* Hidden rather than unmounted, for the same reason */}
            <div className={zen ? 'hidden' : columns ? 'mt-2' : undefined}>
              {!columns && seekAndSpeed}
              {(!columns || sliderShown) && slider}
              {!columns && hint}
              {!columns && transport}
              {!columns && finderPanel}
              {!columns && !finder && savedLoopsPanel}
              {!columns && spike}
            </div>
          </div>
        </div>

        {/* #86: the controls up top in the loops column, and the loops under
            them. The clip has the rest of the screen. */}
        {columns && (
          <div className={zen ? 'hidden' : 'order-first flex min-h-0 flex-col gap-4'}>
            <div className="rounded-2xl bg-panel p-4">
              {seekAndSpeed}
              <div className="mt-4">{hint}</div>
              {transport}
              {spike}
            </div>
            {finderPanel}
            {/* #107 spike: out of the way while the Loop Finder is open */}
            {!finder && savedLoopsPanel}
          </div>
        )}
      </main>

      {!zen && <KeysPanel />}
      {!zen && <DownloadSpotPicker spot={downloadSpot} onSpot={setDownloadSpot} />}
    </div>
  )
}

export default Player
