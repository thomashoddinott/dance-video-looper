import type { Clip } from '../clips/clip'
import type { DriveFile, DriveFileMetadata } from './driveClips'
import { clipFromDriveFile, driveFileFor, isClipFile } from './driveClips'
import { thumbnailFileFor, thumbnailsFromDriveFiles } from './driveThumbnails'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

/* What the dancer sees in their own Drive, so it reads as a product rather than
   as a spike (which called it `looptube-ig-poc`). Nothing persists the folder's
   id — it is re-found through `files.list` every session, which the spike
   confirmed works across sessions under `drive.file` (FINDINGS.md Q1) — so
   renaming this later costs a re-find, not a migration. */
export const CLIPS_FOLDER = 'Dance Video Looper'

/* The slice of `fetch` this app uses, named rather than taking the DOM types.
   Same reason `tokenStore` names its three `localStorage` methods and
   `clipProbe` names its `ProbeHost`: a narrower contract is easier to honour in
   a test than a `Response`, and it says exactly which HTTP behaviours the
   product depends on — which is the question the spike existed to answer. */
/* The slice of a streamed response body this app reads, named for exactly the
   reason `FetchLike` is: jsdom's `Response` carries no `body` at all, so
   depending on the DOM's `ReadableStream` would mean a download nothing could
   test. Reading in pieces is what makes the seven-second wait countable. */
export type ByteStream = {
  readonly getReader: () => {
    readonly read: () => Promise<{
      readonly done: boolean
      /* Backed by a plain `ArrayBuffer`, which is what a response reader
         actually yields — the looser `ArrayBufferLike` admits `SharedArrayBuffer`
         and a Blob cannot be built from one of those. */
      readonly value?: Uint8Array<ArrayBuffer> | undefined
    }>
  }
}

export type DriveResponse = {
  readonly ok: boolean
  readonly status: number
  readonly headers: { readonly get: (name: string) => string | null }
  readonly json: () => Promise<unknown>
  readonly text: () => Promise<string>
  readonly blob: () => Promise<Blob>
  /* Null where the response cannot be read in pieces. Not every environment
     exposes one, and the bytes still have to arrive when it does not. */
  readonly body: ByteStream | null
}

export type Progress = (loaded: number, total: number) => void

export type DriveRequest = {
  readonly method?: string
  readonly headers?: Record<string, string>
  readonly body?: string
}

export type FetchLike = (
  url: string,
  init?: DriveRequest,
) => Promise<DriveResponse>

/* Sending the bytes is its own seam because it cannot be `fetch`: `fetch` still
   has no upload progress event, and "roughly how far along" (criterion 2) is
   unanswerable without one. The browser implementation is XHR — which is not
   nostalgia, it is the only API in the platform that reports upload progress.
   Behind a seam, jsdom never has to have one. */
export type BytesRequest = {
  readonly url: string
  readonly contentType: string
  readonly body: Blob
  readonly onProgress: (loaded: number, total: number) => void
}

export type BytesResult =
  | { readonly ok: true; readonly body: string }
  | { readonly ok: false; readonly status: number; readonly body: string }

export type PutBytes = (request: BytesRequest) => Promise<BytesResult>

export type DriveHost = {
  readonly fetch: FetchLike
  readonly putBytes: PutBytes
  /* `URL.createObjectURL` is absent from jsdom entirely, which is the same
     reason `ProbeHost` names it rather than reaching for it. */
  readonly toUrl: (bytes: Blob) => string
  readonly releaseUrl: (url: string) => void
}

/* The status is the whole point of carrying an error type: a 401 means consent
   was withdrawn and a 5xx means Google had a bad minute, and the dancer needs a
   different sentence for each (see `driveErrors`). */
export class DriveError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DriveError'
    this.status = status
  }
}

/* Drive's query language single-quotes its values, so an apostrophe in a name
   does not break the query — it alters it, silently. Carried from the spike. */
const quoted = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/* Whatever Drive said about why, or nothing if it would not say. Reaching for
   the body is best-effort on purpose: a refusal that cannot be parsed is still
   a refusal, and throwing while building the error message would replace a
   useful status with a parse failure. */
const reasonFrom = async (response: DriveResponse) => {
  try {
    const body: unknown = await response.json()

    if (typeof body === 'object' && body !== null && 'error' in body) {
      const { error } = body as { error?: { message?: string } }

      if (typeof error?.message === 'string') return error.message
    }
  } catch {
    /* not JSON; fall through */
  }

  return `Drive refused with ${response.status}`
}

const driveFetch = async (
  host: DriveHost,
  token: string,
  url: string,
  init: DriveRequest = {},
) => {
  const response = await host.fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  })

  if (!response.ok) {
    throw new DriveError(await reasonFrom(response), response.status)
  }

  return response
}

const driveJson = async (
  host: DriveHost,
  token: string,
  url: string,
  init?: DriveRequest,
) => (await driveFetch(host, token, url, init)).json()

const driveText = async (
  host: DriveHost,
  token: string,
  url: string,
  init?: DriveRequest,
) => (await driveFetch(host, token, url, init)).text()

const query = (parts: string) => encodeURIComponent(parts)

/* Scoped to a parent, or across the whole of Drive when there is none. The
   difference is deliberate and runs both ways: the clips folder is found by
   name *anywhere*, so the dancer can move it wherever they like, while a folder
   that belongs inside another — the stills of #77 — is found only in there,
   because a second folder of the same name elsewhere is theirs to make. */
const within = (parentId: string | undefined) =>
  parentId === undefined ? '' : ` and '${quoted(parentId)}' in parents`

const findFolder = async (
  host: DriveHost,
  token: string,
  name: string,
  parentId?: string,
) => {
  const url =
    `${API}/files?q=${query(`mimeType='${FOLDER_MIME}' and name='${quoted(name)}' and trashed=false${within(parentId)}`)}` +
    `&fields=${query('files(id)')}&spaces=drive&pageSize=10`

  const found = (await driveJson(host, token, url)) as {
    files?: readonly { id: string }[]
  }

  return found.files?.[0]?.id
}

const createFolder = async (
  host: DriveHost,
  token: string,
  name: string,
  parentId?: string,
) => {
  const made = (await driveJson(
    host,
    token,
    `${API}/files?fields=${query('id')}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        /* Omitted rather than null for a folder with no parent: Drive reads a
           missing `parents` as "the root", and sending one it cannot resolve is
           a refusal rather than a default. */
        ...(parentId === undefined ? {} : { parents: [parentId] }),
      }),
    },
  )) as { id: string }

  return made.id
}

/* `appProperties` is the one field here the app writes itself, and the only
   place a duration exists — Drive has no field of its own for one. Omitting it
   makes Drive drop it from the answer silently, and every tile on a device that
   never held the local file loses its length.

   `mimeType` is the same trap with a bigger blast radius: it decides whether a
   file is listed as a clip at all (`isClipFile`), so dropping it would put
   `loops.json` back in the grid. */
const CLIP_FILE_FIELDS =
  'id,name,mimeType,createdTime,appProperties,md5Checksum'
const CLIP_FIELDS = `files(${CLIP_FILE_FIELDS})`

const listClipFiles = async (
  host: DriveHost,
  token: string,
  folderId: string,
) => {
  const url =
    `${API}/files?q=${query(`'${quoted(folderId)}' in parents and trashed=false`)}` +
    `&fields=${query(CLIP_FIELDS)}` +
    `&orderBy=${query('createdTime desc')}&pageSize=100&spaces=drive`

  const listed = (await driveJson(host, token, url)) as {
    files?: readonly DriveFile[]
  }

  return listed.files ?? []
}

const OCTET_STREAM = 'application/octet-stream'

/* Hop one of two. Drive is told the size and type before a byte is sent, so it
   can refuse an upload up front rather than after nine megabytes.

   It takes the metadata rather than building it, so the clips and #77's stills
   go up the same proven path. Two round trips for a thirty-kilobyte still is
   nothing against an add already measured at ~13 s, and a second upload
   mechanism is exactly what the note below declined to keep. */
const openSession = async (
  host: DriveHost,
  token: string,
  bytes: Blob,
  metadata: DriveFileMetadata,
  fields: string,
) => {
  const started = await driveFetch(
    host,
    token,
    `${UPLOAD}/files?uploadType=resumable&fields=${query(fields)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': bytes.type || OCTET_STREAM,
        'X-Upload-Content-Length': String(bytes.size),
      },
      body: JSON.stringify(metadata),
    },
  )

  const sessionUri = started.headers.get('location')

  /* The spike's one genuine unknown — whether JS can read this header at all —
     and it settled that it can (FINDINGS.md Q8-1). There is deliberately **no
     multipart fallback** behind this: the fallback existed only while the
     answer was unknown, and a silent second path is worse than a loud failure
     if Google ever changes its mind. */
  if (sessionUri === null) {
    throw new DriveError(
      'Drive opened an upload session but would not let us read where it is',
      started.status,
    )
  }

  return sessionUri
}

const read = (body: string) => {
  try {
    return JSON.parse(body) as DriveFile
  } catch {
    throw new DriveError(
      'Drive accepted the upload but answered with something unreadable',
      200,
    )
  }
}

/* A body that reads but names no file is the same failure as one that does not
   read at all — nothing downstream can address the bytes — so it fails the same
   way, and for the reason the missing session URI does: a clip that quietly
   carried no Drive id would sit in the library looking stored. */
const storedFrom = (body: string): DriveFile => {
  const file = read(body)

  if (typeof file?.id !== 'string' || file.id === '') {
    throw new DriveError(
      'Drive accepted the upload but named no file for it',
      200,
    )
  }

  return file
}

/* Recursive rather than a loop with a growing array, so nothing here mutates.
   A nine-megabyte clip arrives in on the order of a hundred pieces, which is
   nowhere near deep enough for the shape to cost anything — and each hop is
   behind an `await`, so it is a chain of promises rather than a stack. */
const drained = async (
  reader: ReturnType<ByteStream['getReader']>,
  report: (received: number) => void,
  taken: readonly Uint8Array<ArrayBuffer>[] = [],
  received = 0,
): Promise<readonly Uint8Array<ArrayBuffer>[]> => {
  const { done, value } = await reader.read()

  if (done || value === undefined) return taken

  report(received + value.length)

  return drained(reader, report, [...taken, value], received + value.length)
}

/* Read in pieces when somebody is watching, in one go when nobody is. Carried
   across from the spike's `downloadBlob`, fallback included: a response with no
   readable body still yields its bytes, it just arrives all at once.

   The total comes off `Content-Length`, which — unlike `Content-Range` — Drive
   does expose cross-origin (FINDINGS.md Q8-2). Where it is missing the total is
   zero, which is honestly "unknown" rather than a fraction nobody can compute:
   the bytes still arrive and the caller decides what to say about them. */
const bytesOf = async (served: DriveResponse, onProgress?: Progress) => {
  const stream = served.body

  if (stream === null || onProgress === undefined) return served.blob()

  const total = Number(served.headers.get('content-length')) || 0

  return new Blob([
    ...(await drained(stream.getReader(), (received) => {
      onProgress(received, total)
    })),
  ])
}

/* Hop two, and the tail both uploads share: send the bytes, refuse anything
   Drive would not take, and read back the file it says it stored. */
const sendThrough = async (
  host: DriveHost,
  token: string,
  {
    bytes,
    metadata,
    fields,
    /* Nobody watches a thirty-kilobyte still arrive. `BytesRequest` wants a
       reporter either way, and one that says nothing is honest here. */
    onProgress = () => {},
  }: {
    readonly bytes: Blob
    readonly metadata: DriveFileMetadata
    readonly fields: string
    readonly onProgress?: Progress
  },
) => {
  const sessionUri = await openSession(host, token, bytes, metadata, fields)

  const sent = await host.putBytes({
    url: sessionUri,
    contentType: bytes.type || OCTET_STREAM,
    body: bytes,
    onProgress,
  })

  if (!sent.ok) {
    throw new DriveError(
      `Drive refused the upload: ${sent.body.slice(0, 200)}`,
      sent.status,
    )
  }

  return storedFrom(sent.body)
}

const THUMBNAIL_FILE_FIELDS = 'id,name,appProperties'

/* A larger page than the clips take, because stills outnumber them: nothing
   deletes the old one when a clip is uploaded again, so a folder can hold more
   stills than the library has clips. */
const listThumbnailFiles = async (
  host: DriveHost,
  token: string,
  folderId: string,
) => {
  const url =
    `${API}/files?q=${query(`'${quoted(folderId)}' in parents and trashed=false`)}` +
    `&fields=${query(`files(${THUMBNAIL_FILE_FIELDS})`)}` +
    `&orderBy=${query('createdTime desc')}&pageSize=1000&spaces=drive`

  const listed = (await driveJson(host, token, url)) as {
    files?: readonly DriveFile[]
  }

  return listed.files ?? []
}

export type ThumbnailUploadRequest = {
  readonly bytes: Blob
  readonly clipId: string
  readonly folderId: string
}

export type UploadRequest = {
  /* The bytes to store, which since US-01-17 need not be the file the dancer
     picked — a compressed re-encode goes up in its place when it is smaller. */
  readonly file: File
  /* The picked file's id, carried rather than derived. See `driveFileFor`. */
  readonly clipId: string
  readonly seconds: number
  readonly folderId: string
  readonly onProgress: (loaded: number, total: number) => void
}

/* ------------------------------------------------------- the app's own JSON

   `loops.json` (US-01-15) is the only file besides the clips themselves that
   this app keeps, and it is the one the dancer cannot re-download from
   anywhere. All four calls below were proved against real Drive by the spike
   before any of this was written (FINDINGS.md Q7). */

/* Drive's `version` increments on every write — the spike watched it go
   2 → 3 → 4 — which is what makes catching a concurrent write cheap. It is an
   int64, and Drive hands int64s over as strings. */
export type StoredJson = {
  readonly id: string
  readonly version: string
}

export type CreateJsonRequest = {
  readonly folderId: string
  readonly name: string
}

const JSON_FILE_FIELDS = 'id,version'

const findJsonFile = async (
  host: DriveHost,
  token: string,
  folderId: string,
  name: string,
) => {
  const url =
    `${API}/files?q=${query(`'${quoted(folderId)}' in parents and name='${quoted(name)}' and trashed=false`)}` +
    `&fields=${query(`files(${JSON_FILE_FIELDS})`)}&spaces=drive&pageSize=10`

  const found = (await driveJson(host, token, url)) as {
    files?: readonly StoredJson[]
  }

  return found.files?.[0] ?? null
}

export type DriveApi = {
  readonly findOrCreateFolder: (
    token: string,
    name?: string,
    parentId?: string,
  ) => Promise<string>
  readonly listClips: (
    token: string,
    folderId: string,
  ) => Promise<readonly Clip[]>
  readonly upload: (
    token: string,
    request: UploadRequest,
  ) => Promise<DriveFile>
  readonly uploadThumbnail: (
    token: string,
    request: ThumbnailUploadRequest,
  ) => Promise<DriveFile>
  /* Which Drive file holds each clip's still, keyed by clip id — the question
     the grid asks, rather than a list it would have to fold itself. */
  readonly listThumbnails: (
    token: string,
    folderId: string,
  ) => Promise<Readonly<Record<string, string>>>
  /* Trashed rather than erased, which is the whole of the decision — see the
     implementation. Answers nothing, because there is no id to hand back that
     the caller was not already holding. */
  readonly trash: (token: string, driveId: string) => Promise<void>
  readonly download: (
    token: string,
    driveId: string,
    onProgress?: Progress,
  ) => Promise<Blob>
  /* Minting and releasing are one pair, and both belong to whoever holds the
     url — the same reason `ProbeHost` pairs its two. `download` hands back
     bytes rather than a url of its own precisely so that stays true when the
     bytes came from the cache instead of from Drive (US-01-16): one place
     mints, one place releases, and neither cares which way they arrived. */
  readonly toUrl: (bytes: Blob) => string
  readonly releaseUrl: (url: string) => void
  /* Null for a folder that has no such file yet, which is a first save rather
     than a failure — it is what makes "created on the first save" reachable. */
  readonly findJson: (
    token: string,
    folderId: string,
    name: string,
  ) => Promise<StoredJson | null>
  /* Text, deliberately, rather than parsed JSON. The caller has to tell an
     empty file from a corrupt one — the first is a create whose content hop
     never landed, the second must never be overwritten — and `response.json()`
     collapses both into the same throw. */
  readonly readJson: (token: string, fileId: string) => Promise<string>
  readonly createJson: (
    token: string,
    request: CreateJsonRequest,
  ) => Promise<StoredJson>
  readonly writeJson: (
    token: string,
    fileId: string,
    body: string,
  ) => Promise<StoredJson>
}

export const driveApiOver = (host: DriveHost): DriveApi => ({
  findOrCreateFolder: async (token, name = CLIPS_FOLDER, parentId) =>
    (await findFolder(host, token, name, parentId)) ??
    createFolder(host, token, name, parentId),

  /* Filtered here rather than in the query, and that is deliberate. Narrowing
     `q` to `mimeType contains 'video/'` would drop an octet-stream clip before
     `isClipFile`'s second arm could rescue it, and would leave the same rule
     living in two places to drift apart. One rule, one home. */
  listClips: async (token, folderId) =>
    (await listClipFiles(host, token, folderId))
      .filter(isClipFile)
      .map(clipFromDriveFile),

  upload: async (token, request) =>
    sendThrough(host, token, {
      bytes: request.file,
      metadata: driveFileFor(
        request.file,
        request.clipId,
        request.seconds,
        request.folderId,
      ),
      fields: CLIP_FILE_FIELDS,
      onProgress: request.onProgress,
    }),

  uploadThumbnail: async (token, { bytes, clipId, folderId }) =>
    sendThrough(host, token, {
      bytes,
      metadata: thumbnailFileFor(clipId, folderId),
      fields: THUMBNAIL_FILE_FIELDS,
    }),

  listThumbnails: async (token, folderId) =>
    thumbnailsFromDriveFiles(await listThumbnailFiles(host, token, folderId)),

  /* The first thing this app ever takes back out of Drive (UC-01 Q-08), and
     the whole of that decision is the verb. Trashed, never erased: `listClips`
     above asks only for `trashed=false`, so this is already enough to take the
     clip out of the grid, and it leaves Drive's own bin as the undo behind a
     control that sits one mis-tap from a clip nobody can get back. `DELETE
     /files/{id}` would be permanent and there is nothing behind it.

     The plain `/files/{id}` endpoint, deliberately, and not the `/upload/` one
     `writeJson` patches: that one replaces a file's bytes, this one edits its
     metadata and leaves them exactly where they are. The two are one path
     segment apart and confusing them fails silently in both directions. */
  trash: async (token, driveId) => {
    await driveFetch(host, token, `${API}/files/${driveId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trashed: true }),
    })
  },

  /* Whole-file, not ranged. The spike measured ~7 s for 9 MB and settled that
     the resulting blob url plays, seeks and changes rate exactly as a local
     file does (FINDINGS.md Q3) — which is what criterion 10 rests on. Every
     open re-downloads until US-01-16 caches it, and that is this story's stated
     cost rather than a defect in it. */
  download: async (token, driveId, onProgress) => {
    const served = await driveFetch(
      host,
      token,
      `${API}/files/${driveId}?alt=media`,
    )

    return bytesOf(served, onProgress)
  },

  toUrl: (bytes) => host.toUrl(bytes),

  releaseUrl: (url) => {
    host.releaseUrl(url)
  },

  findJson: (token, folderId, name) =>
    findJsonFile(host, token, folderId, name),

  readJson: (token, fileId) =>
    driveText(host, token, `${API}/files/${fileId}?alt=media`),

  /* Metadata now, content on the write that follows. One multipart request
     would do both, and the spike's `createJson` does exactly that — but its
     body is a `Blob`, and `DriveRequest` takes a string precisely so a test can
     read what was sent. Widening the seam to carry a multipart Blob for a call
     that happens once in the app's life is the wrong trade; the cost of not
     doing it is a zero-byte `loops.json` if the second hop fails, which
     `readLoopsFile` already reads as "nothing saved yet". */
  createJson: async (token, { folderId, name }) =>
    (await driveJson(
      host,
      token,
      `${API}/files?fields=${query(JSON_FILE_FIELDS)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          parents: [folderId],
          mimeType: 'application/json',
        }),
      },
    )) as StoredJson,

  /* The spike's question 7, and the second acceptance criterion with it. PATCH
     against the **upload** endpoint replaces the bytes and keeps the same file
     id, verified across two successive updates to leave exactly one
     `loops.json` in the folder rather than a copy per save. Patching the plain
     `/files/{id}` endpoint instead would edit the metadata and leave the
     content untouched, which is the quiet way to get this wrong. */
  writeJson: async (token, fileId, body) =>
    (await driveJson(
      host,
      token,
      `${UPLOAD}/files/${fileId}?uploadType=media&fields=${query(JSON_FILE_FIELDS)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      },
    )) as StoredJson,
})

/* XHR rather than `fetch`, and not for old times' sake: `fetch` still has no
   upload progress event, so it is the only API in the platform that can answer
   "roughly how far along" (criterion 2). Carried from the spike for the same
   reason.

   A dropped connection resolves as a failure rather than rejecting, so the one
   place upload failure is handled handles both — and status 0 is what the
   platform reports for it. Note this does NOT resume: the whole file goes in
   one PUT and no session URI is kept, which the spec records as a known gap
   rather than a promise (UC-01 *c makes bad signal the expected case). */
const putBytesOverXhr: PutBytes = ({ url, contentType, body, onProgress }) =>
  new Promise((resolve) => {
    const request = new XMLHttpRequest()

    request.open('PUT', url, true)
    request.setRequestHeader('Content-Type', contentType)

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    }

    request.onload = () => {
      resolve(
        request.status >= 200 && request.status < 300
          ? { ok: true, body: request.responseText }
          : {
              ok: false,
              status: request.status,
              body: request.responseText,
            },
      )
    }

    request.onerror = () => {
      resolve({ ok: false, status: 0, body: 'the connection dropped' })
    }

    request.send(body)
  })

/* Where the browser's own implementations live, injected from `App` exactly as
   `browserClipProbe` and `browserTokenSource` are. Nothing below `App` reads a
   global. */
export const browserDriveApi = driveApiOver({
  fetch: (url, init) => fetch(url, init),
  putBytes: putBytesOverXhr,
  toUrl: (bytes) => URL.createObjectURL(bytes),
  releaseUrl: (url) => {
    URL.revokeObjectURL(url)
  },
})
