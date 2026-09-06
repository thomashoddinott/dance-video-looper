import { afterEach, describe, expect, it, vi } from 'vitest'

import { playable } from '../test/media'
import type { FrameCanvas, ThumbnailHost } from './thumbnail'
import {
  frameAt,
  POSTER_AT_SECONDS,
  THUMBNAIL_LONG_EDGE,
  thumbnailCapture,
} from './thumbnail'

describe('choosing which frame to keep', () => {
  /* The timestamp the grid has always seeked to (`Poster.tsx`) and the mockup
     with it — far enough in that a clip opening on black does not become a
     black tile. */
  it('takes a frame a few seconds in on a clip long enough to have one', () => {
    expect(frameAt(26)).toBe(POSTER_AT_SECONDS)
  })

  /* Seeking past the end yields no frame at all, which is the blank tile this
     ticket exists to remove — so a short clip gives up the standard timestamp
     rather than the frame. */
  it('takes a frame from inside a clip shorter than that', () => {
    expect(frameAt(2)).toBe(1)
  })

  it('stays inside a clip barely longer than the standard timestamp', () => {
    expect(frameAt(POSTER_AT_SECONDS)).toBeLessThan(POSTER_AT_SECONDS)
  })

  /* `Clip.seconds` is optional because a length can be genuinely unknown, and
     `clipProbe` refuses a file whose duration is not finite. Nothing is left to
     seek to, so the opening frame is the honest answer — a tile that is dark
     beats one that never renders. */
  it('falls back to the opening frame when the length is not a usable number', () => {
    expect(frameAt(Number.POSITIVE_INFINITY)).toBe(0)
    expect(frameAt(Number.NaN)).toBe(0)
    expect(frameAt(0)).toBe(0)
    expect(frameAt(-1)).toBe(0)
  })
})

const someBytes = () => new Blob([new Uint8Array(26)], { type: 'video/mp4' })

const A_MINTED_URL = 'blob:shuffle-drill'
const A_THUMBNAIL = new Blob([new Uint8Array(4)], { type: 'image/jpeg' })

/* jsdom decodes nothing: `duration` is a read-only NaN, `currentTime` reads 0
   forever, and the frame size is 0x0 whatever was loaded. `playable` already
   stands up the first two on a real element — a genuine EventTarget rather
   than a stub that only looks like one — and the frame size is defined the
   same way. */
const aVideoOf = ({
  seconds,
  width = 1080,
  height = 1920,
}: {
  readonly seconds: number
  readonly width?: number
  readonly height?: number
}) => {
  const element = playable(document.createElement('video'), { seconds })

  Object.defineProperty(element, 'videoWidth', { value: width })
  Object.defineProperty(element, 'videoHeight', { value: height })

  return element
}

const aCaptureOver = (
  element: HTMLVideoElement,
  {
    thumbnail = A_THUMBNAIL as Blob | null,
    timeoutMs,
  }: { readonly thumbnail?: Blob | null; readonly timeoutMs?: number } = {},
) => {
  const releaseUrl = vi.fn()
  const draw = vi.fn()
  const canvas: FrameCanvas = { draw, toBlob: async () => thumbnail }
  const host: ThumbnailHost = {
    createProbe: () => element,
    createCanvas: () => canvas,
    toUrl: () => A_MINTED_URL,
    releaseUrl,
  }

  return { capture: thumbnailCapture(host, timeoutMs), releaseUrl, draw }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('capturing a still from a clip', () => {
  it('keeps the frame a few seconds in', async () => {
    const element = aVideoOf({ seconds: 26 })
    const { capture } = aCaptureOver(element)

    const capturing = capture(someBytes())
    element.dispatchEvent(new Event('loadeddata'))

    expect(element.currentTime).toBe(POSTER_AT_SECONDS)

    element.dispatchEvent(new Event('seeked'))

    await expect(capturing).resolves.toBe(A_THUMBNAIL)
  })

  /* Tens of kilobytes is the whole point — a tile is a couple of hundred
     pixels wide, and storing a 1080x1920 still would put most of a clip's
     saving straight back. `targetSizeFor` is the same rule the encoder caps
     with, so a portrait clip stays portrait (BR-16). */
  it('draws it down to something a tile can afford', async () => {
    const element = aVideoOf({ seconds: 26, width: 1080, height: 1920 })
    const { capture, draw } = aCaptureOver(element)

    const capturing = capture(someBytes())
    element.dispatchEvent(new Event('loadeddata'))
    element.dispatchEvent(new Event('seeked'))
    await capturing

    expect(draw).toHaveBeenCalledWith(element, 270, THUMBNAIL_LONG_EDGE)
  })

  /* Setting `currentTime` to where the playhead already is fires no `seeked`
     in a browser, so a clip with nothing to seek to would wait for an event
     that never comes and time out into a grey tile. It is captured from the
     frame it already has instead. */
  it('captures without seeking when there is nowhere to seek to', async () => {
    const element = aVideoOf({ seconds: Number.NaN })
    const { capture } = aCaptureOver(element)

    const capturing = capture(someBytes())
    element.dispatchEvent(new Event('loadeddata'))

    await expect(capturing).resolves.toBe(A_THUMBNAIL)
  })

  it('lets go of the url it minted, however it turned out', async () => {
    const element = aVideoOf({ seconds: 26 })
    const { capture, releaseUrl } = aCaptureOver(element)

    const capturing = capture(someBytes())
    element.dispatchEvent(new Event('loadeddata'))
    element.dispatchEvent(new Event('seeked'))
    await capturing

    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })
})

/* Every one of these resolves rather than rejecting, and that is the whole
   contract: #77 says a still that cannot be made leaves a grey tile and never
   a failed add, so the caller has nothing to catch. */
describe('a clip that yields no still', () => {
  it('gives up on a clip the browser refuses to decode', async () => {
    const element = aVideoOf({ seconds: 26 })
    const { capture, releaseUrl } = aCaptureOver(element)

    const capturing = capture(someBytes())
    element.dispatchEvent(new Event('error'))

    await expect(capturing).resolves.toBeNull()
    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })

  it('gives up when the canvas will not encode what it drew', async () => {
    const element = aVideoOf({ seconds: 26 })
    const { capture, releaseUrl } = aCaptureOver(element, { thumbnail: null })

    const capturing = capture(someBytes())
    element.dispatchEvent(new Event('loadeddata'))
    element.dispatchEvent(new Event('seeked'))

    await expect(capturing).resolves.toBeNull()
    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })

  it('gives up on a clip that never answers at all', async () => {
    vi.useFakeTimers()

    const A_SHORT_WAIT = 100
    const { capture, releaseUrl } = aCaptureOver(aVideoOf({ seconds: 26 }), {
      timeoutMs: A_SHORT_WAIT,
    })

    const capturing = capture(someBytes())
    await vi.advanceTimersByTimeAsync(A_SHORT_WAIT)

    await expect(capturing).resolves.toBeNull()
    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })

  /* A seek that lands after the wait is over must not release a url that has
     already been let go, nor hand back a still nobody is waiting for. */
  it('stays given up once it has given up', async () => {
    vi.useFakeTimers()

    const A_SHORT_WAIT = 100
    const element = aVideoOf({ seconds: 26 })
    const { capture, releaseUrl } = aCaptureOver(element, {
      timeoutMs: A_SHORT_WAIT,
    })

    const capturing = capture(someBytes())
    await vi.advanceTimersByTimeAsync(A_SHORT_WAIT)
    element.dispatchEvent(new Event('loadeddata'))
    element.dispatchEvent(new Event('seeked'))

    await expect(capturing).resolves.toBeNull()
    expect(releaseUrl).toHaveBeenCalledTimes(1)
  })
})
