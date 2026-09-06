import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'

import { DriveStatus } from '../drive/DriveStatus'
import type { Clip } from './clip'
import type { ClipProbe } from './clipProbe'
import { ClipTile } from './ClipTile'
import { clipIdFor, nameFromFilename } from './fileClip'
import type { Library } from './library'
import { uploadOf } from './library'
import type { OrderingId } from './ordering'
import { orderings } from './ordering'

const today = () => new Date().toISOString().slice(0, 10)

/* What the **Recent** chip orders by. */
const RECENT: OrderingId = 'added'

export function ClipsScreen({
  library,
  thumbnails = {},
  onAdd,
  onDelete,
  probe,
  notice: driveNotice = null,
}: {
  readonly library: Library
  /* A url per clip that has a still (#77). Absent entries are clips with
     none, which paint the placeholder they always did. */
  readonly thumbnails?: Readonly<Record<string, string>>
  readonly onAdd: (clip: Clip, file: File, seconds: number) => void
  /* Straight through to the library, which is where the Drive call and the
     failure sentence both live. The screen holds no state for it: the question
     belongs to the tile that asked it. */
  readonly onDelete: (clip: Clip) => void
  readonly probe: ClipProbe
  /* Something that went wrong after the tile was already in the grid — an
     upload that failed. The screen's own notices below are the ones it can see
     for itself: a duplicate, and a file that would not decode. */
  readonly notice?: string | null
}) {
  const { clips } = library
  const [chosen, setChosen] = useState<OrderingId>(orderings[0].id)
  const [ownNotice, setNotice] = useState<string | null>(null)

  const notice = ownNotice ?? driveNotice
  const chooser = useRef<HTMLInputElement>(null)
  /* A ref rather than state, deliberately: this has to be readable by a handler
     that is already running, and state would hand it the value from the render
     it was created in — which is the very staleness below is guarding against. */
  const beingRead = useRef(new Set<string>())

  const onFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    /* Picking the same file again leaves the input's value untouched, and a
       browser fires no change event for a value that did not change — so
       without this the refusal below is unreachable by the very case it is
       written for. */
    event.target.value = ''

    if (!file) return

    const id = clipIdFor(file)

    /* A file being read is already spoken for, even though it is not in the
       library yet. `clips` is whatever it was when this file was chosen, so
       without the second half two picks of one file both find it absent and both
       go in — leaving two tiles under one id, and a delete addresses a clip by
       that id, so the ✕ on either would take both. */
    if (clips.some((clip) => clip.id === id) || beingRead.current.has(id)) {
      setNotice(`${nameFromFilename(file.name)} is already in your library.`)

      return
    }

    beingRead.current.add(id)

    const read = await probe(file).finally(() => {
      beingRead.current.delete(id)
    })

    /* Named by its filename rather than by the name a clip would have carried,
       because there is no clip — this is the file the dancer picked, extension
       and all, which is what they will look for in the chooser again. */
    if (!read.ok) {
      setNotice(`${file.name} could not be read as a video.`)

      return
    }

    setNotice(null)
    /* The file and its length go with the clip: the upload needs the bytes, and
       the duration has to be written to Drive at upload time because Drive has
       no field of its own for one — probing it again on another device would
       mean downloading the clip to find out how long it is. */
    onAdd(
      {
        id,
        name: nameFromFilename(file.name),
        added: today(),
        seconds: read.seconds,
        loops: 0,
        src: read.src,
      },
      file,
      read.seconds,
    )

    /* Whatever the dancer was ordering by, the clip they just added is the one
       they are looking for — and under any other ordering it lands somewhere
       they would have to hunt for it. */
    setChosen(RECENT)
  }

  const ordering = orderings.find(({ id }) => id === chosen) ?? orderings[0]
  const ordered = [...clips].sort(ordering.compare)

  return (
    <div className="min-h-screen bg-shell text-ink">
      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Clips</h1>
          <button
            type="button"
            onClick={() => chooser.current?.click()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-2"
          >
            Add clip
          </button>
          {/* `accept` is a contract with the platform rather than decoration:
              it is what makes a phone offer the camera roll instead of every
              document on it. The input itself stays hidden — the styled button
              above is the control the dancer sees. */}
          <input
            ref={chooser}
            type="file"
            accept="video/*"
            onChange={(event) => {
              void onFileChosen(event)
            }}
            className="hidden"
          />
        </div>

        {/* `alert`, deliberately, and not a second `status`: the Drive footer
            already owns an unnamed `role="status"` on this screen, so a second
            one would be indistinguishable from it. An add that failed is an
            alert anyway. */}
        {notice && (
          <p role="alert" className="mt-2 text-xs text-ink/60">
            {notice}
          </p>
        )}

        {/* A library that could not be read is not a library with nothing in
            it, and an empty grid would say the second. */}
        {library.state === 'failed' && (
          <p role="alert" className="mt-2 text-xs text-ink/60">
            Your clips could not be loaded. Check your connection and reload.
          </p>
        )}

        {/* Named, because `DriveStatus` already owns an unnamed `status` on
            this screen and two of them would be indistinguishable — the same
            reason the add notice above is an `alert`. */}
        {library.state === 'loading' && (
          <p role="status" aria-label="Clips" className="mt-2 text-xs text-ink/40">
            Loading your clips…
          </p>
        )}

        <div
          role="toolbar"
          aria-label="Order clips"
          className="mt-3 flex flex-wrap gap-1.5"
        >
          {orderings.map((ordering) => (
            <button
              key={ordering.id}
              type="button"
              aria-pressed={ordering.id === chosen}
              onClick={() => setChosen(ordering.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                ordering.id === chosen
                  ? 'bg-control-hi text-ink'
                  : 'bg-control text-ink/60 hover:bg-control-hi'
              }`}
            >
              {ordering.label}
            </button>
          ))}
        </div>

        <ul
          role="list"
          aria-label="Clips"
          aria-busy={library.state === 'loading'}
          className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {ordered.map((clip) => (
            <ClipTile
              key={clip.id}
              clip={clip}
              thumbnail={thumbnails[clip.id]}
              uploading={uploadOf(library, clip.id)}
              onDelete={onDelete}
            />
          ))}
        </ul>

        <p className="mt-6 text-xs text-ink/40">
          Clips live in Google Drive. The app only sees files it uploaded itself,
          so every clip has to come in through Add clip.
        </p>

        <DriveStatus />
      </main>
    </div>
  )
}
