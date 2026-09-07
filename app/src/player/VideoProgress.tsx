import { formatDuration } from '../clips/format'
import type { Loop } from './playback'
import { ratioOf, spanned } from './scrubSpan'

/* Where you are in the clip, drawn on the clip itself. The video carried no
   position indicator at all before this — no `controls`, nothing of our own — so
   it played blind.

   It rides inside the video wrapper rather than under the card, which is what
   makes it survive zen: the whole control strip is hidden there, so this is the
   only thing left saying where the clip has got to, and that is the case it
   matters most in.

   Deliberately not a second loop slider. The two answer different questions
   about the same timeline — that one is "which few seconds am I working on",
   this one is "where am I" — and neither can do the other's job. Nothing here
   touches A or B. */
export function VideoProgress({
  time,
  duration,
  loop,
  looping,
  rounded,
}: {
  readonly time: number
  readonly duration: number
  readonly loop: Loop
  readonly looping: boolean
  /* Follows the clip's own corners, so the scrim does not square off a rounded
     video. Zen has no rounding to follow. */
  readonly rounded?: string | undefined
}) {
  const span = spanned({ loop, looping, duration })
  const at = `${ratioOf(time, span) * 100}%`

  return (
    <div
      className={`absolute inset-x-0 bottom-0 select-none bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 ${rounded ?? ''}`}
    >
      {/* Where you actually are, absolute rather than relative to the span — it
          is the number you came for, and a rescaled bar must not change what the
          clock says. */}
      <div className="mb-1.5 flex items-baseline justify-end gap-2">
        <span className="text-[11px] tabular-nums text-white/80 drop-shadow">
          {formatDuration(time)} / {formatDuration(duration)}
        </span>
      </div>

      <div className="scrub-track py-3">
        <div className="relative h-0.5 w-full rounded-full bg-white/20">
          <div
            className="scrub-fill absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: at }}
          />
        </div>
      </div>
    </div>
  )
}
