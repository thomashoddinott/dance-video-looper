/* One seek in flight, always to the newest place the finger has asked for.

   A `pointermove` fires far faster than a seek on a ~6MB clip can land — the
   mockup gate measured a median of 49 ms against a pointer stream arriving every
   few milliseconds — so assigning `currentTime` on every one of them builds a
   queue the decoder then works through late, and the clip chases where the finger
   was half a second ago. That lag is what read as the bar freezing and jumping,
   and it is what #19 spent its whole life mistaking for a gain curve.

   The fix is not to seek faster. It is that every target but the newest is
   already wrong by the time it could be issued, so the gate forgets them instead
   of promising them. A fast drag therefore shows fewer frames but never falls
   behind, and a slow one — where seeks land faster than the finger asks — still
   resolves every single frame, which is the case this exists for.

   Pure, and separated from the element for `scrubSpan`'s reason: the arithmetic
   of what to seek and when is the part worth testing, and jsdom has no decoder to
   test it against. */
export type Gate = {
  readonly inFlight: boolean
  /* The one target held back, or nothing. Never a list — a queue is the bug. */
  readonly pending: number | null
}

export const idle: Gate = { inFlight: false, pending: null }

/* How long to wait for a seek to report back before assuming it never will.

   This is not a guard against a hypothetically lost event. Assigning
   `currentTime` the value the element already holds fires no `seeked` at all —
   so a drag that comes back to where it started, or a nudge against the end of
   the clip, would leave the gate waiting for a report that is never coming and
   the bar would stop moving for the rest of the session.

   Well above the 88 ms worst case the mockup gate measured, because the cost of
   being wrong in each direction is not symmetric: too long only delays the
   recovery from a seek that was never going to land, while too short would issue
   a second seek over a first that was merely slow, which is the queue this whole
   thing exists to avoid. */
export const SEEK_BACKSTOP = 400

/* Both readings return the gate's next state and the seek to issue, if any, so
   the caller never has to work out which it is. `null` means issue nothing. */
export type Move = {
  readonly gate: Gate
  readonly seek: number | null
}

export const requested = (gate: Gate, seconds: number): Move =>
  gate.inFlight
    ? { gate: { inFlight: true, pending: seconds }, seek: null }
    : { gate: { inFlight: true, pending: null }, seek: seconds }

/* A settle against an idle gate is a no-op rather than an error. Loop enforcement
   writes `currentTime` straight onto the element — a correctness rule, not a
   drag, and it does not ask the gate — but the `seeked` it fires still arrives
   here. */
export const settled = (gate: Gate): Move => {
  if (!gate.inFlight) return { gate: idle, seek: null }

  if (gate.pending === null) return { gate: idle, seek: null }

  return { gate: { inFlight: true, pending: null }, seek: gate.pending }
}
