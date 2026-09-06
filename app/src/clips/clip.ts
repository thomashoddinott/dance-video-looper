export type Clip = {
  readonly id: string
  readonly name: string
  readonly added: string
  /* Explicitly optional rather than merely absent: a clip whose metadata never
     arrived has a length that is unknown, not one that was never asked for. */
  readonly seconds?: number | undefined
  readonly loops: number
  /* When a loop was last saved on this clip or removed from it (#12), which is
     what the **Last practised** chip orders by. Comes from `loops.json` beside
     the count above, and is undefined for the same two different reasons: the
     dancer has never worked on this clip, or the file has not arrived yet.

     Undefined rather than a fallback date, deliberately. "Never practised" is
     not "practised at the beginning of time" — the chip sorts it below every
     clip that has been, and any real date would let it tie with one. */
  readonly practised?: string | undefined
  readonly src?: string | undefined
  /* Drive's own id for the file holding this clip's bytes, which is what a
     download is addressed by. Absent until the upload finishes — and absent
     forever on a clip whose upload failed, since that clip leaves the library
     rather than staying as something half-stored. */
  readonly driveId?: string | undefined
  /* Drive's checksum of those bytes, which is how a cached copy is told from
     the copy in Drive without fetching either (US-01-16). Optional for two
     different reasons that must not be collapsed: Drive does not give one for
     every file, and a clip added in this session has never been listed. Both
     mean "nothing to compare", which is not the same as "changed". */
  readonly checksum?: string | undefined
}
