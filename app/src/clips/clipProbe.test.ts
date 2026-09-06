import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProbeHost } from './clipProbe'
import { clipProbe } from './clipProbe'

const aFile = () => new File([new Uint8Array(26)], 'Shuffle drill.mp4')

const A_MINTED_URL = 'blob:shuffle-drill'

/* No video decodes in jsdom and `duration` is a read-only NaN getter, so the
   length is defined onto a real element — a genuine EventTarget that answers
   whatever the case is about, rather than a hand-rolled stub that only looks
   like one. */
const aVideoReporting = (seconds: number) => {
  const element = document.createElement('video')

  Object.defineProperty(element, 'duration', { value: seconds })

  return element
}

const aProbeOver = (element: HTMLVideoElement, timeoutMs?: number) => {
  const releaseUrl = vi.fn()
  const host: ProbeHost = {
    createProbe: () => element,
    toUrl: () => A_MINTED_URL,
    releaseUrl,
  }

  return { read: clipProbe(host, timeoutMs), releaseUrl }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('reading a clip off a chosen file', () => {
  it('reports the length the file itself declares', async () => {
    const element = aVideoReporting(26)
    const { read } = aProbeOver(element)

    const reading = read(aFile())
    element.dispatchEvent(new Event('loadedmetadata'))

    await expect(reading).resolves.toEqual({
      ok: true,
      seconds: 26,
      src: A_MINTED_URL,
    })
  })

  it('keeps the url it minted for a clip it could read, since that is the clip', async () => {
    const element = aVideoReporting(26)
    const { read, releaseUrl } = aProbeOver(element)

    const reading = read(aFile())
    element.dispatchEvent(new Event('loadedmetadata'))
    await reading

    expect(releaseUrl).not.toHaveBeenCalled()
  })
})

describe('a file that yields no clip', () => {
  it('gives up on a file the browser refuses to decode', async () => {
    const element = aVideoReporting(26)
    const { read, releaseUrl } = aProbeOver(element)

    const reading = read(aFile())
    element.dispatchEvent(new Event('error'))

    await expect(reading).resolves.toEqual({ ok: false })
    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })

  /* A file can answer and still not say how long it is. Infinity reaches the
     tile as a length that is not one — the NaN:NaN case US-01-02 had to defend
     against, arriving from the other end. */
  it('gives up on a file that answers with no usable length', async () => {
    const element = aVideoReporting(Number.POSITIVE_INFINITY)
    const { read, releaseUrl } = aProbeOver(element)

    const reading = read(aFile())
    element.dispatchEvent(new Event('loadedmetadata'))

    await expect(reading).resolves.toEqual({ ok: false })
    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })

  /* The case the mockup cannot reach: no error, no metadata, nothing. Without
     the timeout this promise never settles and the dancer waits forever. */
  it('gives up on a file that never answers at all', async () => {
    vi.useFakeTimers()

    const A_SHORT_WAIT = 100
    const { read, releaseUrl } = aProbeOver(aVideoReporting(26), A_SHORT_WAIT)

    const reading = read(aFile())
    await vi.advanceTimersByTimeAsync(A_SHORT_WAIT)

    await expect(reading).resolves.toEqual({ ok: false })
    expect(releaseUrl).toHaveBeenCalledWith(A_MINTED_URL)
  })
})
