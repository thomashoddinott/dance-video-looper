/* BR-06. The floor is the part that was argued over and it is deliberately low:
   a tenth speed is well past where a clip stays intelligible, and it stays on
   offer anyway because travel the dancer stops using costs nothing, while a
   floor set too high cannot be stepped past at all. Confirmed at US-01-09's
   approval gate (#25). */
export const SPEED_MIN = 0.1
export const SPEED_MAX = 2
export const SPEED_STEP = 0.05
export const SPEED_STEP_BIG = 0.1

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/* Rounded here and nowhere else. A rate is reached by pressing a control over
   and over, and thirteen presses of 0.05 in plain floating point come to
   0.34999999999999987 — which is what the dancer would then read off the screen.
   Settling it at the one place a rate is produced is what lets everything
   downstream render the number as-is; the mockup rounds a second time when it
   formats, and carrying that across would put the same rule in two places. */
export const stepped = ({
  from,
  by,
}: {
  readonly from: number
  readonly by: number
}) => Math.round(clamp(from + by, SPEED_MIN, SPEED_MAX) * 100) / 100
