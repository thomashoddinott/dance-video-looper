import { vi } from 'vitest'

import type {
  DriveHost,
  DriveResponse,
  FetchLike,
  PutBytes,
} from './driveApi'
import { driveApiOver } from './driveApi'

export const A_TOKEN = 'ya29.a0ARrdaM-token'
export const A_FOLDER = 'folder-1'
export const A_MINTED_URL = 'blob:shuffle-drill'

/* Complete by construction, like `getClip` — a factory that returns half a host
   makes every caller repair it, and the halves differ per test in ways that are
   about the test rather than about Drive. */
const answers = (body: unknown, status: number): DriveResponse => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => null },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(JSON.stringify(body)),
  blob: () => Promise.resolve(new Blob()),
  /* Not streamable unless a test says so. Most calls here are small JSON
     answers nobody watches arrive, and the one that is worth watching says as
     much with `arrivingIn`. */
  body: null,
})

export const answering = (body: unknown, status = 200) => answers(body, status)

export const answeringWith = (
  overrides: Partial<DriveResponse>,
  body: unknown = {},
  status = 200,
): DriveResponse => ({ ...answers(body, status), ...overrides })

/* Most calls send no bytes at all, and saying so out loud beats a silent stub
   that would let a test pass while uploading something nobody asked it to. */
export const neverSends: PutBytes = () => {
  throw new Error('this call sends no bytes')
}

export const aDriveHost = (overrides: Partial<DriveHost> = {}): DriveHost => ({
  fetch: vi.fn<FetchLike>().mockResolvedValue(answering({})),
  putBytes: neverSends,
  toUrl: () => A_MINTED_URL,
  releaseUrl: () => {},
  ...overrides,
})

/* An api plus the seams it was built over, since a test almost always wants to
   assert against one of them afterwards. */
export const anApiOver = (overrides: Partial<DriveHost> = {}) => {
  const host = aDriveHost(overrides)

  return { api: driveApiOver(host), host }
}

/* A response that arrives in pieces, the way a real nine-megabyte download
   does. jsdom's `Response` has no `body` at all, so a test that wants to watch
   a download progress has to hand the pieces over itself.

   `served` is control flow rather than test data: a reader is a stateful thing
   by definition, and it is what makes "the second chunk arrives after the
   first" expressible at all. */
export const arrivingIn = (
  chunks: readonly Uint8Array<ArrayBuffer>[],
  { totalIsReadable = true } = {},
): DriveResponse => {
  let served = 0

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)

  return answeringWith({
    headers: {
      get: (name) =>
        name === 'content-length' && totalIsReadable ? String(total) : null,
    },
    body: {
      getReader: () => ({
        read: () => {
          const chunk = chunks[served]

          served += 1

          return Promise.resolve(
            chunk === undefined
              ? { done: true, value: undefined }
              : { done: false, value: chunk },
          )
        },
      }),
    },
  })
}

export const fetchAnswering = (...answers: readonly DriveResponse[]) =>
  answers.reduce(
    (fetched, answer) => fetched.mockResolvedValueOnce(answer),
    vi.fn<FetchLike>(),
  )

export const urlOf = (fetched: FetchLike, index = 0) =>
  decodeURIComponent(String(vi.mocked(fetched).mock.calls[index]?.[0]))

export const initOf = (fetched: FetchLike, index = 0) =>
  vi.mocked(fetched).mock.calls[index]?.[1]
