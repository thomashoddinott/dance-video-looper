/* BR-09: a saved loop is `{ name, A, B, speed }` — the speed is part of what was
   saved rather than a global preference, so recalling one restores the tempo it
   was learned at.

   The `id` is not part of that rule. It is here because the list needs a stable
   identity to remove one entry by, and because these are written to Drive, where
   the laptop's third loop and the phone's third loop are two different loops. A
   `crypto.randomUUID()` is minted at the one place a loop is saved.

   Here rather than in `player/savedLoops.ts`, where US-01-11 first wrote it,
   because a loop is no longer only the player's: it is what `loops.json` holds
   and what the Clips screen counts. Same move `clips/clip.ts` already makes for
   `Clip`, and for the same reason — the type outlived the one screen that
   introduced it. */
export type SavedLoop = {
  readonly id: string
  readonly name: string
  readonly a: number
  readonly b: number
  readonly speed: number
}
