export type Clip = {
  readonly id: string
  readonly name: string
  readonly added: string
  /* Explicitly optional rather than merely absent: a clip whose metadata never
     arrived has a length that is unknown, not one that was never asked for. */
  readonly seconds?: number | undefined
  readonly loops: number
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
