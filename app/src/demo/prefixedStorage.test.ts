import { describe, expect, it } from 'vitest'

import { inMemoryStorage } from '../drive/keyValueStorage.factory'
import { prefixedStorage } from './prefixedStorage'

/* The demo keeps its loops in the same `localStorage` the real library caches
   into, under the same key names the real code writes. Without the prefix a
   visitor's demo loops would be read back as the dancer's own. */
describe('a storage kept apart under a prefix', () => {
  it('gives back what it was given', () => {
    const storage = prefixedStorage(inMemoryStorage(), 'looper.demo.')

    storage.setItem('looper.loops', 'demo loops')

    expect(storage.getItem('looper.loops')).toBe('demo loops')
  })

  it('never touches the key it was asked for in the storage beneath', () => {
    const beneath = inMemoryStorage({ 'looper.loops': 'the real loops' })
    const storage = prefixedStorage(beneath, 'looper.demo.')

    storage.setItem('looper.loops', 'demo loops')

    expect(beneath.getItem('looper.loops')).toBe('the real loops')
    expect(beneath.getItem('looper.demo.looper.loops')).toBe('demo loops')
  })

  it('does not read the real key through the prefix', () => {
    const beneath = inMemoryStorage({ 'looper.loops': 'the real loops' })

    expect(
      prefixedStorage(beneath, 'looper.demo.').getItem('looper.loops'),
    ).toBeNull()
  })

  it('removes only its own copy', () => {
    const beneath = inMemoryStorage({
      'looper.loops': 'the real loops',
      'looper.demo.looper.loops': 'demo loops',
    })

    prefixedStorage(beneath, 'looper.demo.').removeItem('looper.loops')

    expect(beneath.getItem('looper.demo.looper.loops')).toBeNull()
    expect(beneath.getItem('looper.loops')).toBe('the real loops')
  })
})
