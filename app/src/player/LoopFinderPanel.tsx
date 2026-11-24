import type { ReactNode } from 'react'

const STEP =
  'rounded-md bg-control px-2.5 py-1 text-sm font-semibold text-ink/90 transition hover:bg-control-hi active:scale-95'

const ACT =
  'rounded-lg bg-finder px-3 py-2 text-sm font-semibold text-white shadow active:scale-95 disabled:pointer-events-none disabled:opacity-40'

/* #121. What the finder is doing: finding the 8 count, with enter. */
export type Counting = {
  readonly kind: 'counting'
  /* How many 8 counts the tempo is averaged over */
  readonly over: number
  /* The 8 count as found so far, or how far through the presses it is */
  readonly reading: string
  readonly canConfirm: boolean
  readonly onOver: (over: number) => void
  readonly onConfirm: () => void
}

/* The 8 count found, cut into bars on the slider. */
export type Cutting = {
  readonly kind: 'cutting'
  /* The 8 count, as length and tempo */
  readonly reading: string
  /* How far each loop reaches past its bars, as a percentage of a bar */
  readonly wiggle: number
  /* The counts that reaches either side, as a dancer counts them */
  readonly reached: { readonly before: string; readonly after: string }
  readonly onWiggle: (wiggle: number) => void
  readonly onFindAgain: () => void
}

/* A − and + either side of a number, as the speed stepper has */
function Stepper({
  less,
  more,
  onLess,
  onMore,
  children,
}: {
  readonly less: string
  readonly more: string
  readonly onLess: () => void
  readonly onMore: () => void
  readonly children: ReactNode
}) {
  return (
    <>
      <button type="button" aria-label={less} onClick={onLess} className={STEP}>
        &minus;
      </button>
      {children}
      <button type="button" aria-label={more} onClick={onMore} className={STEP}>
        +
      </button>
    </>
  )
}

/* #121. The Loop Finder's panel, in its own colour, where Saved loops sits
   while the finder is closed. */
export function LoopFinderPanel({
  column,
  stage,
}: {
  readonly column: boolean
  readonly stage: Counting | Cutting
}) {
  return (
    <div
      role="group"
      aria-label="Loop Finder"
      className={`rounded-2xl bg-panel p-4 ring-2 ring-finder/60 ${column ? '' : 'mt-6'}`}
    >
      <h2 className="text-xs font-bold tracking-widest text-finder">LOOP FINDER</h2>

      {stage.kind === 'counting' ? <Counted stage={stage} /> : <Cut stage={stage} />}
    </div>
  )
}

function Counted({ stage }: { readonly stage: Counting }) {
  return (
    <>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="font-semibold">Find the 8 count</span>
        <span className="ml-auto text-ink/60">over</span>
        <Stepper
          less="Fewer 8 counts"
          more="More 8 counts"
          onLess={() => stage.onOver(Math.max(1, stage.over - 1))}
          onMore={() => stage.onOver(stage.over + 1)}
        >
          <output
            role="status"
            aria-label="8 counts to average"
            className="w-5 text-center font-semibold tabular-nums"
          >
            {stage.over}
          </output>
        </Stepper>
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className="tabular-nums text-ink/60">{stage.reading}</span>
        <button
          type="button"
          onClick={stage.onConfirm}
          disabled={!stage.canConfirm}
          className={`ml-auto ${ACT}`}
        >
          Confirm
        </button>
      </div>
    </>
  )
}

function Cut({ stage }: { readonly stage: Cutting }) {
  return (
    <>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <span className="font-semibold">8 count</span>
        <span className="tabular-nums text-ink/60">{stage.reading}</span>
        <button
          type="button"
          onClick={stage.onFindAgain}
          className="ml-auto text-xs font-medium text-finder hover:underline"
        >
          Find again
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="font-semibold">Wiggle</span>
        <Stepper
          less="Less wiggle"
          more="More wiggle"
          onLess={() => stage.onWiggle(Math.max(0, stage.wiggle - 5))}
          onMore={() => stage.onWiggle(stage.wiggle + 5)}
        >
          <input
            type="number"
            min={0}
            step={5}
            value={stage.wiggle}
            aria-label="Wiggle"
            onChange={(event) =>
              stage.onWiggle(Math.max(0, Number(event.target.value) || 0))
            }
            className="w-14 rounded-md bg-ink/10 px-2 py-1 text-right tabular-nums outline-none"
          />
        </Stepper>
        <span className="text-ink/60">%</span>
        <span className="ml-auto text-xs tabular-nums text-ink/60">
          in {stage.reached.before} · out {stage.reached.after}
        </span>
      </div>
    </>
  )
}
