/* Sorts named regions by where they actually sit in the document, so the
   assertion reads as the running order and a failure names the wrong sequence.
   Binds to order alone — nesting, wrappers and class names can all change. */
export const inDocumentOrder = (regions: Readonly<Record<string, Element>>) =>
  Object.entries(regions)
    .sort(([, one], [, other]) =>
      one.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    )
    .map(([name]) => name)
