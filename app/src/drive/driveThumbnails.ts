import { THUMBNAIL_TYPE } from '../clips/thumbnail'
import type { DriveFile, DriveFileMetadata } from './driveClips'
import { CLIP_ID } from './driveClips'

/* A subfolder of the clips folder rather than a second folder beside it, chosen
   with Thomas at #77's planning gate: everything the app owns stays under one
   roof, and it survives him rearranging the parent.

   The cost of that choice is that the clips listing can see it, since Drive is
   asked for everything in the folder. `listClipFiles` skips folders for exactly
   this reason — narrowly, because the general "only videos are clips" fix is
   #79's to make, not this ticket's to take. */
export const THUMBNAILS_FOLDER = 'Thumbnails'

/* `.jpg` because `THUMBNAIL_TYPE` is, and the two must not drift: the dancer
   opens this folder in their own Drive, and a still named `.jpg` that is a PNG
   is a file their own viewer may refuse. */
const EXTENSION = THUMBNAIL_TYPE.replace('image/', '')

/* Named for the clip so the folder reads as something rather than as a wall of
   identical stills — and carrying the clip id in `appProperties` as well,
   because Drive lets a file be renamed and an identity that lived only in the
   name would come back attached to nothing. Same contract the clips themselves
   use (`driveClips.ts`), same key. */
export const thumbnailFileFor = (
  clipId: string,
  folderId: string,
): DriveFileMetadata => ({
  name: `${clipId}.${EXTENSION}`,
  parents: [folderId],
  appProperties: { [CLIP_ID]: clipId },
})

/* Which Drive file holds the still for each clip, keyed the way every caller
   wants to ask the question. A file naming no clip is dropped rather than
   guessed at: the clips listing can fall back to Drive's own id because a file
   in that folder *is* a clip either way, but a stray image here belongs to
   nothing, and putting it on a tile would be worse than leaving the tile grey.

   Listings arrive newest first (`orderBy=createdTime desc`), so where a
   re-upload has left two stills for one clip the first one wins. */
export const thumbnailsFromDriveFiles = (
  files: readonly DriveFile[],
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...files].reverse().flatMap<[string, string]>((file) => {
      const clipId = file.appProperties?.[CLIP_ID]

      return clipId === undefined ? [] : [[clipId, file.id]]
    }),
  )
