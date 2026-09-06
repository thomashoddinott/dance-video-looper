import { useCallback, useEffect, useState } from 'react'

import type { DriveApi } from '../drive/driveApi'
import { withdrewConsent } from '../drive/driveErrors'
import { useDriveSession } from '../drive/driveSession'
import { applyToLoops, type LoopsChange, LoopsRefused, readLoops } from './driveLoops'
import type { SavedLoop } from './loop'
import { withLoop, withOpens, withoutLoop } from './loopsChange'
import type { LoopsCache } from './loopsCache'
import { browserLoopsCache } from './loopsCache'
import type { LoopsFile } from './loopsFile'
import { NO_LOOPS } from './loopsFile'

export type LoopsHandle = {
  readonly loops: LoopsFile
  /* Whether a save or a removal is in flight. The panel reads it to hold the
     Save button, which is what makes "write first, then show" visible rather
     than merely true — otherwise the two hundred milliseconds look like a
     button that did nothing. */
  readonly writing: boolean
  /* What to tell the dancer about the last write that did not land. Null while
     nothing has gone wrong, and cleared the moment the next one is attempted. */
  readonly notice: string | null
  /* Whether the write landed. The panel clears the name field on a save and
     must not do it on one that failed — a dancer who typed "the hard bit" and
     lost the write should not also lose what they called it. */
  readonly save: (clipId: string, loop: SavedLoop) => Promise<boolean>
  readonly remove: (clipId: string, id: string) => Promise<boolean>
}

/* Deliberately different sentences, because the dancer can act on the
   difference. "Could not be read" also carries the news that their existing
   loops are still there, in a file this app has refused to touch — reporting
   that as "could not be saved" would hide the more important half. */
const noticeFor = (error: unknown, what: string) => {
  if (error instanceof LoopsRefused && error.because === 'unreadable') {
    return `Your saved loops in Drive could not be read, so ${what} was not saved. Nothing was overwritten.`
  }

  if (error instanceof LoopsRefused && error.because === 'moved') {
    return `Your loops changed on another device while this was saving, so ${what} was not saved. Try again.`
  }

  return `${what} was not saved to Drive.`
}

/* The loops live here, above both screens, rather than inside the player. The
   Clips screen needs them too — it puts the count in each tile's parentheses
   and orders by it under **Most looped** — and a second copy read separately is
   a second copy free to disagree.

   Shaped after `LibraryHandle`, which is the same job for the clips. */
export const useLoops = (
  api: DriveApi,
  cache: LoopsCache = browserLoopsCache,
  /* What this device has opened, read at the moment of a write rather than
     captured (#16). These stamps ride the write a loop save or removal was
     already making — there is deliberately no write of their own, because
     `loops.json` holds the loops and an ordering is not worth putting it in
     the path of every open. A getter rather than a value so the write always
     carries what is true now, not what was true when this hook rendered. */
  opens: () => Readonly<Record<string, string>> = () => ({}),
): LoopsHandle => {
  const { status, requireToken, reportConsentWithdrawn } = useDriveSession()
  /* Seeded from the local copy rather than from nothing, which is BR-13's
     ordering argument applied to the loops instead of the bytes: the panel is
     populated on the first render, so a hall with no signal shows the loops
     this device already knows about rather than an empty list that Drive will
     never get round to filling. Drive overwrites it when it answers. */
  const [loops, setLoops] = useState<LoopsFile>(() => cache.read() ?? NO_LOOPS)
  const [writing, setWriting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  /* Every Drive call goes through here and none of them keeps the result — the
     session retires a token 30 seconds early on purpose, so a held copy is the
     one thing that reintroduces a mid-flight 401. Its own folder lookup rather
     than a share of `useLibrary`'s: one extra `files.list` per load, against
     coupling two hooks that otherwise know nothing about each other. */
  const folderToken = useCallback(async () => {
    const held = await requireToken()

    if (!held.available) return null

    return {
      token: held.value,
      folderId: await api.findOrCreateFolder(held.value),
    }
  }, [api, requireToken])

  const reportIfWithdrawn = useCallback(
    (error: unknown) => {
      if (withdrewConsent(error)) reportConsentWithdrawn()
    },
    [reportConsentWithdrawn],
  )

  useEffect(() => {
    let listening = true

    const read = async () => {
      try {
        const reached = await folderToken()

        /* No Drive to read from. The seeded copy stands, and there is
           deliberately no notice: UC-01 exception *c makes a hall with bad
           signal the expected case rather than an error, and a sentence on
           every offline open would be noise the dancer learns to ignore. Only
           a *write* that failed gets told. */
        if (reached === null) return

        const held = await readLoops(api, reached.token, reached.folderId)

        /* A file we could not read is not a reason to throw away the copy we
           have. Nothing is written until the dancer tries to save, and that is
           where they are told (`noticeFor`). */
        if (!held.readable || !listening) return

        setLoops(held.loops)
        cache.write(held.loops)
      } catch (error) {
        reportIfWithdrawn(error)
      }
    }

    void read()

    return () => {
      listening = false
    }
  }, [api, cache, folderToken, reportIfWithdrawn, status])

  /* One path for both changes, because they differ only in the function they
     hand to `applyToLoops` — and that function is what the whole merge rests
     on (UC-01 Q-05). Two copies of this would be two chances to get the
     order of "write, then show" wrong in one of them. */
  const write = useCallback(
    async (change: LoopsChange, what: string) => {
      setNotice(null)
      setWriting(true)

      try {
        const reached = await folderToken()

        if (reached === null) throw new Error('no Drive to write to')

        /* Nothing is put on screen until this resolves. The list means "what
           is in Drive" at every moment, which is the opposite of the clip
           upload's tile-first flow — and the difference is the wait being
           covered: thirteen seconds there, about two hundred milliseconds
           here. */
        /* Folded in *inside* the change, so it is replayed onto whatever Drive
           holds now exactly as the loop edit is — and so a retry carries them
           too. `withOpens` keeps the later stamp per clip, so a device that has
           been shut for a week cannot drag anything backwards. */
        const carrying = opens()

        const next = await applyToLoops(
          api,
          reached.token,
          reached.folderId,
          (held) => withOpens(change(held), carrying),
        )

        setLoops(next)
        cache.write(next)

        return true
      } catch (error) {
        reportIfWithdrawn(error)
        setNotice(noticeFor(error, what))

        return false
      } finally {
        setWriting(false)
      }
    },
    [api, cache, folderToken, opens, reportIfWithdrawn],
  )

  const save = useCallback(
    (clipId: string, loop: SavedLoop) =>
      write((held) => withLoop(held, clipId, loop), `“${loop.name}”`),
    [write],
  )

  /* Named "the removal" rather than by the loop, because the entry it refers
     to is still on screen when the sentence appears — the dancer can see which
     one it is, and a name repeated back adds nothing. */
  const remove = useCallback(
    (clipId: string, id: string) =>
      write((held) => withoutLoop(held, clipId, id), 'That removal'),
    [write],
  )

  return { loops, writing, notice, save, remove }
}
