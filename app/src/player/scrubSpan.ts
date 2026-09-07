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
