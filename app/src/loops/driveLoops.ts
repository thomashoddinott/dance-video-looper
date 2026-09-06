import type { DriveApi, StoredJson } from '../drive/driveApi'
import type { LoopsFile, LoopsRead } from './loopsFile'
import { NO_LOOPS, readLoopsFile, serialiseLoops } from './loopsFile'

/* One file for every clip, in the same folder the clips are in. Singular on
   purpose: a file per clip would narrow what a concurrent write can damage, at
   the cost of a listing and a fetch per clip on every load — and the merge
   below makes the blast radius a non-issue anyway.

   Nothing persists its id. It is re-found by name every time, exactly as the
   clips folder is (`CLIPS_FOLDER`), which the spike confirmed works across
   sessions under `drive.file` (FINDINGS.md Q1). */
export const LOOPS_FILE = 'loops.json'

/* The file as Drive currently has it: which file it is, and what it holds. The
   two travel together because every write needs both — the id to patch, and the
   content to apply the change to. */
export type LoopsInDrive = {
  readonly file: StoredJson | null
  readonly read: LoopsRead
}

/* A file that is not there yet is not a failure and not something to create
   here either: `loops.json` appears on the first save, not on the first read.
   It reads as nothing saved yet, which is where every dancer starts. */
export const currentLoops = async (
  api: DriveApi,
  token: string,
  folderId: string,
): Promise<LoopsInDrive> => {
  const file = await api.findJson(token, folderId, LOOPS_FILE)

  if (file === null) return { file, read: { readable: true, loops: NO_LOOPS } }

  return { file, read: readLoopsFile(await api.readJson(token, file.id)) }
}

export const readLoops = async (
  api: DriveApi,
  token: string,
  folderId: string,
): Promise<LoopsRead> => (await currentLoops(api, token, folderId)).read

/* Two reasons a write stops short of Drive, and the dancer needs a different
   sentence for each — the same argument `driveErrors` makes about telling a
   401 from a 5xx. Neither is a `DriveError`: nothing was refused, this app
   declined to send. */
export type LoopsRefusal =
  /* `loops.json` is there and this app cannot make sense of it. Writing would
     replace something it never understood, which is the one failure mode in
     this story that destroys the asset rather than failing to add to it. */
  | 'unreadable'
  /* The file changed twice while we were reading it. Once is a race worth
     retrying; twice is not a race any more. */
  | 'moved'

export class LoopsRefused extends Error {
  readonly because: LoopsRefusal

  constructor(because: LoopsRefusal) {
    super(`loops.json was not written: ${because}`)
    this.name = 'LoopsRefused'
    this.because = because
  }
}

export type LoopsChange = (loops: LoopsFile) => LoopsFile

/* Once. A second drift is not a race to keep trying to win. */
const RETRIES = 1

/* UC-01 Q-05, settled at US-01-15's approval gate: the loops are merged rather
   than last-write-wins, and the merge is this — read what Drive holds *now*,
   apply the one change to it, write it back. Because a change is only ever
   "append this loop" or "drop this id" (`loopsChange.ts`), replaying it onto
   current content is a complete merge: no tombstones, and nothing the other
   device deleted comes back.

   That closes the window Q-05 is actually about, which is hours long — the
   laptop at home and the phone at the studio. What is left is one round trip,
   between reading the file and patching it, and the `version` the spike watched
   increment is what catches a write landing inside it.

   **It narrows that window rather than closing it**, and the honest reason is
   that closing it needs a server-side conditional write. Drive offers none for
   media uploads, and a static page with no backend (BR-14) cannot add one. So
   the guard is a re-check immediately before the patch, and the residual race
   is one RTT wide. */
const attempt = async (
  api: DriveApi,
  token: string,
  folderId: string,
  change: LoopsChange,
  retries: number,
): Promise<LoopsFile> => {
  const { file, read } = await currentLoops(api, token, folderId)

  if (!read.readable) throw new LoopsRefused('unreadable')

  const next = change(read.loops)

  /* The first save of all. Metadata then content, which is `createJson`'s
     note — and the reason a zero-byte `loops.json` has to read as empty. */
  if (file === null) {
    const created = await api.createJson(token, {
      folderId,
      name: LOOPS_FILE,
    })

    await api.writeJson(token, created.id, serialiseLoops(next))

    return next
  }

  const stillThere = await api.findJson(token, folderId, LOOPS_FILE)

  /* Gone counts as moved: the retry will find no file and take the create path
     above, which is the right answer for a dancer who deleted `loops.json` out
     of their own Drive. */
  if (stillThere === null || stillThere.version !== file.version) {
    if (retries <= 0) throw new LoopsRefused('moved')

    return attempt(api, token, folderId, change, retries - 1)
  }

  await api.writeJson(token, file.id, serialiseLoops(next))

  return next
}

export const applyToLoops = (
  api: DriveApi,
  token: string,
  folderId: string,
  change: LoopsChange,
): Promise<LoopsFile> => attempt(api, token, folderId, change, RETRIES)
