import { describe, expect, it } from 'vitest'

import { linkFromA, loopFileName } from './loopShare'

/* #123. A YouTube entry cannot be cut, so a loop of one is sent as a link
   that opens the video at A. */
describe('a link to a YouTube loop', () => {
  it('opens the video at A, to the second', () => {
    expect(linkFromA('EuT94T544Mg', 58.7)).toBe('https://youtu.be/EuT94T544Mg?t=58')
  })

  it('opens it at the start for a loop from the start', () => {
    expect(linkFromA('EuT94T544Mg', 0)).toBe('https://youtu.be/EuT94T544Mg?t=0')
  })
})

describe('the name a cut loop is sent under', () => {
  it('names it for the clip and the loop', () => {
    expect(loopFileName('Turn combo — Dubai', 'Basic')).toBe('Turn combo — Dubai – Basic.mp4')
  })

  /* A name is the dancer's to type, and some characters cannot be in a file
     name on one system or another. */
  it('makes a name a file system would refuse into one it takes', () => {
    expect(loopFileName('Class 3: shines', 'Left/right?')).toBe(
      'Class 3- shines – Left-right-.mp4',
    )
  })

  it('folds runs of spaces into one', () => {
    expect(loopFileName('  Wave   practice ', 'Loop 1')).toBe('Wave practice – Loop 1.mp4')
  })
})
