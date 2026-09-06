import type { SavedLoop } from '../loops/loop'
import type { Loop } from './playback'
import { isCurrent, nextLoopName, summarise } from './savedLoops'

const SAVE_BUTTON =
  'rounded-lg bg-control px-4 py-2.5 text-sm font-semibold text-ink/90 transition hover:bg-control-hi active:scale-95 disabled:pointer-events-none disabled:opacity-40'

/* The last of the five regions US-01-05 reserved, and where a clip's four seconds
   stop being framed and start being kept (UC-01 steps 17–22).

   `loop` is null on a clip that has not decoded, and its absence is what gates the
   interior — the same shape `ShortcutHint` uses, and for the same reason: the
   region is drawn whether or not there is anything to put in it, because the five
   are hidden and given back rather than built and torn down (BR-08). The heading
   therefore stands alone on a clip that will not play, where there is no loop to
   keep and a Save button would be the dead control US-01-07 refused to draw.

   Told the name rather than keeping one, as `SpeedStepper` is told the rate. The
   `s` shortcut is bound at the window and has to save under whatever the field is
   showing, which it cannot read from in here — the mockup reaches back through a
   ref, and a single owner costs less than a second copy.

   Named `…Panel` rather than after the thing it lists, because `SavedLoops.tsx`
   and `savedLoops.ts` are the same path on a case-insensitive filesystem: the
   import resolved to the pure module and React was handed an undefined component
   with no hint as to why. */
export function SavedLoopsPanel({
  loop,
  speed,
  halfSet,
  saved,
  name,
  writing,
  notice,
  onNameChange,
  onSave,
  onRecall,
  onRemove,
}: {
  readonly loop: Loop | null
  readonly speed: number
  readonly halfSet: boolean
  readonly saved: readonly SavedLoop[]
  readonly name: string
  /* Whether a change is on its way to Drive. US-01-15 writes first and lists
     second, so there is a moment — about two hundred milliseconds — when the
     dancer has pressed Save and the list has not moved. Saying so is what
     stops it being pressed a second time, which would save the same section
     again under the next offered name. */
  readonly writing: boolean
  /* What went wrong with the last write, or null. It sits here rather than
     with the screen's other notices because this is where the dancer is
     looking when it happens, and because a loop that was not saved is the
     worst thing this app can fail to say. */
  readonly notice: string | null
  readonly onNameChange: (name: string) => void
  readonly onSave: () => void
  readonly onRecall: (entry: SavedLoop) => void
  readonly onRemove: (id: string) => void
}) {
  return (
    <section aria-label="Saved loops" className="mt-6 rounded-xl bg-shell/60 p-4">
      <h2 className="text-xs font-bold tracking-widest text-ink/50">
        SAVED LOOPS
      </h2>

      {loop && (
        <>
          <div className="mt-2 flex gap-2">
            {/* BR-10: naming is optional, so the field says what the loop would
                be called if nothing is typed. A placeholder rather than a
                pre-filled value, because a value would have to be cleared
                before a name could be typed over it. */}
            {/* Enter finishes the name, because BR-05 will not let `s` do it:
                with the caret here, `s` is a letter the dancer is typing. Handled
                on the field rather than at the window, so it is the ordinary
                behaviour of a focused text box and no new gate is added to the
                global handler — and it calls the same `onSave`, so BR-04's guard
                stays single across all three routes.

                Guarded on `repeat` for the reason space is: a held key repeats
                at the operating system's rate, and each repeat would save
                another copy under the next offered name. */}
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.repeat) return

                onSave()
              }}
              placeholder={nextLoopName(saved)}
              aria-label="Loop name"
              className="min-w-0 flex-1 rounded-lg bg-ink/10 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink/40"
            />
            {/* Held while a write is in flight as well as while the loop is
                half-set (BR-04). Both are the same claim — there is nothing
                to save right now — and routing them through one `disabled`
                keeps the button and the `s` key agreeing, which is what BR-04
                means by the guard being single. */}
            <button
              type="button"
              onClick={onSave}
              disabled={halfSet || writing}
              className={SAVE_BUTTON}
            >
              Save
            </button>
          </div>

          {/* A preview of the entry a Save would add, in the same words it will
              read in once it is there — so what was framed is confirmed before
              it joins the list rather than after.

              Half-set, there is nothing to preview: B is still parked at the end
              of the clip, so the honest line is the one naming what is missing
              rather than a pair of times nobody chose (BR-04). */}
          <p className="mt-1.5 text-xs tabular-nums text-ink/40">
            {halfSet ? (
              <span className="tracking-wide">set B to finish the loop</span>
            ) : (
              `saves ${summarise({ ...loop, speed })}`
            )}
          </p>

          {/* An alert rather than a quiet line, because it is the one thing on
              this screen the dancer must not miss: the loop they think they
              kept is not kept. It sits above the list so it reads against the
              gap where the entry would have been. */}
          {notice !== null && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-ink/10 px-3 py-2 text-xs text-ink/80"
            >
              {notice}
            </p>
          )}

          <ul className="mt-3 flex flex-col gap-1.5">
            {saved.map((entry) => (
              <li
                key={entry.id}
                className={`flex items-center gap-1 rounded-lg pr-1 ${
                  isCurrent({ entry, loop, speed })
                    ? 'bg-accent/25 ring-1 ring-accent/60'
                    : 'bg-control/50'
                }`}
              >
                {/* `aria-current` as well as the ring, so "you are here" is a
                    fact anything reading the page can have rather than a colour
                    only a sighted dancer can see. */}
                <button
                  type="button"
                  aria-current={isCurrent({ entry, loop, speed })}
                  onClick={() => onRecall(entry)}
                  className="min-w-0 flex-1 px-3 py-2 text-left"
                >
                  {/* On one line, cut off rather than wrapped: a loop's name is
                      a label to recognise at a glance, and a long one that wrapped
                      would push the summary beneath it out of line with its
                      neighbours. */}
                  <span className="block truncate text-sm font-medium">
                    {entry.name}
                  </span>
                  <span className="block text-xs tabular-nums text-ink/50">
                    {summarise(entry)}
                  </span>
                </button>
                {/* Its own target beside the recall, not a corner of it. The
                    dancer is reaching for these with a thumb, and a removal
                    reached by mistake costs the loop it took a minute to frame
                    — there is no undo behind it. */}
                <button
                  type="button"
                  aria-label={`Remove ${entry.name}`}
                  onClick={() => onRemove(entry.id)}
                  className="rounded px-2 py-1 text-lg leading-none text-ink/40 transition hover:text-ink"
                >
                  &times;
                </button>
              </li>
            ))}
            {saved.length === 0 && (
              <li className="py-1 text-sm text-ink/40">
                Drag A and B, then save. Most clips have a few worth keeping.
              </li>
            )}
          </ul>
        </>
      )}
    </section>
  )
}
