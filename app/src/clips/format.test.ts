import { describe, expect, it } from 'vitest'

import { formatTenths } from './format'

/* #116. Where an arrow-key scrub has got to, to the tenth of a second it
   steps by. */
describe('a time to the tenth of a second', () => {
  it('reads minutes, seconds and the tenth', () => {
    expect(formatTenths(5.1)).toBe('0:05.1')
    expect(formatTenths(65)).toBe('1:05.0')
  })

  it('rounds into the next minute rather than reading 60 seconds', () => {
    expect(formatTenths(59.97)).toBe('1:00.0')
  })
})
