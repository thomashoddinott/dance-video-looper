import { describe, expect, it } from 'vitest'

import { getClip } from './clip.factory'
import { fitsAsGroupName, groupsOf } from './clipGroups'

/* #70. There is no list of groups beside the clips: they are read off them. */
describe('the groups in a library', () => {
  it('are the groups its clips are in, each once, with how many clips', () => {
    const groups = groupsOf([
      getClip({ id: 'a', group: 'Shines', added: '2026-08-11' }),
      getClip({ id: 'b', group: 'Shines', added: '2026-08-12' }),
      getClip({ id: 'c', added: '2026-08-13' }),
    ])

    expect(groups).toEqual([{ name: 'Shines', count: 2 }])
  })

  /* Back from a lesson, that lesson's group is the one wanted: a group is as
     recent as its most recently added clip. */
  it('come newest first, by the newest clip in each', () => {
    const groups = groupsOf([
      getClip({ id: 'a', group: 'Tuesday class · 20 Aug', added: '2026-08-21' }),
      getClip({ id: 'b', group: 'Shines', added: '2026-08-11' }),
      getClip({ id: 'c', group: 'Tuesday class · 27 Aug', added: '2026-08-28' }),
      getClip({ id: 'd', group: 'Shines', added: '2026-08-25' }),
    ])

    expect(groups.map(({ name }) => name)).toEqual([
      'Tuesday class · 27 Aug',
      'Shines',
      'Tuesday class · 20 Aug',
    ])
  })

  it('are none in a library with no clip in a group', () => {
    expect(groupsOf([getClip({ id: 'a' })])).toEqual([])
  })
})

describe('a name Drive can keep as a group', () => {
  it('fits in the bytes Drive keeps beside the key', () => {
    expect(fitsAsGroupName('x'.repeat(119))).toBe(true)
    expect(fitsAsGroupName('x'.repeat(120))).toBe(false)
  })

  it('is counted in bytes, not characters', () => {
    expect(fitsAsGroupName('·'.repeat(59))).toBe(true)
    expect(fitsAsGroupName('·'.repeat(60))).toBe(false)
  })
})
