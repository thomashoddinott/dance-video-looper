/* jsdom runs no layout: every element reports a `getBoundingClientRect()` of all
   zeroes whatever the stylesheet says, so anything that reads a pointer against
   the size of an element is untestable until the element is given a size.

   Only `left` and `width` are worth setting here — they are what the loop
   slider's arithmetic reads (`player/loopRange.ts`), and inventing plausible
   values for the other six fields would be dressing rather than fidelity. The
   rest answer 0, which is what jsdom already says. */
export const laidOut = <T extends Element>(
  element: T,
  { left = 0, width = 200 }: { readonly left?: number; readonly width?: number } = {},
) => {
  element.getBoundingClientRect = () => ({
    left,
    width,
    right: left + width,
    x: left,
    top: 0,
    bottom: 0,
    height: 0,
    y: 0,
    toJSON: () => ({}),
  })

  return element
}
