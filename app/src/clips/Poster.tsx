import { useState } from 'react'

import type { Clip } from './clip'
import { POSTER_AT_SECONDS } from './thumbnail'
import { NO_SUCH_PICTURE_WIDTH, thumbnailsFor } from './youtube'

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
  /* #20. A YouTube entry has no bytes and no still of its own, but YouTube
     publishes pictures of every video, so those are its stills, sharpest
     first (#92). */
  const youtube = thumbnail === undefined && clip.videoId !== undefined
  const stills: readonly string[] =
    thumbnail !== undefined
      ? [thumbnail]
      : clip.videoId === undefined
        ? []
        : thumbnailsFor(clip.videoId)

  /* How far down the stills a tile has had to go, and separately whether the
     local file failed: a still that will not render must fall through to the
     local file rather than skip it, or a broken still would blank a tile that
     had a perfectly good clip behind it. */
  const [tried, setTried] = useState(0)
  const [failed, setFailed] = useState(false)
  const still = stills[tried]
  const tryTheNext = () => setTried((at) => at + 1)

  if (still !== undefined) {
    return (
      <img
        src={still}
        alt=""
        onError={tryTheNext}
        /* YouTube's answer for a picture it does not have draws rather than
           failing, so it is caught by its size. */
        onLoad={(event) => {
          if (youtube && event.currentTarget.naturalWidth <= NO_SUCH_PICTURE_WIDTH) {
            tryTheNext()
          }
        }}
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
