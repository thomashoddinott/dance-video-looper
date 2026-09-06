import { useState } from 'react'

import type { Clip } from './clip'
import { POSTER_AT_SECONDS } from './thumbnail'

/* Three ways to fill a tile, in the order they cost:

     the stored still  #77, and the only one that survives a reload
     the local file    the clip was added in this session, so it is free
     nothing           a plain placeholder

   The still comes first because it is the one that is true everywhere. The
   local file is a fallback rather than the first choice precisely so a tile
   does not paint one way on the device that uploaded and another on the phone —
   and it covers the seconds between an add and its still reaching Drive.

   What is deliberately *not* here is the clip's own bytes fetched from Drive.
   That is ~9 MB and ~7 s a tile, which is the cost #77 exists to avoid. */
export function Poster({
  clip,
  thumbnail,
}: {
  readonly clip: Clip
  readonly thumbnail?: string | undefined
}) {
  /* Two flags rather than one, because a still that will not render must fall
     through to the local file rather than skip it. Sharing them would let a
     broken still blank a tile that had a perfectly good clip behind it. */
  const [stillFailed, setStillFailed] = useState(false)
  const [failed, setFailed] = useState(false)

  if (thumbnail !== undefined && !stillFailed) {
    return (
      <img
        src={thumbnail}
        alt=""
        onError={() => setStillFailed(true)}
        className="aspect-[9/16] w-full object-cover"
      />
    )
  }

  if (clip.src === undefined || failed) {
    return <div aria-hidden="true" className="aspect-[9/16] w-full bg-control" />
  }

  return (
    <video
      src={`${clip.src}#t=${POSTER_AT_SECONDS}`}
      preload="metadata"
      muted
      playsInline
      aria-hidden="true"
      onError={() => setFailed(true)}
      className="aspect-[9/16] w-full object-cover"
    />
  )
}
