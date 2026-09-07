import { useEffect, useRef, useState } from 'react'

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

function formatSpeed(speed) {
  return String(Math.round(speed * 100) / 100)
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

function LoopSlider({ duration, time, loop, onScrub, onLoopChange, onHold }) {
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

  // A sits above the track with its point down, B below with its point up —
  // the same arrangement LoopTube uses, so the labels never collide.
  const handle =
    'absolute flex h-10 w-10 touch-none items-center justify-center ' +
    '-translate-x-1/2 cursor-grab active:cursor-grabbing'
  const drop = 'h-4 w-4 bg-ink shadow'

  return (
    <div className="relative h-24 select-none">
      <div
        ref={trackRef}
        className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 cursor-pointer rounded-full bg-control"
        onPointerDown={(event) => onScrub(timeAt(event.clientX))}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-accent"
          style={{ left: `${pct(loop.a)}%`, width: `${pct(loop.b - loop.a)}%` }}
        />
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

function Player({ clip, onBack }) {
  const videoRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [looping, setLooping] = useState(true)
  const [loop, setLoop] = useState({ a: 0, b: 0 })
  const [speed, setSpeed] = useState(1)
  const [saved, setSaved] = useState([])
  const [name, setName] = useState('')
  const [nextId, setNextId] = useState(1)
  const [nextPoint, setNextPoint] = useState('a')
  const [zen, setZen] = useState(false)

  // the rAF loop and the key handler read these, so neither needs re-subscribing
  const loopRef = useRef(loop)
  const loopingRef = useRef(looping)
  const nextPointRef = useRef(nextPoint)
  const saveLoopRef = useRef(null)

  useEffect(() => {
    loopRef.current = loop
    loopingRef.current = looping
    nextPointRef.current = nextPoint
  }, [loop, looping, nextPoint])

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
          video.currentTime = a
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
     S saves the loop under whatever name the field below is showing. */
  useEffect(() => {
    const typing = (target) =>
      target instanceof HTMLElement &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable)

    const onKeyDown = (event) => {
      if (event.repeat || typing(event.target)) return
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration)) return

      if (event.code === 'KeyS') {
        event.preventDefault()
        saveLoopRef.current()
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

      if (event.code !== 'Space') return

      // Also stops the page scrolling and stops space activating a focused button
      event.preventDefault()

      const t = video.currentTime
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

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const onLoadedMetadata = (event) => {
    const video = event.currentTarget
    setDuration(video.duration)
    setLoop({ a: 0, b: video.duration })
    video.playbackRate = speed
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

  const saveLoop = () => {
    if (halfSet) return
    setSaved([
      ...saved,
      {
        id: nextId,
        name: name.trim() || `Loop ${saved.length + 1}`,
        a: loop.a,
        b: loop.b,
        speed,
      },
    ])
    setNextId(nextId + 1)
    setName('')
  }

  // the key handler subscribes once, so it reaches save through a ref
  useEffect(() => {
    saveLoopRef.current = saveLoop
  })

  const loadLoop = (item) => {
    setLoop({ a: item.a, b: item.b })
    setSpeed(item.speed)
    setLooping(true)
    setNextPoint('a')
    scrub(item.a)
  }

  const removeLoop = (id) => setSaved(saved.filter((item) => item.id !== id))

  const isCurrent = (item) =>
    item.a === loop.a && item.b === loop.b && item.speed === speed

  return (
    <div className="min-h-screen bg-shell text-ink">
      <header
        className={`flex items-center gap-2 px-4 py-3 ${zen ? 'hidden' : ''}`}
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
      </header>

      {/* The card shrinks to whatever the clip actually is: a portrait clip gets a
          narrow card, a landscape one a wide card. Nothing here assumes 9:16. */}
      {/* Zen mode restyles this tree rather than rendering a second one: moving the
          <video> would remount it, and the clip would reload and lose the loop
          you were watching. Same element, different classes. */}
      <main className={zen ? undefined : 'px-4 pb-4'}>
        <div
          className={
            zen
              ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
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
            <video
              ref={videoRef}
              src={clip.src}
              className={
                zen
                  ? 'max-h-dvh max-w-full object-contain'
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
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={togglePlay}
            />

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
          <div className={zen ? 'hidden' : undefined}>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 lg:mt-6">
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

          <LoopSlider
            duration={duration}
            time={time}
            loop={loop}
            onScrub={scrub}
            onLoopChange={changeLoop}
            onHold={holdScrub}
          />

          {/* Only worth showing where there is a keyboard to press */}
          <p className="mb-4 hidden text-center text-xs text-ink/40 sm:block">
            <Key>space</Key> sets{' '}
            <span className="font-semibold text-ink/70">
              {nextPoint.toUpperCase()}
            </span>
            <span className="px-2">&middot;</span>
            <span className={halfSet ? 'opacity-40' : undefined}>
              <Key>s</Key> {halfSet ? 'saves once B is set' : 'saves the loop'}
            </span>
            <span className="px-2">&middot;</span>
            <Key>f</Key> toggles zen mode
          </p>

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

          <div className="mt-6 rounded-xl bg-shell/60 p-4">
            <h2 className="text-xs font-bold tracking-widest text-ink/50">
              SAVED LOOPS
            </h2>

            <div className="mt-2 flex gap-2">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={`Loop ${saved.length + 1}`}
                aria-label="Loop name"
                className="min-w-0 flex-1 rounded-lg bg-ink/10 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/40"
              />
              <button
                type="button"
                onClick={saveLoop}
                disabled={halfSet}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${CONTROL}`}
              >
                Save
              </button>
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-ink/40">
              {halfSet ? (
                <span className="tracking-wide">set B to finish the loop</span>
              ) : (
                <>
                  saves {formatTime(loop.a)} - {formatTime(loop.b)} &middot;{' '}
                  {formatSpeed(speed)}x
                </>
              )}
            </p>

            <ul className="mt-3 flex flex-col gap-1.5">
              {saved.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-1 rounded-lg pr-1 ${
                    isCurrent(item) ? 'bg-accent/25 ring-1 ring-accent/60' : 'bg-control/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadLoop(item)}
                    className="min-w-0 flex-1 px-3 py-2 text-left"
                  >
                    <span className="block truncate text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="block text-xs tabular-nums text-ink/50">
                      {formatTime(item.a)} - {formatTime(item.b)} &middot;{' '}
                      {formatSpeed(item.speed)}x
                    </span>
                  </button>
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
              {saved.length === 0 && (
                <li className="py-1 text-sm text-ink/40">
                  Drag A and B, then save. Most clips have a few worth keeping.
                </li>
              )}
            </ul>
          </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Player
