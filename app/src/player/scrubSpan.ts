import { clamp, type Track } from './loopRange'
import type { Loop } from './playback'

/* How close to an end of the clip still counts as being at it. A and B arrive
   from a drag across real geometry, so a loop the dancer dragged out to the very
   end lands a rounding error short of `duration` about half the time — and an
   exact comparison would leave the bar zoomed to 99.9% of the clip, which reads
   as a bug and scrubs like one. */
export const EDGE = 0.05

/* What the bar lays itself out against. Named rather than a bare pair because
   every reading below is relative to it: a ratio is a position within the span,
   never within the clip. */
export type Span = {
  readonly from: number
  readonly to: number
}

/* The rescale, and the whole reason this is not a second loop slider. Six
   seconds of a 2:28 clip is 4% of the bar — technically scrubbable, actually
   impossible, and the tighter the loop the worse it gets, which is backwards: a
   tight loop is exactly when you most need to move inside it.

   So the bar spans the loop whenever there is a loop penning the playhead in.
   The full width always buys you the loop, so a narrower loop scrubs finer.

   It also replaces clamping rather than adding to it. Nothing has to refuse a
   drag or dim what is out of reach — outside the loop is simply off the end of
   the bar, and a ratio cannot leave 0..1.

   A loop spanning the whole clip pens nothing in, so it does not rescale: that
   is the case that leaves the rest of the clip reachable at all. One end being
   meaningfully inside is enough, because a loop trimmed only at the front is the
   commonest kind and wants the rescale as much as any other. */
export const spanned = ({
  loop,
  looping,
  duration,
}: {
  readonly loop: Loop
  readonly looping: boolean
  readonly duration: number
}): Span => {
  const penned =
    looping &&
    duration > 0 &&
    loop.b > loop.a &&
    (loop.a > EDGE || loop.b < duration - EDGE)

  return penned ? { from: loop.a, to: loop.b } : { from: 0, to: duration }
}

/* Where a moment sits along the bar, as a fraction of the span rather than of
   the clip — which is what draws the playhead in the right place once the bar
   has rescaled: empty at A, full at B, whatever the clip's length.

   Clamped because the playhead can be outside the span for a moment: the loop
   was just moved, or looping was turned on while the clip was elsewhere. It
   parks at the end it went past rather than being drawn off the bar. */
export const ratioOf = (seconds: number, span: Span) => {
  const width = span.to - span.from

  if (width <= 0) return 0

  return clamp((seconds - span.from) / width, 0, 1)
}

/* The same relationship read the other way: a pointer on the bar is a moment in
   the span. Kept beside `ratioOf` because they are one mapping, and separating
   them is how the drawn position and the dragged one come to disagree.

   This is where criterion four is enforced, and it is enforced by not existing:
   a ratio cannot leave 0..1, so the span's ends are the only places a drag can
   reach. Nothing has to refuse the part of the drag that goes past them. */
export const secondsAt = ({
  clientX,
  track,
  span,
}: {
  readonly clientX: number
  readonly track: Track
  readonly span: Span
}) => {
  if (track.width <= 0) return span.from

  const ratio = clamp((clientX - track.left) / track.width, 0, 1)

  return span.from + ratio * (span.to - span.from)
}
