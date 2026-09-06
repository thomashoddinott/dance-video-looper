import { vi } from 'vitest'

import type { DriveApi } from './driveApi'
import { A_FOLDER } from './driveHost.factory'

/* One `DriveApi` every test that does not care about Drive can stand up, with
   the case's own behaviour passed in as overrides.

   It exists because four files had hand-rolled the same six-method literal, so
   adding a method to `DriveApi` — which US-01-15 does four times over — meant
   repairing every one of them before a single new test could run. Complete by
   construction for `getClip`'s reason, and `vi.fn` throughout because a mock a
   test never asserts on costs nothing, while a plain function it turns out to
   need one from costs an edit. */
export const A_LOOPS_FILE = 'drive-loops-1'

export const aDriveApi = (overrides: Partial<DriveApi> = {}): DriveApi => ({
  findOrCreateFolder: vi.fn(async () => A_FOLDER),
  listClips: vi.fn(async () => []),
  upload: vi.fn(async () => ({ id: 'drive-new', name: 'Shuffle drill.mp4' })),
  /* A Drive holding no stills yet, which is where every clip uploaded before
     #77 starts — and so is the honest default. */
  listThumbnails: vi.fn(async () => ({})),
  uploadThumbnail: vi.fn(async () => ({
    id: 'drive-still-new',
    name: 'still.jpg',
  })),
  trash: vi.fn(async () => {}),
  download: vi.fn(async () => new Blob([new Uint8Array(9)])),
  toUrl: vi.fn(() => 'blob:downloaded'),
  releaseUrl: vi.fn(),
  /* A Drive with no loops file yet, which is where every dancer starts and so
     is the honest default. The three below are consistent with that: the create
     hop makes version 1, and the write that follows it makes 2. */
  findJson: vi.fn(async () => null),
  readJson: vi.fn(async () => ''),
  createJson: vi.fn(async () => ({ id: A_LOOPS_FILE, version: '1' })),
  writeJson: vi.fn(async () => ({ id: A_LOOPS_FILE, version: '2' })),
  ...overrides,
})
