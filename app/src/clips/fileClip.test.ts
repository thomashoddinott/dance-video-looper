import { describe, expect, it } from 'vitest'

import { clipIdFor, nameFromFilename } from './fileClip'

/* Size is decided by the content, so it is asked for in bytes and filled in. */
const aFile = ({
  named = 'Shuffle drill.mp4',
  bytes = 26,
  lastModified = 1_756_000_000_000,
}: {
  readonly named?: string
  readonly bytes?: number
  readonly lastModified?: number
} = {}) => new File([new Uint8Array(bytes)], named, { lastModified })

describe('naming a clip after the file it came from', () => {
  it('drops the extension, which is about the file rather than the dance', () => {
    expect(nameFromFilename('Shuffle drill.mp4')).toBe('Shuffle drill')
  })

  /* Clips are named by hand and by download tools, so a dot mid-name is
     ordinary. Only the last one separates an extension. */
  it('keeps the dots inside a name, dropping only the last', () => {
    expect(nameFromFilename('8-count. take 2.mov')).toBe('8-count. take 2')
  })

  it('leaves a filename carrying no extension alone', () => {
    expect(nameFromFilename('Shuffle drill')).toBe('Shuffle drill')
  })
})

/* A clip's id *is* its identity: the same file picked twice has to land on the
   same id, or the library cannot tell a repeat from a new clip. */
describe('identifying the file a clip came from', () => {
  it('gives the same file the same id however often it is picked', () => {
    expect(clipIdFor(aFile())).toBe(clipIdFor(aFile()))
  })

  it('tells two files apart by name', () => {
    expect(clipIdFor(aFile({ named: 'Wave practice.mp4' }))).not.toBe(
      clipIdFor(aFile()),
    )
  })

  it('tells two files apart by size', () => {
    expect(clipIdFor(aFile({ bytes: 74 }))).not.toBe(clipIdFor(aFile()))
  })

  /* The field that separates a re-download from a re-pick: same name, same
     size, saved again. */
  it('tells two files apart by when they were last modified', () => {
    expect(clipIdFor(aFile({ lastModified: 1_756_999_999_999 }))).not.toBe(
      clipIdFor(aFile()),
    )
  })

  /* The id goes straight into a path (`ClipTile.tsx`), so a filename full of
     spaces and punctuation must not produce one that needs escaping. */
  it('survives being put in a URL, whatever the file was called', () => {
    const id = clipIdFor(aFile({ named: 'Shuffle drill / take #2 (best).mp4' }))

    expect(encodeURIComponent(id)).toBe(id)
  })
})
