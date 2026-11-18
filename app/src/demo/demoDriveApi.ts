import type { DanceStyle } from '../clips/danceStyle'
import { youTubeIdFor } from '../clips/youtube'
import type { DriveApi, StoredJson } from '../drive/driveApi'
import type { KeyValueStorage } from '../drive/tokenStore'

/* #58. A YouTube video in the showcase (#77). Nothing of it is bundled:
   YouTube's own player plays it. `seconds` is written down because YouTube
   gives no length until the video has played. The style is as the library
   had it, which may be none. */
export type DemoYouTube = {
  readonly videoId: string
  readonly name: string
  readonly added: string
  readonly seconds: number
  readonly style?: DanceStyle | undefined
}

type Deps = {
  readonly youtube: readonly DemoYouTube[]
  /* #63. Files the site ships, by name, that the demo starts from — the loops
     a visitor opens onto. Read until the visitor writes a copy of their own,
     never written. */
  readonly bundled: Readonly<Record<string, string>>
  /* Where a visitor's loops live while they stay in the demo — memory that
     goes when they leave (#66), so the next visit opens on `bundled` again. */
  readonly storage: KeyValueStorage
  readonly toUrl: (bytes: Blob) => string
  readonly releaseUrl: (url: string) => void
}

/* The folder is one value for every name asked, because nothing here
   nests. */
const FOLDER = 'demo-folder'

/* A version as well as the body, because the loops' write path re-checks it
   before every write to catch another device (`driveLoops`). There is no other
   device here, but answering the check honestly costs one integer and keeps the
   path identical to the one Drive takes. */
type Stored = { readonly version: string; readonly body: string }

/* A video's stand-in for the Drive file a real `.youtube` entry stands as.
   Nothing is ever downloaded by it; the player only needs one to be there. */
const youTubeFile = (videoId: string) => `demo-youtube-file-${videoId}`

const fileKey = (name: string) => `demo.file.${name}`

const refuse = (what: string) =>
  Promise.reject(new Error(`the demo ${what}`))

/* A `DriveApi` for a visitor with no Google account — the showcase's (#77).
   The player, the loops and the grid all run the code they run against Drive;
   only this answers differently. It holds YouTube videos, keeps nothing a
   visitor adds, deletes nothing, and keeps `loops.json` in `storage`. */
export const demoDriveApi = ({
  youtube,
  bundled,
  storage,
  toUrl,
  releaseUrl,
}: Deps): DriveApi => {
  /* The visitor's copy if they have one, else what the site ships, at
     version 0 — so their first write is version 1 and takes over from it. */
  const read = (name: string): Stored | null => {
    const raw = storage.getItem(fileKey(name))

    if (raw !== null) return JSON.parse(raw) as Stored

    const shipped = bundled[name]

    return shipped === undefined ? null : { version: '0', body: shipped }
  }

  const write = (name: string, body: string): StoredJson => {
    const version = String(Number(read(name)?.version ?? '0') + 1)

    storage.setItem(fileKey(name), JSON.stringify({ version, body }))

    return { id: name, version }
  }

  return {
    findOrCreateFolder: async () => FOLDER,

    listClips: async () =>
      youtube.map((video) => ({
        id: youTubeIdFor(video.videoId),
        name: video.name,
        added: video.added,
        seconds: video.seconds,
        style: video.style,
        source: 'youtube' as const,
        videoId: video.videoId,
        loops: 0,
        driveId: youTubeFile(video.videoId),
      })),

    upload: () => refuse('keeps no clips'),
    uploadThumbnail: () => refuse('keeps no stills'),
    trash: () => refuse('deletes nothing'),
    /* The grid offers the demo no style control (#43), so this is only the
       answer to a call nothing should make. */
    setStyle: () => refuse('keeps no styles'),
    /* #70. Nor a group, for the style's reason. */
    setGroup: () => refuse('keeps no groups'),
    /* Nor a rename (#54): the videos are the showcase's, not the visitor's. */
    rename: () => refuse('renames nothing'),
    /* #20. The demo keeps no library, YouTube's or otherwise. */
    addYouTube: () => refuse('keeps no YouTube videos'),

    /* YouTube publishes a picture of every video, and the tile shows that. */
    listThumbnails: async () => ({}),

    /* Nothing here has bytes: YouTube's player plays every video. */
    download: async (_token, fileId) => {
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
