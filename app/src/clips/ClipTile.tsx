import { useState } from 'react'
import { Link } from 'react-router'

import type { Clip } from './clip'
import type { DanceStyle } from './danceStyle'
import { DANCE_STYLES } from './danceStyle'
import { formatAdded, formatDuration } from './format'
import { Poster } from './Poster'
import { STYLE_LOOK } from './styleLook'

/* The chooser's answers: each style in its own colour whether or not it is
   the current one, so the chooser previews the label it will leave, and then
   none. */
const STYLE_ANSWERS: readonly {
  readonly id: DanceStyle | undefined
  readonly label: string
  readonly look: string
}[] = [
  ...DANCE_STYLES.map(({ id, label }) => ({ id, label, look: STYLE_LOOK[id].fill })),
  { id: undefined, label: 'None', look: 'bg-control text-ink/70 hover:bg-control-hi' },
]

/* Visible on a phone and hidden until asked for on a laptop. The ticket asked
   for a hover reveal, and hover is exactly the interaction half this app's
   devices do not have — the phone is half of why any of this syncs through
   Drive. So the control is always in the document and always focusable, and it
   is only the *fading* that is conditional. */
const REVEAL =
  'opacity-100 transition sm:opacity-0 sm:group-hover/tile:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100'

export function ClipTile({
  clip,
  thumbnail,
  uploading,
  onDelete,
  onRestyle,
}: {
  readonly clip: Clip
  /* The still stored for this clip (#77), or absent for one that has none —
     every clip uploaded before that ticket, until its bytes are next in hand. */
  readonly thumbnail?: string | undefined
  /* How far along, 0 to 1, or absent for a clip that is not going anywhere —
     which is every clip listed from Drive, and every clip whose upload has
     finished. */
  readonly uploading?: number | undefined
  /* Absent for a clip that cannot be deleted from here — the demo's (#33),
     which the visitor does not own and the demo's api would refuse. */
  readonly onDelete?: ((clip: Clip) => void) | undefined
  /* #43. Undefined takes the style off. Absent where it cannot be changed —
     the demo's clip again, which has no Drive file to carry one. */
  readonly onRestyle?:
    | ((clip: Clip, style: DanceStyle | undefined) => void)
    | undefined
}) {
  /* The question lives on the tile that asked it, because that is all it is:
     one tile's ephemeral state, meaningless anywhere else and gone the moment
     it is answered. Lifting it to the screen would buy only the guarantee that
     no two tiles ask at once, which costs nothing to allow. */
  const [asking, setAsking] = useState(false)
  /* The second question a tile can ask (#43). It covers the same thumbnail the
     delete question does, so opening either closes the other. */
  const [choosing, setChoosing] = useState(false)
  const style = DANCE_STYLES.find(({ id }) => id === clip.style)

  return (
    <li className="group/tile relative">
      {/* Relative, so the grid opens a clip under wherever it is mounted —
          `/demo` as well as `/` (#33). */}
      <Link to={`clip/${clip.id}`} className="group block w-full text-left">
        <div className="relative overflow-hidden rounded-xl bg-black transition group-hover:opacity-90">
          <Poster clip={clip} thumbnail={thumbnail} />
          {clip.seconds !== undefined && (
            <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {formatDuration(clip.seconds)}
            </span>
          )}
          {/* On the tile rather than in a banner: after an add the ordering has
              just switched to Recent and this clip is first, so the tile is
              already where the eye is (US-01-03, US-01-04). A banner would have
              to name the clip that the tile is showing.

              It stays up at 100%: all the bytes are gone but Drive has not
              answered, and the clip can still fail and be retracted. What
              clears it is being stored, not the last progress report. */}
          {uploading !== undefined && (
            <div
              role="progressbar"
              aria-label={`Uploading ${clip.name}`}
              aria-valuenow={Math.round(uploading * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="absolute inset-x-0 bottom-0 h-1 bg-white/25"
            >
              <div
                className="h-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.round(uploading * 100)}%` }}
              />
            </div>
          )}
        </div>
        <p className="mt-1.5 truncate text-sm font-medium">
          {clip.name}
          {clip.loops > 0 && (
            <span className="font-normal text-ink/50"> ({clip.loops})</span>
          )}
        </p>
        <p className="text-xs text-ink/50">{formatAdded(clip.added)}</p>
      </Link>

      {/* A sibling of the link, never a child of it: a button inside an anchor
          is invalid markup, and the router would swallow the click besides. The
          named group is on the `li` for the same reason — the `group` on the
          link is already spoken for by the poster's own hover.

          Absent while the bytes are still going up. There is no Drive file to
          trash yet, cancelling an upload is a feature that does not exist, and
          `abandoned` already covers the only way that clip can leave. */}
      {uploading === undefined && onDelete !== undefined && (
        <button
          type="button"
          aria-label={`Delete ${clip.name}`}
          aria-expanded={asking}
          onClick={() => {
            setChoosing(false)
            setAsking((open) => !open)
          }}
          className={`absolute top-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-lg leading-none text-white/70 hover:text-white ${REVEAL}`}
        >
          &times;
        </button>
      )}

      {/* #43. The style, in the corner opposite the ✕ and in the style's own
          colour, so with no style picked the grid still says which clip is
          which at a glance. It is also the way to change it, and unlike the ✕
          it never fades: the phone has no hover and is where most clips arrive
          with no style yet. A sibling of the link, for the ✕'s reason.

          Absent while the bytes are still going up, because there is no Drive
          file yet for the style to be stored on. */}
      {uploading === undefined && onRestyle !== undefined && (
        <button
          type="button"
          aria-label={`Style of ${clip.name}: ${style?.label ?? 'none'}`}
          aria-expanded={choosing}
          onClick={() => {
            setAsking(false)
            setChoosing((open) => !open)
          }}
          className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            style ? STYLE_LOOK[style.id].fill : 'bg-black/40 text-white/70 hover:text-white'
          }`}
        >
          {style?.label ?? '+ Style'}
        </button>
      )}

      {/* The current answer is ringed rather than recoloured, since every
          answer already wears its own colour. */}
      {choosing && (
        <div
          role="group"
          aria-label={`Choose a style for ${clip.name}`}
          className="absolute inset-x-0 top-0 flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-xl bg-shell/95 px-2 text-center"
        >
          <p className="text-xs font-semibold">Style</p>
          {STYLE_ANSWERS.map(({ id, label, look }) => (
            <button
              key={label}
              type="button"
              aria-pressed={clip.style === id}
              onClick={() => {
                setChoosing(false)
                onRestyle?.(clip, id)
              }}
              className={`w-full max-w-24 rounded-lg px-3 py-1.5 text-xs font-semibold ${look} ${
                clip.style === id ? 'ring-2 ring-ink ring-offset-2 ring-offset-shell' : ''
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setChoosing(false)
            }}
            className="text-[11px] text-ink/50 underline underline-offset-2 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Kept mounted through the question rather than swapped out for it, so
          the focus a keyboard reached it with has somewhere to stay —
          `aria-expanded` is what says the question appeared. Swapping would
          drop focus to the document and leave that dancer nowhere. */}
      {asking && (
        <div
          role="group"
          aria-label={`Delete ${clip.name}?`}
          className="absolute inset-x-0 top-0 flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-xl bg-shell/95 px-2 text-center"
        >
          <p className="text-xs font-semibold">Delete?</p>
          <button
            type="button"
            onClick={() => {
              setAsking(false)
              onDelete?.(clip)
            }}
            className="w-full max-w-24 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-2"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              setAsking(false)
            }}
            className="w-full max-w-24 rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
          >
            Cancel
          </button>
          {/* Drive's bin, not oblivion — which is what makes an ✕ reached by
              mistake survivable, and is worth saying where the mistake would be
              made rather than only in the use case. */}
          <p className="text-[10px] leading-tight text-ink/50">
            Goes to your Drive bin. Saved loops are kept.
          </p>
        </div>
      )}
    </li>
  )
}
