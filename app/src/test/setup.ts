import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { aWindow } from './screenWidth'

/* Narrow unless a test says otherwise: the layout every test before #81 was
   written against. */
beforeEach(() => {
  aWindow({ wide: false })
})

/* A new browser session per test, so a layout one test turned on (#86) is not
   still on in the next. */
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  sessionStorage.clear()
})
