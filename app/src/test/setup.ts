import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { aWindow } from './screenWidth'

/* Narrow unless a test says otherwise: the layout every test before #81 was
   written against. */
beforeEach(() => {
  aWindow({ wide: false })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
