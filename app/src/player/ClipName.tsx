import { useState } from 'react'

import type { Clip } from '../clips/clip'
import { PencilIcon } from '../clips/PencilIcon'
import { useNameField } from '../clips/useNameField'

/* #54. The clip's name in the player's header, and the way to change it. In
   place rather than over the clip, because the clip is what the dancer came
   here to practise and the name is a line of text beside it.

   The pencil never fades, unlike the tile's: the header is not a grid of
   things to hover over, and on a phone there is no hover to fade in on. */
export function ClipName({
  clip,
  onRename,
}: {
  readonly clip: Clip
  /* Resolves to whether Drive took the name. Absent where the name cannot be
     changed — the demo, and a clip whose bytes are still going up. */
  readonly onRename?: ((clip: Clip, name: string) => Promise<boolean>) | undefined
}) {
  const [renaming, setRenaming] = useState(false)
  /* The grid's alert says which clip kept its name, but the grid is out of
     sight from here — so the player says so itself, under the name it kept. */
  const [refused, setRefused] = useState(false)

  if (renaming) {
    return (
      <RenameField
        name={clip.name}
        onSave={(name) => {
          setRenaming(false)
          setRefused(false)
          void onRename?.(clip, name).then((took) => setRefused(!took))
        }}
        onCancel={() => setRenaming(false)}
      />
    )
  }

  return (
    <>
      <span className="truncate text-sm font-semibold">{clip.name}</span>
      {onRename !== undefined && (
        <button
          type="button"
          aria-label={`Rename ${clip.name}`}
          onClick={() => setRenaming(true)}
          className="shrink-0 rounded-md p-1 text-ink/40 hover:text-ink"
        >
          <PencilIcon />
        </button>
      )}
      {/* A whole line of the header's own, so a refusal never squeezes the
          name it is about. */}
      {refused && (
        <p role="alert" className="order-last basis-full text-xs text-ink/60">
          The new name could not be saved to Drive, so the clip keeps its old one.
        </p>
      )}
    </>
  )
}

/* Its own component so the field is mounted only while the dancer is
   renaming, which is how long `useNameField` keeps what was typed. */
function RenameField({
  name,
  onSave,
  onCancel,
}: {
  readonly name: string
  readonly onSave: (name: string) => void
  readonly onCancel: () => void
}) {
  const { canSave, form, field } = useNameField({ name, onSave, onCancel })

  return (
    <form
      aria-label={`Rename ${name}`}
      {...form}
      className="flex min-w-0 flex-1 items-center gap-1.5"
    >
      <input
        aria-label="Clip name"
        {...field}
        className="min-w-0 flex-1 rounded-lg bg-ink/10 px-2 py-1 text-sm font-semibold text-ink outline-none"
      />
      <button
        type="submit"
        disabled={!canSave}
        className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent hover:bg-accent-2 disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-lg bg-control px-2.5 py-1 text-xs font-semibold text-ink/70 hover:bg-control-hi"
      >
        Cancel
      </button>
    </form>
  )
}
