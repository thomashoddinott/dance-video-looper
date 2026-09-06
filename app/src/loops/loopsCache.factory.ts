import { vi } from 'vitest'

import type { LoopsCache } from './loopsCache'

/* A device that has not been told anything yet, which is the honest default:
   a test about what Drive answers should not be quietly seeded by a local
   copy. Cases that are about the copy pass one in. */
export const aLoopsCache = (overrides: Partial<LoopsCache> = {}): LoopsCache => ({
  read: vi.fn(() => null),
  write: vi.fn(),
  ...overrides,
})
