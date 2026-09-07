import { useRef, useState } from 'react'

import { formatDuration } from '../clips/format'
import type { Loop } from './playback'
import { ratioOf, secondsAt, spanned } from './scrubSpan'

/* Where you are in the clip, drawn on the clip itself. The video carried no
   position indicator at all before this — no `controls`, nothing of our own — so
   it played blind.

   It rides inside the video wrapper rather than under the card, which is what
   makes it survive zen: the whole control strip is hidden there, so this is the
   only thing left saying where the clip has got to, and that is the case it
   matters most in.

   Deliberately not a second loop slider. The two answer different questions
   about the same timeline — that one is "which few seconds am I working on",
   this one is "where am I" — and neither can do the other's job. Nothing here
   touches A or B. */
export function VideoProgress({
  time,
  duration,
  loop,
  looping,
  onScrub,
  onHold,
  rounded,
}: {
  readonly time: number
  readonly duration: number
  readonly loop: Loop
  readonly looping: boolean
  readonly onScrub: (seconds: number) => void
  /* BR-19, reaching the second surface that can pull the playhead. Dragging to
     the far end of a rescaled bar lands exactly on B, and enforcement fires on
     `currentTime >= b` — so without this the clip jumps to A while the finger is
     still at the right-hand edge and the fill snaps to empty underneath it.

     The mockup left this open, and it is settled the way a held handle already
     settles it: the clip genuinely is at B, it was put there on purpose, and no
     reading of `currentTime` can tell that apart from having arrived. */
  readonly onHold: (held: boolean) => void
  /* Follows the clip's own corners, so the scrim does not square off a rounded
     video. Zen has no rounding to follow. */
  readonly rounded?: string | undefined
}) {
  const track = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const span = spanned({ loop, looping, duration })
  const at = `${ratioOf(time, span) * 100}%`

  const scrubTo = (clientX: number) =>
    onScrub(
      secondsAt({
        clientX,
        track: track.current?.getBoundingClientRect() ?? { left: 0, width: 0 },
        span,
      }),
    )

  /* Both edges of the window in one place, beside the state already tracking the
     drag, so the hold and the drag cannot come to different answers about
     whether the dancer has hold of the playhead — the arrangement `LoopSlider`
     uses for the same reason. */
  const grab = () => {
    setDragging(true)
    onHold(true)
  }

  const letGo = () => {
    setDragging(false)
    onHold(false)
  }

  return (
    /* `pointer-events-none` on the whole scrim, taken back only by the grab
       strip below. The video surface is the play/pause target, so a bar owning
       the bottom of the frame would cost the dancer tapping the clip to pause
       it — and the scrim is a good deal taller than the line it draws. */
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 select-none bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 ${rounded ?? ''}`}
    >
      {/* Two facts, and the row has room for both.

          Left: what the bar spans, shown only once that is no longer the whole
          clip. It is what carries the rescale, which is otherwise abrupt and
          invisible — the bar's meaning changes in a single frame, and without
          this a playhead sitting mid-bar at 1:03 of a 2:28 clip simply looks
          wrong.

          Right: where you actually are, absolute rather than relative to the
          span. That is the number you came for, and a rescaled bar must not
          change what the clock says. */}
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] tabular-nums text-white/60 drop-shadow">
          {span.rescaled
            ? `${formatDuration(span.from)} – ${formatDuration(span.to)}`
            : ''}
        </span>
        <span className="text-[11px] tabular-nums text-white/80 drop-shadow">
          {formatDuration(time)} / {formatDuration(duration)}
        </span>
      </div>

      {/* Capture keeps the drag alive when the finger slides off the strip, as
          it does on the loop handles — and optional-called for their reason too,
          because jsdom implements no pointer capture and a bare call would throw
          in every test that drags. */}
      <div
        ref={track}
        /* A 2px line is not a touch target. The padding gives a thumb ~28px to
           land in while the line itself stays hairline, and the negative margin
           keeps that height from pushing the bar off the bottom of the frame.
           `touch-none` is the other half: without it a drag down the bottom of a
           video is read as a page scroll and the bar never sees it. */
        className="scrub-track group pointer-events-auto -my-3 cursor-pointer touch-none py-3"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId)
          grab()
          scrubTo(event.clientX)
        }}
        /* A move with no drag behind it is a mouse passing over the bar on its
           way somewhere else; seeking on that would make the clip jump whenever
           the pointer crossed the video. */
        onPointerMove={(event) => {
          if (dragging) scrubTo(event.clientX)
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture?.(event.pointerId)
          letGo()
        }}
        /* A drag that leaves the window never sees its own pointer-up, and a
           loop left stood down would be a clip that quietly stopped looping. */
        onPointerCancel={letGo}
      >
        <div
          className={`relative w-full rounded-full bg-white/20 transition-[height] ${
            dragging ? 'h-1' : 'h-0.5 group-hover:h-1'
          }`}
        >
          <div
            className="scrub-fill absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: at }}
          />
          <div
            className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform ${
              dragging ? 'scale-100' : 'scale-0 group-hover:scale-100'
            }`}
            style={{ left: at }}
          />
        </div>
      </div>
    </div>
  )
}
