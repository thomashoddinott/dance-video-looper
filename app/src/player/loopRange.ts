import type { Loop } from './playback'

/* BR-18. The floor is not a useful loop length, it is the distance that stops
   the two handles crossing or landing on each other. */
export const MIN_LOOP = 0.2

/* One second, for the arrow keys and for the seek buttons alike. Fixed rather
   than scaled to the loop: the question of whether it should scale was closed at
   US-01-08's approval gate, on the grounds that it is a scrubbing-precision step
   and a second is about the coarseness of a beat. */
export const NUDGE = 1

export type Handle = 'a' | 'b'

/* Only the two fields the arithmetic reads, rather than a whole `DOMRect`. It
   keeps the mapping testable without a layout engine, which jsdom does not have
   — see `loopRange.test.ts`. */
export type Track = {
  readonly left: number
  readonly width: number
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const timeAt = ({
  clientX,
  track,
  duration,
}: {
  readonly clientX: number
  readonly track: Track
  readonly duration: number
}) => {
  if (track.width <= 0) return 0

  return clamp((clientX - track.left) / track.width, 0, 1) * duration
}

/* The one place a boundary moves. The drag, the arrow keys and Home/End all come
   through here, so the floor and the clip's own bounds cannot be enforced on one
   route and forgotten on another.

   The clip's bounds are applied last, and that ordering is the whole content of
   the shorter-than-the-floor case: on a clip of 0.1 s the floor would push B out
   past the end, and a clip you can see beats a rule about how long a loop should
   be. */
export const movedTo = ({
  loop,
  handle,
  seconds,
  duration,
}: {
  readonly loop: Loop
  readonly handle: Handle
  readonly seconds: number
  readonly duration: number
}): Loop =>
  handle === 'a'
    ? { ...loop, a: clamp(Math.min(seconds, loop.b - MIN_LOOP), 0, duration) }
    : { ...loop, b: clamp(Math.max(seconds, loop.a + MIN_LOOP), 0, duration) }
