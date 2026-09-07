import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'

import type { Clip } from '../clips/clip'
import type { ClipCache } from '../clips/clipCache'
import { browserClipCache } from '../clips/clipCache'
import type { DriveApi } from '../drive/driveApi'
import { browserDriveApi } from '../drive/driveApi'
import type { SavedLoop } from '../loops/loop'
import { loopsFor } from '../loops/loopsChange'
import type { LoopsHandle } from '../loops/useLoops'
import { useClipSource } from './clipSource'
import { clamp, type Handle, NUDGE } from './loopRange'
import { LoopSlider } from './LoopSlider'
import {
  decoded,
  type Loop,
  opening,
  type Playback,
  undecodable,
} from './playback'
import { nextLoopName } from './savedLoops'
import { SavedLoopsPanel } from './SavedLoopsPanel'
import { BackGlyph, ForwardGlyph, SeekButton } from './SeekButton'
import { isTyping, spaceSets } from './shortcuts'
import { ShortcutHint } from './ShortcutHint'
import { SpeedStepper } from './SpeedStepper'
import {
  LoopGlyph,
  PauseGlyph,
  PlayGlyph,
  StartGlyph,
  TransportButton,
} from './TransportButton'
import {
  type Gate,
  idle,
  type Move,
  requested,
  SEEK_BACKSTOP,
  settled,
} from './seekGate'
import { VideoProgress } from './VideoProgress'

/* Asked of the element every time, rather than of a flag the screen keeps.
   Playback stops for reasons the app never hears about — the clip ends, the phone
   takes a call — and a second copy of the answer would be wrong by then, costing
   the dancer a tap that appears to do nothing. */
const togglePlay = (surface: HTMLVideoElement | null) => {
  if (!surface) return

  if (!surface.paused) {
    surface.pause()
    return
  }

  void surface.play()
}

/* Every glyph on this screen is the same stroked 24-unit box and differs only in
   its paths and its size, so the box is written once. Decorative throughout —
   each one sits inside a control that already carries the accessible name. */
const Glyph = ({
  children,
  size = 'h-5 w-5',
}: {
  readonly children: ReactNode
  readonly size?: string
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={size}
  >
    {children}
  </svg>
)

const ExpandIcon = () => (
  <Glyph>
    <path d="M4 9V4h5" />
    <path d="M20 9V4h-5" />
    <path d="M4 15v5h5" />
    <path d="M20 15v5h-5" />
  </Glyph>
)

const CloseIcon = () => (
  <Glyph>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Glyph>
)

/* How much of the clip has arrived. Same shape as the upload bar on a tile
   (`ClipTile`), because it is the same fact travelling the other way — and the
   bar is drawn only where there is a fraction to draw: an absent length would
   otherwise show as a bar pinned at zero, which reads as a stalled download
   rather than an unknown one. */
function Downloaded({ fraction }: { readonly fraction: number | undefined }) {
  if (fraction === undefined) return null

  const percent = Math.round(fraction * 100)

  return (
    <div
      role="progressbar"
      aria-label="Fetching this clip from Drive"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="mx-auto mt-3 h-1 w-40 overflow-hidden rounded bg-white/25"
    >
      <div
        className="h-full bg-accent transition-[width] duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}

/* Back to the grid, not back in history: the criterion says the Clips screen
   returns, and a history step returns wherever you came from. Its own component
   because the header below is no longer the only place it appears — a clip still
   being opened needs the way out before it has anything else to show. */
function BackToClips() {
  return (
    <Link
      to="/"
      aria-label="Back to clips"
      className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-ink/60 hover:text-ink"
    >
      <Glyph size="h-4 w-4">
        <path d="M15 5l-7 7 7 7" />
      </Glyph>
      Clips
    </Link>
  )
}

/* Just the header, so the way back out is where it always is. Reached while the
   library is still arriving, which is the ordinary case for opening `/clip/:id`
   directly — a reload, a bookmark, or the link the dancer sent to their own
   phone. */
function Opening() {
  return (
    <div className="min-h-screen bg-shell text-ink">
      <header className="flex items-center gap-2 px-4 py-3">
        <BackToClips />
        <span role="status" className="truncate text-sm text-ink/40">
          Opening…
        </span>
      </header>
    </div>
  )
}

export function PlayerScreen({
  onOpened,
  clips,
  loops,
  driveApi = browserDriveApi,
  clipCache = browserClipCache,
  onBytes,
  stillLoading = false,
}: {
  readonly clips: readonly Clip[]
  /* Fired once the path has resolved to a clip the library holds (#16), which
     is what **Last opened** orders by. Not on every render and not before the
     bounce: a path naming no clip is not an open. */
  readonly onOpened: (clipId: string) => void
  /* The loops, from above both screens. The player no longer keeps a list of
     its own: US-01-15 puts them in Drive, and the Clips screen counts the same
     ones, so a second copy read separately would be a second copy free to
     disagree. */
  readonly loops: LoopsHandle
  readonly driveApi?: DriveApi
  readonly clipCache?: ClipCache
  /* Handed the clip's bytes once they are in hand, however they arrived. #77
     uses it to make the still an older clip never had — the bytes are already
     here to play it, so the library heals a clip at a time rather than being
     migrated wholesale. */
  readonly onBytes?: (clipId: string, bytes: Blob) => void
  /* Whether the library has answered yet. Without this the player cannot tell
     "this clip does not exist" from "we have not looked yet", and would bounce
     every direct open straight back to a grid that is also still loading —
     making a stored clip unreachable by its own URL. */
  readonly stillLoading?: boolean
}) {
  const { clipId } = useParams()
  const clip = clips.find((candidate) => candidate.id === clipId)

  if (!clip && stillLoading) return <Opening />

  /* The path is user-editable, so it can name a clip that is not here. Replace
     rather than push, or Back lands on the dead URL and bounces straight out
     again. */
  if (!clip) return <Navigate to="/" replace />

  /* Mounted only once there is a clip, and keyed on it. Everything below is
     seeded from the clip, and a direct open — a reload, a bookmark, the link
     sent to the phone — has none on its first render: seeding from that would
     settle "cannot be played" for a clip that had merely not arrived, and no
     later render would take it back. */
  return (
    <OpenedClip
      key={clip.id}
      clip={clip}
      loops={loops}
      driveApi={driveApi}
      clipCache={clipCache}
      onBytes={onBytes}
      onOpened={onOpened}
    />
  )
}

function OpenedClip({
  clip,
  loops,
  driveApi,
  clipCache,
  onBytes,
  onOpened,
}: {
  readonly clip: Clip
  readonly loops: LoopsHandle
  readonly driveApi: DriveApi
  readonly clipCache: ClipCache
  readonly onBytes?: ((clipId: string, bytes: Blob) => void) | undefined
  readonly onOpened: (clipId: string) => void
}) {
  /* #16. Here rather than in the parent because this component is keyed on the
     clip and mounted only once the path has resolved to one the library holds —
     so it fires exactly once per open, and a path naming no clip never counts
     as one. It does not wait for the bytes: the dancer opened the clip whether
     or not Drive could produce it. */
  useEffect(() => {
    onOpened(clip.id)
  }, [clip.id, onOpened])

  /* Named here rather than inline at the call below, because `useClipSource`
     depends on it: a new function each render would re-run its effect and
     re-fetch the clip every time anything on this screen changed. */
  const report = useCallback(
    (bytes: Blob) => {
      onBytes?.(clip.id, bytes)
    },
    [clip.id, onBytes],
  )
  /* One of three places now: the file it was added from, the copy this device
     already cached, or a fresh download out of Drive. A clip opened on the
     device that uploaded it never downloads, and after US-01-16 neither does
     one opened twice anywhere. */
  const source = useClipSource(clip, driveApi, clipCache, report)
  const [zen, setZen] = useState(false)
  /* BR-01 again: a clip opens at its own speed, and the dancer slows it from
     there. Held here rather than in the stepper because the video element is
     what a rate is finally applied to — a copy kept beside the row of buttons
     would be free to disagree with the clip actually playing. */
  const [speed, setSpeed] = useState(1)
  /* A clip with no source never reaches either failure route — nothing loads, so
     no error fires and no metadata arrives — and it would sit as a blank surface
     saying nothing, which is the silence this story exists to remove. There is
     no length to wait for, so it opens undecodable rather than opening. */
  const [playback, setPlayback] = useState<Playback>(
    clip.src ?? clip.driveId ? opening : undecodable,
  )
  /* Set from the element's own `play` and `pause` events, never from the tap that
     started it. Playback stops for reasons the app never triggered — the clip
     ends, the phone takes a call — and a flag written by the click would go on
     offering PAUSE on a clip that had already stopped. It is the same answer
     US-01-06 refused to copy, sourced the one way that cannot drift from it. */
  const [playing, setPlaying] = useState(false)
  /* US-01-06 toggled playback from the clip's own `onClick`, so it never needed a
     handle on the element. A control sitting outside it does, and so does the
     enforcement below, which has to read and write `currentTime`. */
  const surface = useRef<HTMLVideoElement>(null)
  /* Where the marker is drawn. The element's own `currentTime` is the truth, but
     it changes without telling React anything, so the screen needs a copy it can
     re-render from — sampled below at the rate BR-07 sets. */
  const [time, setTime] = useState(0)
  /* BR-19. Whether the dancer has hold of a loop boundary, reported by the
     slider — the only thing that can tell a held handle from a released one.
     Enforcement stands down while it is true, because the two would otherwise
     fight over the same playhead and enforcement would win on the next frame. */
  const [adjusting, setAdjusting] = useState(false)
  /* BR-03. Which boundary the next space press lands on, cycling A, B, A… The
     dancer is told this rather than left to remember it — the hint line reads it
     too, which is why it is state here rather than something the handler keeps to
     itself. */
  const [nextPoint, setNextPoint] = useState<Handle>('a')
  /* The loops kept against *this* clip, read out of the one file that holds
     every clip's. Not state here any more: US-01-15 made Drive the owner, and
     what the panel lists is what Drive has taken — which is the whole of "write
     first, then show".

     The name the next loop would take is still the screen's, because the `s`
     shortcut is bound at the window and saves under whatever the field is
     showing, which it could not read from inside the panel. The mockup reaches
     back through a ref; one owner costs less than a second copy. */
  const saved = loopsFor(loops.loops, clip.id)
  const [loopName, setLoopName] = useState('')

  /* One seek in flight at a time, and the rest of the drag dropped rather than
     queued — #23. A ref rather than state because every read and write happens
     inside the same pointermove, and re-rendering per move would put a frame
     between the finger and the seek it asked for. */
  const gate = useRef<Gate>(idle)

  /* Whatever the finger last asked for, kept because the gate may well have
     dropped it: releasing has to settle on where the drag ended, not on the last
     position that happened to be issued. */
  const wanted = useRef(0)

  /* The way back out of a seek that never reports. Armed with the seek and
     cleared by whatever settles it, so at most one is ever outstanding. */
  const backstop = useRef<ReturnType<typeof setTimeout> | null>(null)

  const disarm = () => {
    if (backstop.current !== null) clearTimeout(backstop.current)
    backstop.current = null
  }

  const issue = (move: Move) => {
    gate.current = move.gate

    /* Nothing going out. The backstop stands down only when there is no longer a
       seek for it to cover — a request that was *held back* leaves the one before
       it still in flight, and clearing the timer then would take away the only
       way back out of a seek that never reports. */
    if (move.seek === null) {
      if (!move.gate.inFlight) disarm()
      return
    }

    disarm()

    /* Armed before the write, not after: the element can report back inside the
       assignment itself, and a backstop armed afterwards would outlive the seek
       it was covering. */
    backstop.current = setTimeout(
      () => issue(settled(gate.current)),
      SEEK_BACKSTOP,
    )

    /* Exact, never `fastSeek`. That was tried at the mockup gate and removed: it
       snaps to the nearest keyframe, seconds away on this footage, so it *is* the
       freeze-and-jump it looks like a cure for and it takes the frame-by-frame
       resolution with it. */
    if (surface.current) surface.current.currentTime = move.seek
  }

  /* Writes both, because a scrub while paused moves the playhead and no frame is
     scheduled to notice: the marker would sit where the clip used to be until
     something else started it.

     `setTime` takes the position asked for rather than the one issued, so the
     drawn playhead follows the finger even while the seek that will catch up to
     it is still in flight. */
  const seekTo = (seconds: number) => {
    wanted.current = seconds
    issue(requested(gate.current, seconds))
    setTime(seconds)
  }

  /* The element saying the seek arrived, which is the only thing that can. Loop
     enforcement writes `currentTime` straight onto the element without asking the
     gate — a correctness rule, not a drag — and the `seeked` it fires lands here
     too, where settling an idle gate is a no-op. */
  const seekLanded = () => issue(settled(gate.current))

  /* Written straight onto the element, because `playbackRate` is a property
     rather than an attribute React could render. Nothing here plays, pauses or
     touches `looping`, and the enforcement below does not take the rate as a
     dependency — so a rate changed mid-section neither stops the clip nor tears
     down the loop holding it, which is the half of the criterion about what
     must *not* happen. */
  useEffect(() => {
    if (surface.current) surface.current.playbackRate = speed
  }, [speed])

  /* BR-07 as extended at US-01-08's approval gate. A second callback rather than
     a share of the enforcement one below, which is gated on looping as well as
     playing — a marker riding on that would freeze the moment the dancer
     released the loop, at exactly the point they are watching where the clip has
     got to. Gated on playing alone, so a paused clip still schedules nothing.

     The rate is not a dependency here either: a slowed clip reports a slower
     `currentTime` and the marker follows it, so there is nothing to recompute. */
  useEffect(() => {
    if (playback.kind !== 'ready' || !playing) return

    let frame = 0
    const tick = () => {
      if (surface.current) setTime(surface.current.currentTime)

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [playback.kind, playing])

  /* BR-07: per animation frame, not on the video's own progress events. Those
     fire at about 4 Hz, and the spike measured 86 ms of overshoot on a two-second
     loop that way — long enough to see the clip run past B before it comes back,
     which is the stutter this whole rule exists to avoid.

     `frame` is reassigned because each tick books the next one and the cleanup
     has to cancel whichever is outstanding; there is no way to hold that without
     a mutable handle.

     `adjusting` is BR-19: a boundary under the dancer's hand is being framed,
     not played, and the seek that shows them where it is would be undone here on
     the next frame. Standing down for the length of the hold rather than
     reworking the comparison, because the clip genuinely is at B — it was put
     there on purpose, and there is no reading of `currentTime` that can tell
     that apart from having arrived. */
  useEffect(() => {
    if (playback.kind !== 'ready' || !playback.looping || !playing) return
    if (adjusting) return

    const { a, b } = playback.loop

    let frame = 0
    const tick = () => {
      const video = surface.current

      if (video && video.currentTime >= b) video.currentTime = a

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [playback, playing, adjusting])

  /* Only a ready clip has a loop to move, and the guard is the type's rather than
     a check: `playback.loop` does not exist on the other two states. */
  const putLoop = (loop: Loop) => {
    setPlayback((held) => (held.kind === 'ready' ? { ...held, loop } : held))
  }

  /* The slider's route in, and UC-01 alternate flow 11a with it: moving B is the
     other way of finishing a loop that space left half-set, so it re-arms space
     for A. Space and the handles are two ways into one state, not two states.

     Only B, because A being set is what made the loop half-set in the first place
     — moving it again leaves space waiting for the B still missing.

     Space does not come through here. It sets its own boundary and arms its own
     next one in the same press, and routing it past this would have the two fight
     over `nextPoint` inside one batch. */
  const changeLoop = (loop: Loop) => {
    if (playback.kind === 'ready' && loop.b !== playback.loop.b) setNextPoint('a')

    putLoop(loop)
  }

  /* BR-04: half a loop is not a loop. Between space setting A and space setting
     B, B is still parked at the clip's end (BR-02), so a save would keep a
     section nobody chose.

     Derived from `nextPoint` rather than stored, and derived *here* rather than
     in the panel, because every route in has to read the same answer: the button
     greys, the `s` key does nothing, and `Enter` in the name field does nothing,
     all off this one expression. The mockup makes the same point in a comment —
     it guards inside `saveLoop` rather than at the key handler "so the button
     obeys the same rule". */
  const halfSet = nextPoint === 'b'

  /* UC-01 steps 18–19, and BR-09: what is kept is the name, A, B *and* the speed,
     because the tempo a section was learned at is part of the loop rather than a
     setting that happened to be on at the time.

     The boundaries come off `playback`, which is where the loop actually is —
     never off a copy, for the reason `nudge` and `togglePlay` both give.

     BR-10: an empty field means the name that was offered, and a field holding
     only spaces is empty in every sense the dancer intends.

     The id is minted here because this is the one place a loop is saved. It is a
     UUID rather than a count so that the laptop's third loop and the phone's
     third loop do not claim the same identity in `loops.json`.

     Refused while a write is already going, alongside BR-04's half-set guard
     and for a reason of the same kind: there is nothing to save right now.
     Without it, a Save pressed twice inside the two hundred milliseconds keeps
     the same section again under the next offered name.

     The field is emptied only once Drive has taken the loop. A dancer who typed
     "the hard bit" and lost the write should not lose what they called it as
     well — the retry is then one press rather than a re-type. */
  const saveLoop = () => {
    if (playback.kind !== 'ready' || halfSet || loops.writing) return

    const kept: SavedLoop = {
      id: crypto.randomUUID(),
      name: loopName.trim() || nextLoopName(saved),
      a: playback.loop.a,
      b: playback.loop.b,
      speed,
    }

    void loops.save(clip.id, kept).then((written) => {
      if (written) setLoopName('')
    })
  }

  /* The key handler below subscribes on the loop and the armed boundary, and
     nothing else — so it reaches the save through a ref rather than closing over
     it. Taking `saveLoop` as a dependency would re-subscribe the window listener
     on every keystroke typed into the name field, and on every frame the playhead
     marker draws; taking the name and the rate instead does the first of those.

     This is the one place the mockup's ref earns its keep, and it earns it for a
     reason the mockup does not give: what is held here is a *callback*, not a
     copy of an answer, so there is still exactly one place that decides what
     saving means. */
  const saveLoopRef = useRef(saveLoop)

  useEffect(() => {
    saveLoopRef.current = saveLoop
  })

  /* UC-01 steps 9–10: the section is marked while it goes past, so the shortcut
     listens at the window and nothing has to be focused first.

     Gated on a ready clip, as the mockup gates its handler on a finite duration —
     a clip that will not decode has no position to read and no length to park B
     against. The gate is inside the effect rather than around the key, so a key
     added later binds under it rather than beside it.

     Re-subscribed as the loop moves, which is what the two callbacks above already
     do. The alternative is the mockup's: subscribe once and reach the current loop
     through a ref, which buys nothing here and adds a second copy of the answer. */
  useEffect(() => {
    if (playback.kind !== 'ready') return

    const onKeyDown = (event: KeyboardEvent) => {
      /* A held key repeats at the operating system's rate and every repeat is
         another keydown. Marking a section is one act however long the thumb stays
         down; without this, a held space flickers A and B against each other tens
         of times a second and lands wherever the release falls.

         Alongside BR-05 above every key rather than beside each one, so a shortcut
         added later cannot forget either. */
      if (event.repeat || isTyping(event.target)) return

      /* `f` because YouTube's fullscreen key is the habit already in the hand,
         and Escape because it is the way out of everything else that fills a
         screen. Escape only leaves: a key that both entered and left would make
         the way out depend on where you already were. */
      if (event.code === 'KeyF') {
        setZen((held) => !held)
        return
      }

      if (event.code === 'Escape') {
        setZen(false)
        return
      }

      /* Moved here from US-01-10 at that story's approval gate: `s` had nothing
         to call until this panel existed, and a hint advertising a dead key is
         worse than a hint with two rows.

         It calls the same `saveLoop` the button does, rather than repeating the
         half-set check beside it, which is what BR-04 means by the guard being
         single — the key and the button cannot disagree about what half a loop
         is because there is only one place that decides. */
      if (event.code === 'KeyS') {
        saveLoopRef.current()
        return
      }

      if (event.code !== 'Space') return

      /* Space scrolls the page, and activates whatever button was last touched —
         which, on this screen, the dancer has almost certainly just touched.
         Marking a section would otherwise scroll the clip out of view, or restart
         the loop, or both at once. */
      event.preventDefault()

      /* Read off the element for `nudge`'s reason: `time` is a copy, stale by
         however long it has been since the last frame, and a mark placed from it
         would land somewhere other than where the dancer saw. */
      const framed = spaceSets({
        loop: playback.loop,
        handle: nextPoint,
        seconds: surface.current?.currentTime ?? 0,
        duration: playback.duration,
      })

      putLoop(framed.loop)
      setNextPoint(framed.next)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playback, nextPoint])

  /* Read off the element rather than off `time`, on the same reasoning
     `togglePlay` gives above: the element is where the playhead actually is, and
     a copy is stale by however long it has been since the last frame. Nudging
     from a stale reading would quietly land somewhere other than a second away.

     Clamped to the clip, so the two controls stop at its ends instead of seeking
     to a position that does not exist. */
  const nudge = (by: number) => () => {
    if (playback.kind !== 'ready' || !surface.current) return

    seekTo(clamp(surface.current.currentTime + by, 0, playback.duration))
  }

  /* UC-01 step 21, and BR-09's other half. The speed was saved *with* the loop
     rather than beside it, so recalling one has to bring the tempo back or the
     section returns unlearnable at the rate it was learned at.

     The loop and `looping` move in a single updater, because the point of a
     recall is to be ready to run the section — restored boundaries with the loop
     still released would be half an answer, and two `setPlayback` calls could be
     torn apart by a render between them.

     Space is re-armed for A, because a recalled loop is a whole one: left
     pointing at B, the next press would move the boundary of a section the
     dancer had just asked to have back. Nothing here plays — step 21 says
     restore and seek, and starting the clip would be a second thing nobody
     asked for. */
  const recallLoop = (entry: SavedLoop) => {
    setPlayback((held) =>
      held.kind === 'ready'
        ? { ...held, loop: { a: entry.a, b: entry.b }, looping: true }
        : held,
    )
    setSpeed(entry.speed)
    setNextPoint('a')
    seekTo(entry.a)
  }

  /* UC-01 step 22. By id rather than by index or by name: the dancer can save two
     loops under the same name, and a filter on either would take both.

     It goes to Drive the same way a save does, and it comes off the list the
     same way too — only once the write has landed. A removal that vanished
     from the panel and stayed in Drive would come back on the next reload,
     which is a worse lie than the entry staying put. */
  const removeLoop = (id: string) => {
    void loops.remove(clip.id, id)
  }

  /* Only a ready clip has a loop to release, and the updater form rather than a
     read of `playback` because this is the one place the flag is written — the
     enforcement above reads it, and the two must not disagree. */
  const toggleLooping = () => {
    setPlayback((held) =>
      held.kind === 'ready' ? { ...held, looping: !held.looping } : held,
    )
  }

  /* Two ways to end up with no clip on screen, and US-01-14 adds the second: the
     browser could not decode it, or Drive would not give the bytes up. They put
     the same sentence on screen, so they are one word from here on. */
  const condemned = playback.kind === 'undecodable' || source.unreachable

  /* Derived rather than stored, because the close control lives on the video: a
     clip that fails while isolated takes the only way out with it, leaving the
     message on a black field with no header and — until US-01-10 — no shortcut
     either. Asking the question here rather than resetting the flag from a
     handler covers both routes into undecodable at once, the error and the
     metadata that arrives with no length.

     Drive's own failure is folded in through `condemned`, but only for the shape
     of it: a download cannot fail after the clip is already isolated, because
     zen is entered from a control on a video that is by then on screen. No guard
     against fetching-while-isolated either, for the same reason — it would be
     unreachable, and its test dead on arrival. */
  const isolated = zen && !condemned

  return (
    <div className="min-h-screen bg-shell text-ink">
      {/* Hidden by the attribute rather than a class, and stripped of `flex`
          while it is: a display utility outranks the `[hidden]` rule, so a
          header that kept its classes would stay on screen. It also makes the
          hiding legible to anything reading the accessibility tree — which is
          what "every control is hidden" is a claim about. */}
      <header
        hidden={isolated}
        className={isolated ? undefined : 'flex items-center gap-2 px-4 py-3'}
      >
        <BackToClips />
        <span className="truncate text-sm font-semibold">{clip.name}</span>
      </header>

      {/* The card shrinks to whatever the clip actually is: a portrait clip gets
          a narrow card, a landscape one a wide card. Nothing here assumes 9:16
          (BR-16), and the controls below inherit that width by sitting in it. */}
      <main className={isolated ? undefined : 'px-4 pb-4'}>
        {/* The card becomes the black field the clip sits alone in. Same
            element restyled, not a second one rendered — BR-08 again, and the
            reason zen mode is one flag rather than a branch. */}
        <div
          className={
            isolated
              ? 'fixed inset-0 z-50 flex items-center justify-center bg-black'
              : 'mx-auto w-fit max-w-full rounded-2xl bg-panel p-4 lg:p-6'
          }
        >
          {/* Only the clip goes; the header above and the regions below stay put,
              so the way back is where it already was. The mockup says nothing here
              at all — a deliberate departure, settled at this story's approval
              gate (UC-01 exception 6a). */}
          {source.fetching ? (
            /* A first open of a Drive-held clip is ~7 s of nothing at 9 MB, and
               this story re-downloads on every open until US-01-16 caches them.
               Saying so is the same argument exception 6a made about silence:
               a blank black rectangle is indistinguishable from a broken one. */
            <div
              role="status"
              className="mx-auto max-w-sm rounded-lg bg-black px-6 py-16 text-center text-sm text-ink/60"
            >
              <p>Fetching this clip from Drive…</p>
              <Downloaded fraction={source.progress} />
            </div>
          ) : condemned ? (
            <p
              role="alert"
              className="mx-auto max-w-sm rounded-lg bg-black px-6 py-16 text-center text-sm text-ink/60"
            >
              This clip couldn&rsquo;t be played.
            </p>
          ) : (
            /* w-fit so the wrapper hugs the clip — otherwise it spans the card
               and the control lands out in the padding beside the video. */
            <div
              className={`relative w-fit ${isolated ? 'flex max-h-dvh items-center' : 'mx-auto'}`}
            >
              {/* Never upscaled or stretched: the clip renders at its own size
                  and only shrinks to fit. Which limit binds depends on the clip
                  — height for a portrait one, width for a landscape one — and a
                  video's default object-fit of contain keeps it in proportion. */}
              <video
                ref={surface}
                src={source.src}
                className={
                  isolated
                    ? 'max-h-dvh max-w-full object-contain'
                    : 'mx-auto block max-h-[50vh] max-w-full rounded-lg bg-black lg:max-h-[80vh]'
                }
                playsInline
                onLoadedMetadata={(event) =>
                  setPlayback(decoded(event.currentTarget.duration))
                }
                onError={() => setPlayback(undecodable)}
                onSeeked={seekLanded}
                onClick={(event) => togglePlay(event.currentTarget)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                /* B sits at the clip's end until US-01-08 moves it (BR-01), so
                   reaching B and running out are the same instant — and the
                   element can win that race, ending before the frame that would
                   have sent it back. Once it has ended it is paused, so the loop
                   above has stopped scheduling frames and nothing is left to
                   notice. Handled here, on the one event that always arrives. */
                onEnded={() => {
                  if (playback.kind !== 'ready' || !playback.looping) return

                  seekTo(playback.loop.a)
                  void surface.current?.play()
                }}
              />

              {/* Gated on a ready clip like the slider and the transport: before
                  metadata there is no length to lay a bar out against, and a bar
                  spanning an unknown clip would invite a drag against nothing.
                  Inside this wrapper rather than in the strip below, which is
                  what carries it through zen. */}
              {playback.kind === 'ready' && (
                <VideoProgress
                  time={time}
                  duration={playback.duration}
                  loop={playback.loop}
                  looping={playback.looping}
                  onScrub={seekTo}
                  onHold={setAdjusting}
                  rounded={isolated ? undefined : 'rounded-b-lg'}
                />
              )}

              {/* On the video itself, so a dancer who does not know the
                  shortcut is not trapped once the controls are gone. It is one
                  control changing identity rather than two swapping places —
                  the way out is where the way in was. */}
              <button
                type="button"
                aria-label={
                  isolated ? 'Leave the isolated view' : 'Isolate the video'
                }
                onClick={() => setZen(!isolated)}
                className="absolute right-2 top-2 rounded-lg bg-shell/60 p-2 text-ink/60 backdrop-blur transition hover:text-ink active:scale-95"
              >
                {isolated ? <CloseIcon /> : <ExpandIcon />}
              </button>
            </div>
          )}

          {/* Empty until the stories that fill them land. Each is named so it
              can be found at all — an unnamed empty div is invisible to a test
              that asks what the screen offers, which is the only question worth
              asking of a skeleton. One wrapper takes all five out at once,
              hidden rather than unmounted for the header's reason. */}
          <div hidden={isolated}>
            {/* Both halves are here now, so `justify-between` does what the
                mockup shows: the seek pair hard left, the stepper hard right.
                US-01-09 held this at `justify-end` while the stepper was the
                only child, and said US-01-08 would take it back — this is it. */}
            <div
              role="toolbar"
              aria-label="Seek and speed"
              className="mt-4 flex flex-wrap items-center justify-between gap-2 lg:mt-6"
            >
              {playback.kind === 'ready' && (
                <div className="flex gap-1.5">
                  <SeekButton
                    label={`Back ${NUDGE} second`}
                    onClick={nudge(-NUDGE)}
                  >
                    <BackGlyph />
                  </SeekButton>
                  <SeekButton
                    label={`Forward ${NUDGE} second`}
                    onClick={nudge(NUDGE)}
                  >
                    <ForwardGlyph />
                  </SeekButton>
                </div>
              )}
              {/* Gated exactly as the transport is. A rate control on a clip
                  that will not decode has nothing to apply itself to, and would
                  be the dead control US-01-07 already refused to draw. */}
              {playback.kind === 'ready' && (
                <SpeedStepper speed={speed} onChange={setSpeed} />
              )}
            </div>

            {/* The slider appears once there is a length to lay it out against,
                for the same reason the transport does: before metadata there is
                no region to frame, and a track spanning an unknown clip would be
                inviting the dancer to drag against nothing. */}
            <div role="group" aria-label="Loop range">
              {playback.kind === 'ready' && (
                <LoopSlider
                  duration={playback.duration}
                  loop={playback.loop}
                  time={time}
                  onSeek={seekTo}
                  onLoopChange={changeLoop}
                  onHold={setAdjusting}
                />
              )}
            </div>

            <ShortcutHint
              next={playback.kind === 'ready' ? nextPoint : null}
              halfSet={halfSet}
            />

            {/* The transport appears once there is something to control. Before
                metadata there is no region to loop and no length to return to,
                and a clip that will not decode has nothing to play — three dead
                controls would say the opposite. */}
            <div
              role="toolbar"
              aria-label="Transport"
              className="flex items-start justify-center gap-6"
            >
              {playback.kind === 'ready' && (
                <>
                  {/* Only the playhead moves. Nothing here touches `looping` or
                      calls play/pause, because restarting the section is what
                      the dancer does *while* it is running — stopping the music
                      or dropping the loop would be a second thing they did not
                      ask for. */}
                  <TransportButton
                    label="START"
                    onClick={() => seekTo(playback.loop.a)}
                  >
                    <StartGlyph />
                  </TransportButton>
                  <TransportButton
                    label={playback.looping ? 'LOOPING' : 'START LOOP'}
                    pressed={playback.looping}
                    onClick={toggleLooping}
                  >
                    <LoopGlyph />
                  </TransportButton>
                  <TransportButton
                    label={playing ? 'PAUSE' : 'PLAY'}
                    onClick={() => togglePlay(surface.current)}
                  >
                    {playing ? <PauseGlyph /> : <PlayGlyph />}
                  </TransportButton>
                </>
              )}
            </div>

            <SavedLoopsPanel
              loop={playback.kind === 'ready' ? playback.loop : null}
              speed={speed}
              halfSet={halfSet}
              saved={saved}
              name={loopName}
              writing={loops.writing}
              notice={loops.notice}
              onNameChange={setLoopName}
              onSave={saveLoop}
              onRecall={recallLoop}
              onRemove={removeLoop}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
