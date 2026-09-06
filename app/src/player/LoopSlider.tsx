import { useRef, useState } from 'react'

import { formatDuration } from '../clips/format'
import { type Handle, movedTo, NUDGE, timeAt } from './loopRange'
import type { Loop } from './playback'

/* Percentages rather than pixels, so the track needs no measuring to be drawn —
   it lays itself out against whatever width the card gave it, on a phone or a
   laptop. Only reading a *pointer* back off it needs the real geometry, and that
   lives in `loopRange.ts`. */
const percent = (seconds: number, duration: number) =>
  duration > 0 ? (seconds / duration) * 100 : 0

/* A sits above the track with its point down and its time beneath; B below with
   its point up and its time above. The arrangement is LoopTube's, and it is what
   keeps the two times legible when the loop is a second long — stacked on one
   side they would sit on top of each other (mockup `Player.jsx:184-186`). */
const HANDLE =
  'absolute flex h-10 w-10 touch-none items-center justify-center ' +
  '-translate-x-1/2 cursor-grab active:cursor-grabbing'

const DROP = 'h-4 w-4 bg-ink shadow'

const TIME = 'absolute top-1/2 -translate-x-1/2 text-sm tabular-nums text-ink/70'

/* Where a key asks the boundary to go, before anything clamps it. Home and End
   ask for the ends of the *clip* rather than of the loop, and `movedTo` is what
   stops them there — so the keyed route and the dragged route cannot come to
   different answers about where a boundary is allowed to be.

   `null` means "not a key this handle uses", which is what leaves the arrow keys
   free to scroll the page everywhere else. */
const askedFor = (key: string, seconds: number, duration: number) => {
  if (key === 'ArrowRight') return seconds + NUDGE
  if (key === 'ArrowLeft') return seconds - NUDGE
  if (key === 'Home') return 0
  if (key === 'End') return duration

  return null
}

function LoopHandle({
  handle,
  label,
  seconds,
  duration,
  onGrab,
  onDrag,
  onLetGo,
  onKey,
}: {
  readonly handle: Handle
  readonly label: string
  readonly seconds: number
  readonly duration: number
  readonly onGrab: (handle: Handle) => void
  readonly onDrag: (clientX: number) => void
  readonly onLetGo: () => void
  readonly onKey: (handle: Handle, seconds: number) => void
}) {
  const at = `${percent(seconds, duration)}%`

  return (
    <>
      <div
        role="slider"
        /* Capture is what keeps a drag alive when the finger slides off the
           handle — without it the element stops receiving moves and the boundary
           sticks half way. Optional-called because jsdom implements no pointer
           capture at all, and a bare call would throw in every test that drags.
           `touch-none` on the handle is the other half: it stops the browser
           treating the drag as a scroll. */
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          onGrab(handle)
        }}
        onPointerMove={(event) => onDrag(event.clientX)}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId)
          onLetGo()
        }}
        onPointerCancel={onLetGo}
        /* An arrow key on a focused element scrolls the page too, so a handle
           that moved and scrolled at once would take the clip out of view while
           being adjusted. Defaulted only for the keys this handle actually uses
           — everything else stays the browser's. */
        onKeyDown={(event) => {
          const asked = askedFor(event.key, seconds, duration)

          if (asked === null) return

          event.preventDefault()
          onKey(handle, asked)
        }}
        /* The keyed half of BR-19's window. A key has no equivalent of the
           pointer being lifted, so its release is what closes it — and a blur
           closes it as well, because a handle tabbed away from mid-press never
           sees its own key-up and would leave the loop released with nothing
           to say so. */
        onKeyUp={() => onLetGo()}
        onBlur={() => onLetGo()}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={seconds}
        /* Without this a screen reader reads `aria-valuenow` as a bare number,
           and after a drag that is something like 4.283. The dancer is choosing
           a moment in a clip, so the handle says the moment. */
        aria-valuetext={formatDuration(seconds)}
        tabIndex={0}
        className={`${HANDLE} ${handle === 'a' ? 'top-1/2 -translate-y-full' : 'top-1/2'}`}
        style={{ left: at }}
      >
        <span
          className={`${DROP} ${
            handle === 'a'
              ? 'rounded-[50%_50%_50%_0] rotate-45'
              : 'rounded-[0_50%_50%_50%] rotate-45'
          }`}
        />
      </div>
      <span
        className={`${TIME} ${handle === 'a' ? 'mt-3' : '-mt-8'}`}
        style={{ left: at }}
      >
        {formatDuration(seconds)}
      </span>
    </>
  )
}

export function LoopSlider({
  duration,
  loop,
  time,
  onSeek,
  onLoopChange,
  onHold,
}: {
  readonly duration: number
  readonly loop: Loop
  readonly time: number
  readonly onSeek: (seconds: number) => void
  readonly onLoopChange: (loop: Loop) => void
  /* BR-19. Whether a boundary is under the dancer's hand, so the screen can
     stand enforcement down for as long as it is. Reported from here rather than
     inferred up there, because this is the only place that knows — a pointer
     held on a handle and a key held down on one are the same fact to everyone
     else. */
  readonly onHold: (held: boolean) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  /* Which handle is under the finger, or none. A boolean would not do: both
     handles share one move handler, and it has to know which boundary it is
     moving. */
  const [dragging, setDragging] = useState<Handle | null>(null)

  const secondsAt = (clientX: number) =>
    timeAt({
      clientX,
      track: track.current?.getBoundingClientRect() ?? { left: 0, width: 0 },
      duration,
    })

  /* Both edges of BR-19's window in one place, next to the state that already
     tracks the drag — so the hold and the drag cannot come to different answers
     about whether a boundary is being moved. `letGo` closes the window for the
     keyed route as well; a stray release of a handle nobody was dragging costs
     nothing. */
  const grab = (handle: Handle) => {
    setDragging(handle)
    onHold(true)
  }

  const letGo = () => {
    setDragging(null)
    onHold(false)
  }

  /* A move with no drag behind it is the pointer merely passing over the handle,
     which every mouse does on its way to grabbing it. */
  const drag = (clientX: number) => {
    if (!dragging) return

    const next = movedTo({
      loop,
      handle: dragging,
      seconds: secondsAt(clientX),
      duration,
    })

    onLoopChange(next)
    /* The criterion's whole point: the boundary is chosen by what is on screen.
       Seeking to the boundary being dragged, not to the pointer, so a clamped
       drag shows where the handle actually stopped. */
    onSeek(next[dragging])
  }

  /* The same landing as a drag: `movedTo` clamps, and the clip goes to wherever
     the boundary ended up rather than to what the key asked for. Held for the
     same reason too (BR-19) — the seek below is the whole point of the key, and
     enforcement would undo it on the next frame. */
  const key = (handle: Handle, seconds: number) => {
    const next = movedTo({ loop, handle, seconds, duration })

    onHold(true)
    onLoopChange(next)
    onSeek(next[handle])
  }

  return (
    <div className="relative h-24 select-none">
      <div
        ref={track}
        className="loop-track absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 cursor-pointer rounded-full bg-control"
        /* Only the playhead moves. Scrubbing and framing are separate acts, and
           a tap that dragged the nearest boundary along with it would destroy
           the loop every time the dancer looked elsewhere in the clip. The
           handles sit outside this element, so grabbing one never reaches
           here. */
        onPointerDown={(event) => onSeek(secondsAt(event.clientX))}
      >
        {/* Named in the markup because it carries no accessible identity of its
            own — deliberately, since the handles are the sliders and this only
            mirrors what they announce. */}
        <div
          className="loop-span absolute inset-y-0 rounded-full bg-accent"
          style={{
            left: `${percent(loop.a, duration)}%`,
            width: `${percent(loop.b - loop.a, duration)}%`,
          }}
        />
        <div
          className="loop-playhead pointer-events-none absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded bg-ink/80"
          style={{ left: `${percent(time, duration)}%` }}
        />
      </div>

      <LoopHandle
        handle="a"
        label="Loop start"
        seconds={loop.a}
        duration={duration}
        onGrab={grab}
        onDrag={drag}
        onLetGo={letGo}
        onKey={key}
      />
      <LoopHandle
        handle="b"
        label="Loop end"
        seconds={loop.b}
        duration={duration}
        onGrab={grab}
        onDrag={drag}
        onLetGo={letGo}
        onKey={key}
      />
    </div>
  )
}
