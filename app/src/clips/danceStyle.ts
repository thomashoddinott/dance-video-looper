import type { Clip } from './clip'

/* #43. What a clip is danced to. Two styles and no third: a clip that is
   neither is a clip with no style, drawn only while no style is picked, rather
   than an "Other" bucket to keep up. */
export const DANCE_STYLES = [
  { id: 'salsa', label: 'Salsa' },
  { id: 'bachata', label: 'Bachata' },
] as const

export type DanceStyle = (typeof DANCE_STYLES)[number]['id']

const isDanceStyle = (value: string): value is DanceStyle =>
  DANCE_STYLES.some(({ id }) => id === value)

/* The clips of one style, in the order they came in — `matching`'s rule, for
   its reason: the ordering chips sort whatever is left. No style picked is no
   filter at all, which is what brings the whole library back. */
export const ofStyle = (
  clips: readonly Clip[],
  style: DanceStyle | undefined,
): readonly Clip[] =>
  style === undefined ? clips : clips.filter((clip) => clip.style === style)

/* What Drive stored, read as a style or as none. Only the styles above count:
   anything else would be a clip that wears a label no chip can pick. */
export const styleFrom = (stored: string | undefined): DanceStyle | undefined =>
  stored !== undefined && isDanceStyle(stored) ? stored : undefined
