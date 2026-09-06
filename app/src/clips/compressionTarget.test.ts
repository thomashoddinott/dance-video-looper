import { describe, expect, it } from 'vitest'

import { LONG_EDGE, mp4NameFor, targetSizeFor } from './clipCompressor'

describe('choosing what size to encode to', () => {
  it('caps the long edge of a portrait clip', () => {
    expect(targetSizeFor({ width: 1080, height: 1920 }, LONG_EDGE)).toEqual({
      width: 480,
      height: 854,
    })
  })

  /* The same rule, turned on its side. A cap on the long edge is what lets one
     rule serve both, where a cap on the width would quietly assume 9:16 —
     which UC-01 BR-16 says nothing here may do. */
  it('caps the long edge of a landscape clip by the same rule', () => {
    expect(targetSizeFor({ width: 1920, height: 1080 }, LONG_EDGE)).toEqual({
      width: 854,
      height: 480,
    })
  })

  it('leaves a clip that is already smaller exactly as it is', () => {
    expect(targetSizeFor({ width: 640, height: 360 }, LONG_EDGE)).toEqual({
      width: 640,
      height: 360,
    })
  })

  /* The spike's own case: a 1080p target against a 720x1280 source stayed
     720x1280, and only the bitrate did any work. */
  it('never upscales, however far above the source the cap sits', () => {
    expect(targetSizeFor({ width: 720, height: 1280 }, 1920)).toEqual({
      width: 720,
      height: 1280,
    })
  })

  /* Some H.264 profiles reject odd dimensions outright, so both edges have to
     land even. Rounding *down* is what keeps that from becoming a one-pixel
     upscale on a source that was already under the cap. */
  it('returns even edges, and never larger ones, for an odd-sized source', () => {
    expect(targetSizeFor({ width: 641, height: 361 }, LONG_EDGE)).toEqual({
      width: 640,
      height: 360,
    })
  })

  /* 2206x1508 is not 16:9 and not 9:16 — it is a screen recording, and the
     spike ran one precisely because nothing may assume a shape. */
  it('carries an odd aspect ratio through without cropping or stretching it', () => {
    expect(targetSizeFor({ width: 2206, height: 1508 }, LONG_EDGE)).toEqual({
      width: 854,
      height: 582,
    })
  })

  it('never returns an edge a codec could not encode', () => {
    expect(targetSizeFor({ width: 1, height: 1 }, LONG_EDGE)).toEqual({
      width: 2,
      height: 2,
    })
  })
})

/* Whatever came in, an mp4 comes out — so the name has to follow the bytes. A
   .MOV stored under its own extension would be a small lie in the dancer's own
   Drive folder, and the approval gate chose against it. */
describe('naming a clip that has been re-encoded', () => {
  it('re-extensions a QuickTime file', () => {
    expect(mp4NameFor('Shuffle drill.MOV')).toBe('Shuffle drill.mp4')
  })

  it('leaves a name that is already right alone', () => {
    expect(mp4NameFor('Shuffle drill.mp4')).toBe('Shuffle drill.mp4')
  })

  /* Clips are named by hand and by download tools, so a dot mid-name is
     ordinary rather than an edge case — only the last one is an extension. */
  it('only touches the last dot', () => {
    expect(mp4NameFor('Shuffle drill, take 2.best.mov')).toBe(
      'Shuffle drill, take 2.best.mp4',
    )
  })

  it('gives an extension to a name that had none', () => {
    expect(mp4NameFor('Shuffle drill')).toBe('Shuffle drill.mp4')
  })
})
