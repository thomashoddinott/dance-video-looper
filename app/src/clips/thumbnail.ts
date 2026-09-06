import { targetSizeFor } from './clipCompressor'

/* How far into a clip the kept frame comes from. Carried from `Poster`, which
   seeked here on every tile, and from the mockup before it (`Library.jsx:26`):
   far enough in that a clip opening on black does not become a black tile. */
export const POSTER_AT_SECONDS = 3

/* A clip shorter than that has no frame there at all — seeking past the end
   yields nothing, which is the blank tile this ticket exists to remove — so it
   gives up the standard timestamp and takes its middle instead.

   A length that is not a usable number falls back to the opening frame rather
   than to nothing. `clipProbe` already refuses a file whose duration is not
   finite, so this is reachable only for a clip whose length was never stored
   (`Clip.seconds` is optional for exactly that reason), and a dark tile beats a
   tile that never renders. */
export const frameAt = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0

  return seconds > POSTER_AT_SECONDS ? POSTER_AT_SECONDS : seconds / 2
}

/* A tile is a couple of hundred CSS pixels wide, so this is generous even at
   the densest phone. Storing the frame at its source size would put most of
   what US-01-17 saved straight back — and the whole case for keeping stills at
   all is that they cost tens of kilobytes against a clip's nine megabytes. */
export const THUMBNAIL_LONG_EDGE = 480

/* JPEG rather than PNG: this is photographic content, and a PNG of the same
   frame is an order of magnitude larger for a difference nobody sees at tile
   size. */
export const THUMBNAIL_TYPE = 'image/jpeg'
export const THUMBNAIL_QUALITY = 0.7

/* What is actually used of a canvas, named rather than taking
   `HTMLCanvasElement` — the discipline `FetchLike` and `ProbeHost` already
   apply. jsdom has no 2D context and no `toBlob`, so depending on the DOM type
   would mean a capture no test in this project could drive. */
export type FrameCanvas = {
  readonly draw: (
    frame: HTMLVideoElement,
    width: number,
    height: number,
  ) => void
  readonly toBlob: () => Promise<Blob | null>
}

export type ThumbnailHost = {
  readonly createProbe: () => HTMLVideoElement
  readonly createCanvas: () => FrameCanvas
  readonly toUrl: (bytes: Blob) => string
  readonly releaseUrl: (url: string) => void
}

/* Null, never a rejection. #77's fourth criterion is that a still which cannot
   be made leaves a grey tile rather than a failed add, and putting that in the
   type means no caller has to remember a `catch` to honour it.

   The length is read off the element rather than passed in: the bytes and their
   duration cannot then disagree, which matters because the backfill path has
   only bytes — a clip listed from Drive may carry no stored length at all. */
export type ThumbnailCapture = (bytes: Blob) => Promise<Blob | null>

/* `clipProbe`'s ceiling, for the same reason: bytes already on the device
   answer in milliseconds or not at all. */
const EIGHT_SECONDS = 8000

export const thumbnailCapture =
  (host: ThumbnailHost, timeoutMs: number = EIGHT_SECONDS): ThumbnailCapture =>
  (bytes) =>
    new Promise<Blob | null>((resolve) => {
      const src = host.toUrl(bytes)
      const probe = host.createProbe()

      /* The one piece of mutable state here, and it is not optional: the
         timeout and a late `seeked` race, so without it a slow clip releases
         its url twice — once on giving up, once on arriving afterwards. */
      let settled = false

      const give = (thumbnail: Blob | null) => {
        if (settled) return

        settled = true
        clearTimeout(timer)
        host.releaseUrl(src)
        resolve(thumbnail)
      }

      const timer = setTimeout(() => {
        give(null)
      }, timeoutMs)

      const capture = async () => {
        try {
          const canvas = host.createCanvas()
          const { width, height } = targetSizeFor(
            { width: probe.videoWidth, height: probe.videoHeight },
            THUMBNAIL_LONG_EDGE,
          )

          canvas.draw(probe, width, height)

          give(await canvas.toBlob())
        } catch {
          /* A canvas tainted by cross-origin bytes throws on read rather than
             answering. It is unreachable from a blob url, and costing a tile is
             the right price for being wrong about that. */
          give(null)
        }
      }

      /* `loadeddata` rather than `loadedmetadata`: metadata is enough to know
         how long a clip is, which is all `clipProbe` wanted, but drawing needs
         a decoded frame to draw. */
      probe.addEventListener(
        'loadeddata',
        () => {
          const at = frameAt(probe.duration)

          /* Setting `currentTime` to where the playhead already is fires no
             `seeked`, so seeking to the opening frame would wait on an event
             that never comes. What is already loaded is what we want anyway. */
          if (at === 0) {
            void capture()

            return
          }

          probe.addEventListener(
            'seeked',
            () => {
              void capture()
            },
            { once: true },
          )

          probe.currentTime = at
        },
        { once: true },
      )

      probe.addEventListener(
        'error',
        () => {
          give(null)
        },
        { once: true },
      )

      /* `auto`, unlike the probe's `metadata`: a frame has to be decoded, not
         merely described. Muted because some browsers will not load a video
         element at all without a gesture unless it is. */
      probe.preload = 'auto'
      probe.muted = true
      probe.src = src
    })

/* ------------------------------------------------------------- the browser's

   The edge, and the same waiver `browserProbeHost` carries: jsdom has neither
   a decoder nor a 2D context, so these lines are the part no test here drives.
   Everything decidable without one was pushed above them. */
export const browserThumbnailHost: ThumbnailHost = {
  createProbe: () => document.createElement('video'),

  createCanvas: () => {
    const canvas = document.createElement('canvas')

    return {
      draw: (frame, width, height) => {
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')?.drawImage(frame, 0, 0, width, height)
      },
      toBlob: () =>
        new Promise((resolve) => {
          canvas.toBlob(resolve, THUMBNAIL_TYPE, THUMBNAIL_QUALITY)
        }),
    }
  },

  toUrl: (bytes) => URL.createObjectURL(bytes),
  releaseUrl: (url) => {
    URL.revokeObjectURL(url)
  },
}

export const browserThumbnailCapture = thumbnailCapture(browserThumbnailHost)
