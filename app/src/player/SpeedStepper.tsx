import { SPEED_STEP, SPEED_STEP_BIG, stepped } from './speed'

/* Two sizes of decrease and two of increase, named by how far they move rather
   than by the sign they carry. The row shows &minus;&minus; and &minus;, which a
   screen reader would announce identically — and "minus, minus" twice over is
   two controls the dancer cannot choose between. The glyph stays visual; the
   name says what it does.

   Ordered outward from the middle, so the control further from the rate is the
   one that moves it further. */
const SLOWER = [
  { label: 'Much slower', by: -SPEED_STEP_BIG, glyph: '−−' },
  { label: 'Slower', by: -SPEED_STEP, glyph: '−' },
] as const

const FASTER = [
  { label: 'Faster', by: SPEED_STEP, glyph: '+' },
  { label: 'Much faster', by: SPEED_STEP_BIG, glyph: '++' },
] as const

const STEP_BUTTON =
  'rounded-lg bg-control px-3 py-2.5 text-sm font-semibold text-ink/90 transition hover:bg-control-hi active:scale-95'

/* Told the rate rather than keeping one. The player owns it because the video
   element is what the rate is ultimately applied to, and a second copy here
   would be free to disagree with the clip actually playing. */
export function SpeedStepper({
  speed,
  onChange,
}: {
  readonly speed: number
  readonly onChange: (rate: number) => void
}) {
  const step = ({
    label,
    by,
    glyph,
  }: {
    readonly label: string
    readonly by: number
    readonly glyph: string
  }) => (
    <button
      key={label}
      type="button"
      aria-label={label}
      onClick={() => onChange(stepped({ from: speed, by }))}
      className={STEP_BUTTON}
    >
      {glyph}
    </button>
  )

  return (
    <div className="flex items-stretch gap-1.5">
      {SLOWER.map(step)}
      {/* `tabular-nums` so the digits do not shift width as the rate changes —
          stepping through 1, 0.95, 0.9 would otherwise jog the whole row
          sideways under the dancer's thumb. Rendered as the number itself:
          `speed.ts` rounds every rate it produces, so there is nothing left to
          format and no second copy of that rule here. */}
      <output
        aria-label="Playback speed"
        className="min-w-14 rounded-lg bg-panel px-3 py-2.5 text-center text-sm font-semibold tabular-nums text-ink"
      >
        {speed}
      </output>
      {FASTER.map(step)}
    </div>
  )
}
