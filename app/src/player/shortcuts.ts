import { type Handle, movedTo } from './loopRange'
import type { Loop } from './playback'

/* BR-05. Every shortcut on this screen is space or a single printing character,
   so a caret in a text field turns each of them into something the dancer meant to
   type — a loop could not otherwise be named "space fix" without reframing the
   clip.

   Asked of what the key landed on rather than of what has focus, because that is
   what the event carries and the two cannot then disagree.

   The mockup also asks `isContentEditable`, and this does not. There is no
   rich-text surface in the app and none in any story, so the branch would be
   guarding nothing — and jsdom implements the property as `undefined`, so it could
   not have been tested even as speculation. One line to add, next to a field that
   needs it. */
export const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')

/* BR-03. A press answers two things at once — where the loop ends up, and which
   boundary the next press lands on — and they come back together because they are
   one decision. Worked out apart, a caller could set A and then arm A again.

   `Handle` rather than a second `'a' | 'b'`: the boundary space sets and the
   boundary a drag moves are the same boundary, and two names for it would let the
   two routes drift.

   Setting A is unfloored, unlike every other route to a boundary — BR-18's one
   exception, settled at US-01-10's approval gate. Where the dancer pressed is the
   whole content of the press, and moving A back to make room would put it
   somewhere they did not choose. B goes through `movedTo` as the drag and the
   arrow keys do, so the floor keeps one home and the two can still never cross. */
export const spaceSets = ({
  loop,
  handle,
  seconds,
  duration,
}: {
  readonly loop: Loop
  readonly handle: Handle
  readonly seconds: number
  readonly duration: number
}): { readonly loop: Loop; readonly next: Handle } =>
  handle === 'a'
    ? { loop: { a: seconds, b: duration }, next: 'b' }
    : { loop: movedTo({ loop, handle, seconds, duration }), next: 'a' }
