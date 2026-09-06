import type { Clip } from '../clips/clip'
import { nameFromFilename } from '../clips/fileClip'

/* The fields the app asks Drive for, and nothing more. `appProperties` is the
   only one of these the app writes: Drive describes a file by name, size and
   timestamps, and has **no field for a video's length** — so a device that never
   held the local file has nowhere else to read a duration from. */
export type DriveFile = {
  readonly id: string
  readonly name: string
  /* Drive's own, and the only thing in a listing that says what a file *is* —
     everything else about `loops.json` reads exactly like a clip. Optional
     because a field left out of the request is simply absent from the answer,
     which is a trap this listing has already been caught by twice. */
  readonly mimeType?: string | undefined
  readonly createdTime?: string | undefined
  readonly appProperties?: Record<string, string> | undefined
  /* Drive's own, computed over the bytes it holds. The one field here the app
     neither writes nor derives — which is what makes it trustworthy as the
     answer to "is what I cached still what is up there?" */
  readonly md5Checksum?: string | undefined
}

/* Both halves of what the app stores about a clip beyond the bytes. Written at
   upload time (`driveFileFor`), read back with the listing. */
export const CLIP_ID = 'clipId'
export const SECONDS = 'seconds'

const VIDEO = 'video/'

/* #79. The folder is not clips-only and never was: `loops.json` sits in it by
   design (US-01-15), and #77 will put a `Thumbnails` folder there too. The
   listing asks Drive for the folder's contents, so everything in it arrives —
   and a clip has to be told from the rest here, because by the time
   `clipFromDriveFile` has run they all look alike.

   Two arms, and the second is not belt-and-braces. `openSession` declares
   `file.type || 'application/octet-stream'`, and a clip that fails to compress
   goes up as the file the dancer picked (`clipCompressor`) — so a clip whose
   `File.type` was empty is in Drive under a mime that says nothing about it.
   Reading only the mime would hide that clip on every device at once, silently
   and for good, which is a worse bug than the tile this fixes. What the app
   uploaded, it uploaded with a `clipId` (`driveFileFor`), and that is the arm
   that catches it.

   Neither arm catches `loops.json`, a subfolder, or anything else that lands in
   the folder later: this keys on what a clip is, not on one filename. */
export const isClipFile = (file: DriveFile): boolean =>
  file.mimeType?.startsWith(VIDEO) === true ||
  file.appProperties?.[CLIP_ID] !== undefined

/* `added` is a calendar day everywhere else in the app — `formatAdded` reads it
   back in UTC precisely so it cannot slide a day — so the RFC 3339 stamp Drive
   returns is cut to the same shape rather than carried whole. */
const dayOf = (createdTime: string | undefined) =>
  (createdTime ?? '').slice(0, 10)

/* Unknown, not absent. A file that carries no length — an older upload, or one
   whose properties did not stick — has a length nobody knows, which is the
   distinction `Clip.seconds` is optional for. */
const secondsFrom = (stored: string | undefined) => {
  if (stored === undefined) return undefined

  const seconds = Number(stored)

  return Number.isFinite(seconds) ? seconds : undefined
}

export const clipFromDriveFile = (file: DriveFile): Clip => ({
  /* The id the file had when it was local, so US-01-04's duplicate refusal
     still recognises it after a reload or on another device. Drive's own id
     would be a different value for the same clip every time it was re-uploaded.

     Falling back to Drive's keeps the mapping total: a file with no clip id is
     still a clip the dancer can see in their Drive, and dropping it would make
     the library quietly disagree with the folder. */
  id: file.appProperties?.[CLIP_ID] ?? file.id,
  driveId: file.id,
  name: nameFromFilename(file.name),
  added: dayOf(file.createdTime),
  seconds: secondsFrom(file.appProperties?.[SECONDS]),
  checksum: file.md5Checksum,
  loops: 0,
})

/* What an upload sends alongside the bytes. The other half of the contract
   `clipFromDriveFile` reads, and the two are tested together — a key renamed on
   one side alone is exactly the failure a round-trip catches and neither test
   would on its own. */
export type DriveFileMetadata = {
  readonly name: string
  readonly parents: readonly string[]
  readonly appProperties: Record<string, string>
}

/* `clipId` is passed in rather than derived from `file`, and that is the whole
   guard against US-01-17's identity hazard. The two are no longer the same file:
   `file` is the bytes being stored, which may be a re-encode, while the id
   belongs to the one the dancer actually picked. Deriving it here would have
   read it off the compressed bytes, and the clip would come back from Drive
   under an id no tile ever had — which is also the id US-01-15 keys saved loops
   on. Now `clipIdFor` is called once, on the Clips screen, and the answer
   travels. */
export const driveFileFor = (
  file: File,
  clipId: string,
  seconds: number,
  folderId: string,
): DriveFileMetadata => ({
  /* Whole, extension included, and taken from the bytes rather than from the
     picked file: what sits in the dancer's own Drive folder is named for what it
     actually is, so a re-encoded .MOV reads as the .mp4 it now is. The name is
     stripped for display when it is read back either way. */
  name: file.name,
  parents: [folderId],
  appProperties: {
    [CLIP_ID]: clipId,
    [SECONDS]: String(seconds),
  },
})
