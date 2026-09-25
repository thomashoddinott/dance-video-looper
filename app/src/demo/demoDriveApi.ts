import type { DriveApi, StoredJson } from '../drive/driveApi'
import type { KeyValueStorage } from '../drive/tokenStore'
import type { ThumbnailCapture } from '../clips/thumbnail'

/* The one clip a visitor gets, bundled with the site rather than fetched from
   anyone's Drive. `seconds` is written down rather than probed: probing means
   downloading the clip to draw the gallery, and it changes only when the clip
   itself is swapped. */
export type DemoClip = {
  readonly id: string
  readonly name: string
  readonly added: string
  readonly seconds: number
  readonly url: string
}

type Deps = {
  readonly clip: DemoClip
  /* Where the loops live — the dancer's own `localStorage`, under a prefix of
     its own, so a visitor's loops survive a reload the way a normal site
     remembers you, and never reach the real library's keys. */
  readonly storage: KeyValueStorage
  readonly fetchBytes: (url: string) => Promise<Blob>
  readonly capture: ThumbnailCapture
  readonly toUrl: (bytes: Blob) => string
  readonly releaseUrl: (url: string) => void
}

/* Ids the rest of the app addresses the demo's two files by, exactly as it
   addresses Drive's. The folder is one value for every name asked, because
   nothing here nests. */
const FOLDER = 'demo-folder'
const CLIP_FILE = 'demo-clip-file'
const STILL_FILE = 'demo-still-file'

/* A version as well as the body, because the loops' write path re-checks it
   before every write to catch another device (`driveLoops`). There is no other
   device here, but answering the check honestly costs one integer and keeps the
   path identical to the one Drive takes. */
type Stored = { readonly version: string; readonly body: string }

const fileKey = (name: string) => `demo.file.${name}`

const refuse = (what: string) =>
  Promise.reject(new Error(`the demo ${what}`))

/* A `DriveApi` for a visitor with no Google account. The player, the loops and
   the gallery all run the code they run against Drive; only this answers
   differently. It holds one clip, keeps no clip a visitor adds, deletes
   nothing, and keeps `loops.json` in the browser. */
export const demoDriveApi = ({
  clip,
  storage,
  fetchBytes,
  capture,
  toUrl,
  releaseUrl,
}: Deps): DriveApi => {
  const read = (name: string): Stored | null => {
    const raw = storage.getItem(fileKey(name))

    return raw === null ? null : (JSON.parse(raw) as Stored)
  }

  const write = (name: string, body: string): StoredJson => {
    const version = String(Number(read(name)?.version ?? '0') + 1)

    storage.setItem(fileKey(name), JSON.stringify({ version, body }))

    return { id: name, version }
  }

  return {
    findOrCreateFolder: async () => FOLDER,

    listClips: async () => [
      {
        id: clip.id,
        name: clip.name,
        added: clip.added,
        seconds: clip.seconds,
        loops: 0,
        driveId: CLIP_FILE,
      },
    ],

    upload: () => refuse('keeps no clips'),
    uploadThumbnail: () => refuse('keeps no stills'),
    trash: () => refuse('deletes nothing'),

    listThumbnails: async () => ({ [clip.id]: STILL_FILE }),

    download: async (_token, fileId) => {
      if (fileId === CLIP_FILE) return fetchBytes(clip.url)

      if (fileId === STILL_FILE) {
        const still = await capture(await fetchBytes(clip.url))

        if (still === null) throw new Error('no frame in the demo clip')

        return still
      }

      throw new Error(`the demo has no file ${fileId}`)
    },

    toUrl,
    releaseUrl,

    /* The file's name is its id: there is only ever one of each. */
    findJson: async (_token, _folderId, name) => {
      const held = read(name)

      return held === null ? null : { id: name, version: held.version }
    },

    readJson: async (_token, fileId) => read(fileId)?.body ?? '',

    createJson: async (_token, { name }) => write(name, ''),

    writeJson: async (_token, fileId, body) => write(fileId, body),
  }
}
