import { describe, expect, it, vi } from 'vitest'

import type { EncodeHost } from './clipCompressor'
import { AUDIO_BITRATE, compressor, VIDEO_BITRATE } from './clipCompressor'

const aFile = ({ named = 'Shuffle drill.MOV', bytes = 44 } = {}) =>
  new File([new Uint8Array(bytes)], named, { lastModified: 1_756_000_000_000 })

/* A phone-shaped clip with a soundtrack, which is the ordinary case: portrait,
   well over the cap, and useless without its music. */
const aHost = (overrides: Partial<EncodeHost> = {}): EncodeHost => ({
  inspect: async () => ({ width: 1080, height: 1920, hasAudio: true }),
  encode: async () => new Blob([new Uint8Array(9)]),
  ...overrides,
})

const refusing = (because: string) => async () => {
  throw new Error(because)
}

describe('compressing a clip on its way to Drive', () => {
  it('sends the re-encoded bytes when they are smaller', async () => {
    const stored = await compressor(aHost())(aFile({ bytes: 44 }))

    expect(stored.size).toBe(9)
  })

  /* The spike's most useful finding: against a clip that has already been
     through a compressor — anything off Instagram, anything laundered through
     WhatsApp — three of six targets produced a *bigger* file, second-generation
     and visibly worse. Storing that would be strictly the worse of two options. */
  it('sends the original when the re-encode came out bigger', async () => {
    const original = aFile({ bytes: 44 })
    const host = aHost({ encode: async () => new Blob([new Uint8Array(96)]) })

    expect(await compressor(host)(original)).toBe(original)
  })

  it('sends the original when the re-encode saved nothing at all', async () => {
    const original = aFile({ bytes: 44 })
    const host = aHost({ encode: async () => new Blob([new Uint8Array(44)]) })

    expect(await compressor(host)(original)).toBe(original)
  })

  /* iOS Safari 16.4-18.7 is the case this is really for: it has VideoEncoder,
     it has no AudioEncoder, and it dies partway through any clip whose audio
     starts a few tens of milliseconds off the video — which both files the
     spike measured did. Whatever the reason, the add has to survive it. */
  it('sends the original when the encoder fails partway through', async () => {
    const original = aFile()
    const host = aHost({ encode: refusing('AudioEncoder is not available') })

    expect(await compressor(host)(original)).toBe(original)
  })

  it('sends the original when the file cannot even be read for its shape', async () => {
    const original = aFile()
    const host = aHost({ inspect: refusing('no WebCodecs here') })

    expect(await compressor(host)(original)).toBe(original)
  })

  it('names the re-encoded file for the container it is now in', async () => {
    const stored = await compressor(aHost())(aFile({ named: 'Shuffle drill.MOV' }))

    expect(stored.name).toBe('Shuffle drill.mp4')
  })

  it('leaves the picked name untouched when the original is what goes up', async () => {
    const host = aHost({ encode: refusing('nope') })

    const stored = await compressor(host)(aFile({ named: 'Shuffle drill.MOV' }))

    expect(stored.name).toBe('Shuffle drill.MOV')
  })

  it('asks for practice quality: the long edge capped, at the chosen bitrate', async () => {
    const encode = vi.fn(async () => new Blob([new Uint8Array(9)]))

    await compressor(aHost({ encode }))(aFile())

    expect(encode).toHaveBeenCalledWith(expect.anything(), {
      width: 480,
      height: 854,
      videoBitrate: VIDEO_BITRATE,
      audioBitrate: AUDIO_BITRATE,
    })
  })

  it('never asks the encoder to make a small clip bigger', async () => {
    const encode = vi.fn(async () => new Blob([new Uint8Array(9)]))
    const host = aHost({
      inspect: async () => ({ width: 640, height: 360, hasAudio: true }),
      encode,
    })

    await compressor(host)(aFile())

    expect(encode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 640, height: 360 }),
    )
  })

  /* Mediabunny is asked for an audio track only when there is one to re-encode.
     Asking for one that does not exist is how a silent clip fails. */
  it('asks for no audio when the clip has none', async () => {
    const encode = vi.fn(async () => new Blob([new Uint8Array(9)]))
    const host = aHost({
      inspect: async () => ({ width: 1080, height: 1920, hasAudio: false }),
      encode,
    })

    await compressor(host)(aFile())

    expect(encode).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ audioBitrate: null }),
    )
  })
})
