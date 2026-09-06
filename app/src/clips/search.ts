import type { Clip } from './clip'

/* The clips whose name contains `query`, in the order they came in.

   Order in, order out, deliberately: the ordering chips (US-01-03) sort whatever
   this leaves, so search narrows the set and the chosen chip decides the order.
   Sorting here as well would give the two controls the same job.

   Trimmed, because a phone keyboard adds a trailing space readily and an untrimmed
   query turns a stray keystroke into "nothing matches". A query that is empty once
   trimmed is no search at all rather than a search for nothing, so it keeps
   everything — which is also what makes clearing the box restore the whole grid. */
export const matching = (clips: readonly Clip[], query: string): readonly Clip[] => {
  const wanted = query.trim().toLowerCase()

  if (wanted === '') return clips

  return clips.filter((clip) => clip.name.toLowerCase().includes(wanted))
}
