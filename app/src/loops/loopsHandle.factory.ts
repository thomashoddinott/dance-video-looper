import { useCallback, useState } from 'react'

import type { LoopsChange } from './driveLoops'
import type { SavedLoop } from './loop'
import { withLoop, withoutLoop } from './loopsChange'
import type { LoopsFile } from './loopsFile'
import { NO_LOOPS } from './loopsFile'
import type { LoopsHandle } from './useLoops'

export const A_REFUSAL = 'Drive would not take it.'

/* `useLoops` with the Drive taken out — the same store, held in memory.

   A stateful fake rather than a bag of `vi.fn`s, because what the player's
   tests are about is the round trip: save a loop and it is in the list, remove
   it and it is gone, and the number it is offered next follows from both.
   Stubbing the store would turn every one of those into an assertion that a
   function was called, which is a different and much weaker claim.

   The two options are the two things a fake cannot be asked to do by accident:
   refuse a write, and take its time over one. */
export const useFakeLoops = ({
  seed = NO_LOOPS,
  refuses = false,
  held,
}: {
  readonly seed?: LoopsFile
  readonly refuses?: boolean
  /* Resolve it to let a write through, so a test can assert on what the panel
     looks like *during* the two hundred milliseconds. */
  readonly held?: Promise<void>
} = {}): LoopsHandle => {
  const [loops, setLoops] = useState(seed)
  const [writing, setWriting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const write = useCallback(
    async (change: LoopsChange) => {
      setNotice(null)
      setWriting(true)

      if (held) await held

      if (refuses) {
        setNotice(A_REFUSAL)
        setWriting(false)

        return false
      }

      setLoops(change)
      setWriting(false)

      return true
    },
    [held, refuses],
  )

  /* A real clock, as `useLoops` uses — the fake is standing in for Drive, not
     for time, and a frozen stamp would let a test pass that the real hook
     fails. */
  const save = useCallback(
    (clipId: string, loop: SavedLoop) => {
      const at = new Date().toISOString()

      return write((current) => withLoop(current, clipId, loop, at))
    },
    [write],
  )

  const remove = useCallback(
    (clipId: string, id: string) => {
      const at = new Date().toISOString()

      return write((current) => withoutLoop(current, clipId, id, at))
    },
    [write],
  )

  return { loops, writing, notice, save, remove }
}
