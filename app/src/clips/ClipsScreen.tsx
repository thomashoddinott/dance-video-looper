import type { ChangeEvent } from 'react'
import { type FormEvent, useRef, useState } from 'react'

import { DemoInvite } from '../demo/DemoInvite'
import { DemoStatus } from '../demo/DemoStatus'
import { DriveStatus } from '../drive/DriveStatus'
import type { Clip } from './clip'
import type { ClipProbe } from './clipProbe'
import { ClipTile } from './ClipTile'
import type { DanceStyle, StyleFilter } from './danceStyle'
import { DANCE_STYLES, ofStyle, UNTAGGED } from './danceStyle'
import { clipIdFor, nameFromFilename } from './fileClip'
import type { Library } from './library'
import { uploadOf } from './library'
import type { OrderingId } from './ordering'
import { orderings } from './ordering'
import { matching } from './search'
import { SourceLink } from './SourceLink'
import { STYLE_LOOK } from './styleLook'
import type { YouTubeLookUp } from './youtube'
import { lookUpYouTube, videoIdFrom, youTubeIdFor } from './youtube'

const today = () => new Date().toISOString().slice(0, 10)

/* The chips at the right of the ordering row: one per style, lettered in its
   colour until picked and filled with it after (#43), then Untagged (#50).
   Untagged is grey rather than a style's colour, because it is the absence of
   one, and filled dark once picked so a hover cannot pass for it.

   Each carries its own sentence for an empty grid. "No Salsa clips yet" is a
   style with nothing in it; nothing untagged is the queue done, which is the
   good outcome and reads like one. */
const STYLE_CHIPS: readonly {
  readonly id: StyleFilter
  readonly label: string
  readonly picked: string
  readonly unpicked: string
  readonly noun: string
  readonly none: string
}[] = [
  ...DANCE_STYLES.map(({ id, label }) => ({
    id,
    label,
    picked: STYLE_LOOK[id].fill,
    unpicked: `bg-control hover:bg-control-hi ${STYLE_LOOK[id].text}`,
    noun: label,
    none: `No ${label} clips yet.`,
  })),
  {
    id: UNTAGGED,
    label: 'Untagged',
    picked: 'bg-ink text-panel',
    unpicked: 'bg-control text-ink/60 hover:bg-control-hi',
    noun: 'untagged',
    none: 'Every clip has a style.',
  },
]

/* What the **Recent** chip orders by. */
const RECENT: OrderingId = 'added'

/* #20. What to say when YouTube will not give a video up, by why. */
const REFUSALS = {
  'embedding-refused':
    'Its uploader does not let it play outside YouTube, so it cannot be looped here.',
  missing: 'That video is private, or does not exist.',
  unreachable: 'YouTube could not be reached. Try again with a connection.',
} as const

export function ClipsScreen({
  library,
  ordering: chosen,
  onOrderingChange: setChosen,
  styleFilter: picked,
  onStyleFilterChange: pick,
  thumbnails = {},
  onAdd,
  onDelete,
  onRestyle,
  onRename,
  onAddYouTube,
  lookUp = lookUpYouTube,
  probe,
  notice: driveNotice = null,
  demo = false,
}: {
  readonly library: Library
  /* Held by the caller rather than here, and that is load-bearing for #16
     rather than tidiness: this screen is unmounted while the player is up, so
     local state would start over at Recent every time the dancer came back —
     and **Last opened** is the chip whose whole point is what you see *after* a
     trip through the player. */
  readonly ordering: OrderingId
  readonly onOrderingChange: (id: OrderingId) => void
  /* #43. Which style the grid is narrowed to, or undefined for none — the
     whole library. Held by the caller for the ordering's reason: a dancer who
     narrowed to bachata and opened a clip is still practising bachata when
     they come back. */
  readonly styleFilter: StyleFilter | undefined
  readonly onStyleFilterChange: (filter: StyleFilter | undefined) => void
  /* A url per clip that has a still (#77). Absent entries are clips with
     none, which paint the placeholder they always did. */
  readonly thumbnails?: Readonly<Record<string, string>>
  readonly onAdd: (clip: Clip, file: File, seconds: number) => void
  /* Straight through to the library, which is where the Drive call and the
     failure sentence both live. The screen holds no state for it: the question
     belongs to the tile that asked it. */
  readonly onDelete: (clip: Clip) => void
  /* #43. Straight through to the library, like the delete above. */
  readonly onRestyle: (clip: Clip, style: DanceStyle | undefined) => void
  /* #54. Straight through to the library too. */
  readonly onRename: (clip: Clip, name: string) => void
  /* #20. A YouTube video by its id and title, once this screen has made sure
     it is new and that YouTube knows it. */
  readonly onAddYouTube: (videoId: string, title: string) => void
  /* Where a video's title comes from — YouTube's oEmbed in the browser, a
     stand-in under test. */
  readonly lookUp?: ((videoId: string) => Promise<YouTubeLookUp>) | undefined
  readonly probe: ClipProbe
  /* Something that went wrong after the tile was already in the grid — an
     upload that failed. The screen's own notices below are the ones it can see
     for itself: a duplicate, and a file that would not decode. */
  readonly notice?: string | null
  /* #33: the grid a visitor sees at `/demo`. One bundled clip and nothing to
     manage — the demo keeps no clip and deletes none, so Add clip and the ✕
     would be controls that could only fail — and no Drive to talk about. */
  readonly demo?: boolean
}) {
  const { clips } = library
  /* Local, unlike the ordering above it: a search is a question about the grid
     you are looking at, not a setting, and coming back from the player with the
     whole library showing is the honest default. Persisting it is explicitly not
     in US-01-18. */
  const [query, setQuery] = useState('')
  const [ownNotice, setNotice] = useState<string | null>(null)

  const notice = ownNotice ?? driveNotice
  const chooser = useRef<HTMLInputElement>(null)
  /* A ref rather than state, deliberately: this has to be readable by a handler
     that is already running, and state would hand it the value from the render
     it was created in — which is the very staleness below is guarding against. */
  const beingRead = useRef(new Set<string>())
  /* #20. Whether the link field is open, what is in it, and whether YouTube is
     being asked about it — which takes a moment, and a second press of Add in
     that moment would ask twice. */
  const [linking, setLinking] = useState(false)
  const [link, setLink] = useState('')
  const [lookingUp, setLookingUp] = useState(false)

  /* What a dancer adding anything is looking for next is the thing they added:
     Recent puts it first, and a search or a picked style could hide it. */
  const showTheNewest = () => {
    setChosen(RECENT)
    setQuery('')
    pick(undefined)
  }

  const onLinkSubmitted = async (event: FormEvent) => {
    event.preventDefault()

    const videoId = videoIdFrom(link)

    if (videoId === null) {
      setNotice('That is not a YouTube link.')
      return
    }

    const held = clips.find((clip) => clip.id === youTubeIdFor(videoId))

    if (held) {
      setNotice(`${held.name} is already in your library.`)
      return
    }

    setLookingUp(true)
    const found = await lookUp(videoId)
    setLookingUp(false)

    if (!found.found) {
      setNotice(REFUSALS[found.because])
      return
    }

    setNotice(null)
    setLink('')
    setLinking(false)
    onAddYouTube(videoId, found.title)
    showTheNewest()
  }

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
       they would have to hunt for it.

       The search goes for the same reason, and a sharper one: a search the new
       clip does not match hides it outright, so the dancer would have added a
       clip and been told there are none. So does a picked style (#43): a new
       clip has none yet, so any style picked would hide it. */
    showTheNewest()
  }

  const ordering = orderings.find(({ id }) => id === chosen) ?? orderings[0]
  /* Narrow, then order — never the other way about. The style and the search
     both narrow the set and the chosen chip decides the order of what is left,
     so the controls compose instead of competing for the same result. */
  const ordered = [...matching(ofStyle(clips, picked), query)].sort(ordering.compare)
  /* Trimmed, to agree with `matching` about what an empty box is: a query of
     nothing but spaces is no search at all, so it must not be able to produce a
     "nothing matches" line over a grid that is showing everything. */
  const searching = query.trim() !== ''
  const pickedChip = STYLE_CHIPS.find(({ id }) => id === picked)
  /* And only once there was a library for the search to have excluded something
     from. `loading` and `failed` both carry no clips for a reason of their own,
     and a `ready` library with none is the footer note's business — in all three
     the grid is empty whatever was typed, so blaming the search would be the
     same lie the bare empty grid was not allowed to tell, one state along. A
     picked style is the same case one control over (#43). */
  const excludedEverything =
    (searching || picked !== undefined) && clips.length > 0 && ordered.length === 0

  return (
    <div className="min-h-screen bg-shell text-ink">
      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Clips</h1>
          <div className="flex items-center gap-4">
            <SourceLink />
            {!demo && (
              <>
                <button
                  type="button"
                  aria-expanded={linking}
                  onClick={() => {
                    setLinking((open) => !open)
                    setNotice(null)
                  }}
                  className="rounded-lg bg-control px-3 py-2 text-sm font-semibold text-ink/80 hover:bg-control-hi"
                >
                  YouTube link
                </button>
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
              </>
            )}
          </div>
        </div>

        {demo && <DemoStatus />}

        {/* #20. Under the header rather than in a dialog: a link is pasted
            once and the field goes, so it borrows no more of the screen than
            the alert line below it. 16px on a phone so iOS does not zoom the
            page in on it. */}
        {linking && !demo && (
          <form
            aria-label="Add a YouTube video"
            onSubmit={(event) => {
              void onLinkSubmitted(event)
            }}
            className="mt-3 flex gap-2"
          >
            <input
              type="url"
              autoFocus
              value={link}
              onChange={(event) => setLink(event.target.value)}
              aria-label="YouTube link"
              placeholder="Paste a YouTube link"
              className="min-w-0 flex-1 rounded-lg bg-control px-3 py-2 text-base text-ink placeholder:text-ink/40 sm:text-sm"
            />
            <button
              type="submit"
              disabled={lookingUp || link.trim() === ''}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-2 disabled:opacity-40"
            >
              {lookingUp ? 'Looking…' : 'Add'}
            </button>
          </form>
        )}

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

        {/* No form around it and nothing to submit: the grid answers the keystroke.
            A submit would reload the page, and on a static site that means fetching
            the whole library again to answer a question already in memory.

            Labelled rather than captioned — the placeholder is a hint, not a name,
            and a visible label above the grid is a line of chrome the screen does
            not need. */}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search clips"
          placeholder="Search clips"
          className="mt-3 w-full rounded-lg bg-control px-3 py-2 text-sm text-ink placeholder:text-ink/40"
        />

        {/* #43. The ordering and the style share a row, the style pushed to
            the right as a group of its own — beside the toolbar rather than in
            it, because picking a style is a second question and not a fifth
            ordering. `ml-auto` keeps it right-aligned when a phone wraps it
            onto a line of its own. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <div role="toolbar" aria-label="Order clips" className="flex flex-wrap gap-1.5">
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

          {/* No All chip: nothing picked is the whole library, and picking the
              picked style again goes back to it — which is also what tells the
              two groups apart in the hand. An ordering is always chosen; a style
              need not be.

              Absent in the demo, whose one clip has no style to narrow by. */}
          {!demo && (
            <div role="group" aria-label="Filter by style" className="ml-auto flex gap-1.5">
              {STYLE_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={chip.id === picked}
                  onClick={() => pick(chip.id === picked ? undefined : chip.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    chip.id === picked ? chip.picked : chip.unpicked
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* An empty grid is only honest about a library that is empty. Under a
            search it would be saying "you have no clips" when the truth is "none
            of yours are called that" — the same conflation the loading and failed
            states above already refuse to make. Under a picked style it would be
            saying it when the truth is "none of yours are salsa" (#43), so the
            line names the style, and is named for whichever control emptied the
            grid.

            Named, for the reason those two are: `DriveStatus` owns an unnamed
            `status` on this screen and a second one would be indistinguishable
            from it. */}
        {excludedEverything && (
          <p
            role="status"
            aria-label={searching ? 'Search clips' : 'Filter by style'}
            className="mt-4 text-xs text-ink/60"
          >
            {searching
              ? `No ${pickedChip ? `${pickedChip.noun} ` : ''}clips match “${query.trim()}”.`
              : pickedChip?.none}
          </p>
        )}

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
              onDelete={demo ? undefined : onDelete}
              onRestyle={demo ? undefined : onRestyle}
              onRename={demo ? undefined : onRename}
            />
          ))}
        </ul>

        {!demo && (
          <>
            <DemoInvite />

            <p className="mt-6 text-xs text-ink/40">
              Clips live in Google Drive. The app only sees files it uploaded
              itself, so every clip has to come in through Add clip.
            </p>

            <DriveStatus />
          </>
        )}
      </main>
    </div>
  )
}
