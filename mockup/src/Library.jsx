import { useEffect, useRef, useState } from 'react'

/* Recent is the day a clip was uploaded and never changes again, so it cannot
   answer "what am I working on". Last opened can, and it moves on the one action
   a practice session is mostly made of: open a clip, watch it, go back.

   It **replaces** Last practised (#12, #16) rather than joining it. That chip
   stamped a clip only when a loop was saved on it or removed from it — a rare
   enough event that the ordering seldom moved.

   A clip never opened compares as the empty string, which puts the whole
   never-opened tail below every clip that has been — and still draws it, because
   a clip vanishing from the grid under one chip would read as a clip deleted.

   Last of the four so that `SORTS[0]` stays Recent: it is the default, and it
   is where the grid jumps back to after an add. */
const SORTS = [
  { id: 'added', label: 'Recent', compare: (a, b) => b.added.localeCompare(a.added) },
  { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  { id: 'loops', label: 'Most looped', compare: (a, b) => b.loops - a.loops },
  {
    id: 'opened',
    label: 'Last opened',
    compare: (a, b) => (b.opened ?? '').localeCompare(a.opened ?? ''),
  },
]

/* #43. Two styles and no third: a clip that is neither is a clip with no
   style, drawn only while no style is picked, not an "Other" bucket to
   maintain.

   Each wears its own colour (`index.css`) wherever it appears, so the tile
   label, the chooser and the filter chip are recognisably one thing. Spelled
   out whole rather than built from the id, because Tailwind only generates a
   class it can find written down. */
const STYLES = [
  { id: 'salsa', label: 'Salsa', fill: 'bg-salsa text-on-accent', text: 'text-salsa' },
  { id: 'bachata', label: 'Bachata', fill: 'bg-bachata text-on-accent', text: 'text-bachata' },
]

const styleOf = (style) => STYLES.find(({ id }) => id === style)

function formatDuration(seconds) {
  const whole = Math.round(seconds)
  const mins = Math.floor(whole / 60)
  return `${mins}:${String(whole % 60).padStart(2, '0')}`
}

function formatAdded(added) {
  return new Date(added).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function Thumbnail({ clip }) {
  if (clip.src) {
    return (
      <video
        src={`${clip.src}#t=3`}
        preload="metadata"
        muted
        playsInline
        className="aspect-[9/16] w-full object-cover transition group-hover:opacity-90"
      />
    )
  }

  return (
    <div className="flex aspect-[9/16] w-full items-center justify-center bg-control">
      <span className="text-3xl font-bold text-ink/25">{clip.id}</span>
    </div>
  )
}

/* Retrofitted from the product (UC-01 Q-08, #78) — the mockup gate pass for a
   screen that was drawn before anything could delete a clip.

   The ✕ is a sibling of the tile's open button, not a child: nesting one button
   in another is invalid markup. In production the tile is an anchor and the
   same constraint bites harder. It is always in the document and only *fades*
   on hover, because a phone has no hover and the phone is half of why the
   product syncs through Drive at all. */
function ClipTile({ clip, onOpen, onDelete, onStyle, uploading }) {
  const [asking, setAsking] = useState(false)
  /* #43. One question on the tile at a time: the style chooser and the delete
     prompt cover the same thumbnail, so opening either closes the other. */
  const [choosing, setChoosing] = useState(false)
  const style = styleOf(clip.style)

  return (
    <li className="group/tile relative">
      <button
        type="button"
        onClick={() => onOpen(clip)}
        className="group w-full text-left"
      >
        <div className="relative overflow-hidden rounded-xl bg-black">
          <Thumbnail clip={clip} />
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {formatDuration(clip.seconds)}
          </span>
          {/* Retrofitted from the product (US-01-14, #43). The tile goes into
              the grid the moment the clip is added and the upload runs behind
              it — measured at 13 s for 9.33 MB — so the bar sits on the tile
              rather than in a banner, which is where the eye already is after
              the sort flips to Recent. */}
          {uploading !== undefined && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
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
      </button>

      {uploading === undefined && onDelete && (
        <button
          type="button"
          aria-label={`Delete ${clip.name}`}
          aria-expanded={asking}
          onClick={() => {
            setChoosing(false)
            setAsking((open) => !open)
          }}
          className="absolute top-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-lg leading-none text-white/70 opacity-100 transition hover:text-white sm:opacity-0 sm:group-hover/tile:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100"
        >
          &times;
        </button>
      )}

      {/* #43. The style, in the corner opposite the ✕ and in the style's own
          colour, so with no style picked the grid still says which clip is
          which at a glance. It is also the way to change it, and it never
          fades: the phone has no hover and is where most clips arrive
          untagged. A sibling of the open button for the reason the ✕ is. */}
      {uploading === undefined && onStyle && (
        <button
          type="button"
          aria-label={`Style of ${clip.name}: ${style?.label ?? 'none'}`}
          aria-expanded={choosing}
          onClick={() => {
            setAsking(false)
            setChoosing((open) => !open)
          }}
          className={`absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            style ? style.fill : 'bg-black/40 text-white/70 hover:text-white'
          }`}
        >
          {style?.label ?? '+ Style'}
        </button>
      )}

      {/* Every style is drawn in its colour whether or not it is the current
          one, so the chooser previews the label it will leave on the tile. The
          current one is ringed rather than recoloured. */}
      {choosing && (
        <div className="absolute inset-x-0 top-0 flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-xl bg-shell/95 px-2 text-center">
          <p className="text-xs font-semibold">Style</p>
          {[
            ...STYLES,
            { id: undefined, label: 'None', fill: 'bg-control text-ink/70 hover:bg-control-hi' },
          ].map(({ id, label, fill }) => (
            <button
              key={label}
              type="button"
              aria-pressed={clip.style === id}
              onClick={() => {
                setChoosing(false)
                onStyle(clip, id)
              }}
              className={`w-full max-w-24 rounded-lg px-3 py-1.5 text-xs font-semibold ${fill} ${
                clip.style === id ? 'ring-2 ring-ink ring-offset-2 ring-offset-shell' : ''
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setChoosing(false)}
            className="text-[11px] text-ink/50 underline underline-offset-2 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      {/* The ✕ stays mounted underneath, so a keyboard that reached it has
          somewhere to keep its focus. */}
      {asking && (
        <div className="absolute inset-x-0 top-0 flex aspect-[9/16] flex-col items-center justify-center gap-2 rounded-xl bg-shell/95 px-2 text-center">
          <p className="text-xs font-semibold">Delete?</p>
          <button
            type="button"
            onClick={() => {
              setAsking(false)
              onDelete(clip)
            }}
            className="w-full max-w-24 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-2"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="w-full max-w-24 rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
          >
            Cancel
          </button>
          <p className="text-[10px] leading-tight text-ink/50">
            Goes to your Drive bin. Saved loops are kept.
          </p>
        </div>
      )}
    </li>
  )
}

/* Retrofitted from the built app rather than drawn first — US-01-13 turned out
   to need a surface, and no mockup existed for it (CLAUDE.md → Process, the
   mockup gate pass). The wording and classes are the production ones.

   The mockup has no Drive, so the button walks the states instead of signing
   anything in. That is the point: every sentence the dancer can be shown is
   reachable here, which a real sign-in button could not manage. */
const DRIVE_STATES = [
  { notice: 'Not connected to Drive.', connected: false },
  { notice: 'Drive is connected.', connected: true },
  { notice: 'Drive is connected. Your Drive session was renewed.', connected: true },
  {
    notice:
      'Drive is unavailable — you declined access, so clips and saved loops will not sync.',
    connected: false,
  },
  {
    notice:
      'Drive is unavailable — access was removed from your Google account, so clips and saved loops will not sync.',
    connected: false,
  },
  {
    notice:
      'Drive is unavailable — Google sign-in is not available right now, so clips and saved loops will not sync.',
    connected: false,
  },
  {
    notice:
      'Drive is not set up — this build has no Google Client ID. See app/.env.example.',
    connected: false,
  },
]

function DriveStatus({ onDemo }) {
  const [state, setState] = useState(0)
  const { notice, connected } = DRIVE_STATES[state]

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="text-xs text-ink/40">{notice}</p>

      {!connected && (
        <button
          type="button"
          onClick={() => setState((at) => (at + 1) % DRIVE_STATES.length)}
          className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
        >
          Connect Google Drive
        </button>
      )}

      {/* Retrofitted from the product (#33): offered wherever Connect is. In
          the product it is a link to `/demo`, the same app over one bundled
          clip; the mockup has no second mount, so it flips the grid instead.
          In the accent Add clip wears, so it reads apart from Connect. */}
      {!connected && (
        <button
          type="button"
          onClick={onDemo}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-2"
        >
          Demo mode
        </button>
      )}

      {connected && (
        <button
          type="button"
          onClick={() => setState((at) => (at + 1) % DRIVE_STATES.length)}
          className="text-xs text-ink/25 underline underline-offset-2"
        >
          next state
        </button>
      )}
    </div>
  )
}

/* Retrofitted from the product: the dashboard links to the code behind it,
   signed in, signed out or in the demo. The player leaves it off. */
function SourceLink() {
  return (
    <a
      href="https://github.com/thomashoddinott/dance-video-looper"
      target="_blank"
      rel="noreferrer"
      aria-label="Source code on GitHub"
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/50 hover:text-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor" className="size-4">
        <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
      </svg>
      Source
    </a>
  )
}

/* The mockup has no Drive, so an upload is played out rather than performed —
   0 to 1 over roughly the 13 s the spike measured for a 9 MB clip, scaled down
   to something watchable. It exists so the affordance can be looked at, which
   is the only thing a mockup is for. */
const UPLOAD_PLAYS_OUT_OVER = 2500

/* `sort` is held by the caller rather than here, and that is load-bearing for
   #16 rather than tidiness: this screen is unmounted while the player is up, so
   local state would start over at Recent every time the dancer came back — and
   **Last opened** is a chip whose whole point is what you see *after* a trip
   through the player. Picking it, opening a clip and returning to Recent would
   make the ordering unreachable in the one moment it is for.

   The search stays local, and the contrast is the point: it is a question about
   the grid in front of you rather than a setting, so coming back with the whole
   library showing is the honest default. */
/* Retrofitted from the product (#33), which sits under the heading rather than
   in the footer: the first thing a visitor should know is that this is a
   sample. Both buttons leave the demo — in the product Connect is the real
   sign-in, and signing in hands over to the dancer's own library. */
function DemoStatus({ onLeave }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="text-xs text-ink/60">
        Demo mode — a sample clip to try the player on. Loops you save stay in
        this browser.
      </p>

      <button
        type="button"
        onClick={onLeave}
        className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
      >
        Connect Google Drive
      </button>

      <button
        type="button"
        onClick={onLeave}
        className="rounded-lg bg-control px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-control-hi"
      >
        Exit demo
      </button>
    </div>
  )
}

function Library({
  clips,
  sort,
  onSort,
  filter,
  onFilter,
  onOpen,
  onAdd,
  onDelete,
  onStyle,
}) {
  /* #33. The product's demo is one bundled clip with nothing to manage — no
     Add clip, no ✕, no Drive footer. The first entry is the mockup's only real
     clip, so it stands in for the bundled one. The player's own "Demo" label
     is in the product only. */
  const [demo, setDemo] = useState(false)
  const shown = demo ? clips.slice(0, 1) : clips
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState(null)
  const [uploading, setUploading] = useState({})
  /* The library comes out of Drive in the product, so there is a moment before
     it arrives when an empty grid would otherwise mean "you have no clips"
     rather than "we have not looked yet" (US-01-14 criterion 8). */
  const [loading, setLoading] = useState(true)
  const fileRef = useRef(null)

  useEffect(() => {
    const settled = setTimeout(() => setLoading(false), 900)

    return () => clearTimeout(settled)
  }, [])

  const playOutAnUpload = (id) => {
    const started = Date.now()
    const tick = setInterval(() => {
      const through = Math.min(1, (Date.now() - started) / UPLOAD_PLAYS_OUT_OVER)

      setUploading((held) => ({ ...held, [id]: through }))

      if (through === 1) {
        clearInterval(tick)
        setUploading(({ [id]: _done, ...rest }) => rest)
      }
    }, 100)
  }

  const active = SORTS.find((option) => option.id === sort)
  const wanted = query.trim().toLowerCase()
  /* #43. The demo is one clip with no style control, so a filter carried in
     from the dancer's own library must not be able to hide it. */
  const styled = demo ? null : styleOf(filter)?.label
  const inStyle = styled ? shown.filter((clip) => clip.style === filter) : shown
  /* Filter, then order. The style and the search both narrow the set and the
     chosen chip orders what is left, so the controls compose rather than
     compete. */
  const found = wanted
    ? inStyle.filter((clip) => clip.name.toLowerCase().includes(wanted))
    : inStyle
  const ordered = [...found].sort(active.compare)

  /* Reads the real duration off the chosen file before adding it, so the new
     tile carries a true length rather than a made-up one. In the product this
     is where the Drive upload goes.

     TODO — compress before upload. Clips come off a phone at full resolution
     (a 26s 720x1280 sample is already ~6MB; 1080p is several times that), and
     Drive's free tier is 15GB shared with everything else. Re-encoding to a
     low-resolution mp4 here would multiply how many clips fit, and the app
     never needs better than practice quality.

     Has to work on the phone, not just the laptop. It can:

     - **WebCodecs** (`VideoEncoder`/`VideoDecoder`) plus an mp4 muxer is the
       route. Native, hardware-accelerated, no extra headers, real mp4 out.
       iOS Safari has had the *video* interfaces since 16.4, and full WebCodecs
       since Safari 26 — so mobile is not the blocker it looks like.
     - **Audio is the mobile catch, not video.** Safari 16.4-18.7 shipped
       video-only: no `AudioEncoder`. On those versions the soundtrack can't be
       re-encoded, and a dance clip without its music is useless. Mux the
       original audio through untouched instead — video is nearly all the file
       size anyway, so passthrough costs little.
     - **ffmpeg.wasm is the trap.** Its fast multithreaded build needs
       SharedArrayBuffer, which requires COOP/COEP response headers, and
       **GitHub Pages cannot set headers**. The single-threaded fallback works
       without them but transcodes at roughly real time or worse. Don't reach
       for it just because it is the familiar name.
     - MediaRecorder over a canvas is the crude fallback: it re-encodes by
       playing the clip through, so it is slow and drops frame timing.

     Pick the codec settings against a real clip, not from first principles —
     the question is what still reads clearly when slowed to 0.25x. Measure
     encode time on the phone too: the feature is worthless if adding a clip in
     a studio takes a minute. */
  const onFileChosen = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    /* Retrofitted from the built app (US-01-04), like DriveStatus above — the
       mockup had no way to show an add that failed, so it showed nothing at
       all. Two of the three refusals production makes are reachable here; the
       third is its timeout on a file that never answers, which is a deadline
       rather than a thing to look at, so it is not drawn.

       Identity is name + size + last-modified. Name and size alone — what this
       file used to key on — collide often enough to make two different clips
       share a tile. */
    const id = `added-${file.name}-${file.size}-${file.lastModified}`

    if (clips.some((clip) => clip.id === id)) {
      setNotice(`${file.name.replace(/\.[^.]+$/, '')} is already in your library.`)
      return
    }

    const src = URL.createObjectURL(file)
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.src = src
    probe.onerror = () => {
      URL.revokeObjectURL(src)
      setNotice(`${file.name} could not be read as a video.`)
    }
    probe.onloadedmetadata = () => {
      setNotice(null)
      onAdd({
        id,
        name: file.name.replace(/\.[^.]+$/, ''),
        added: new Date().toISOString().slice(0, 10),
        seconds: probe.duration,
        loops: 0,
        src,
      })
      onSort('added')
      /* The search goes for the same reason the sort flips, and a sharper one: a
         search the new clip does not match hides it outright. So does the
         style (#43): a new clip has none yet, so any style picked hides it. */
      setQuery('')
      onFilter('all')
      playOutAnUpload(id)
    }
  }

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
                  onClick={() => fileRef.current.click()}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-on-accent hover:bg-accent-2"
                >
                  Add clip
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  onChange={onFileChosen}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>

        {demo && <DemoStatus onLeave={() => setDemo(false)} />}

        {notice && (
          <p className="mt-2 text-xs text-ink/60">{notice}</p>
        )}

        {loading && (
          <p className="mt-2 text-xs text-ink/40">Loading your clips…</p>
        )}

        {/* Retrofitted from the product (US-01-18, #13) — the mockup gate pass for
            a control the screen was drawn too early to need. This page dates from
            a library of a handful of clips; at dozens the grid is a scroll.

            No form and nothing to submit: the grid answers the keystroke. */}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search clips"
          placeholder="Search clips"
          className="mt-3 w-full rounded-lg bg-control px-3 py-2 text-sm text-ink placeholder:text-ink/40"
        />

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSort(option.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                option.id === sort
                  ? 'bg-control-hi text-ink'
                  : 'bg-control text-ink/60 hover:bg-control-hi'
              }`}
            >
              {option.label}
            </button>
          ))}

          {/* #43, drawn ahead of the build. Its own group, pushed right, so it
              shares the row the ordering chips already take rather than
              spending one of its own — and reads as a second question, not a
              fifth ordering. `ml-auto` keeps it right-aligned when a phone
              wraps it onto a line of its own.

              No All chip: nothing picked is the whole library, and picking the
              chosen style again goes back to it. That is also what tells the
              two groups apart in the hand — an ordering is always chosen, a
              style need not be.

              Lettered in the style's colour until picked, then filled with it:
              the same colour as the labels it is about to leave on screen. A
              filled chip is also one a hover cannot pass for, which the
              ordering chips' grey-on-grey could. */}
          {!demo && (
            <div role="group" aria-label="Filter by style" className="ml-auto flex gap-1.5">
              {STYLES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.id === filter}
                  onClick={() => onFilter(option.id === filter ? 'all' : option.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    option.id === filter
                      ? option.fill
                      : `bg-control hover:bg-control-hi ${option.text}`
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* An empty grid is only honest about an empty library. Under a search it
            would be saying "you have no clips" when the truth is "none of yours
            are called that".

            And only once there is a library to have not matched: while it is
            still loading there are no clips whatever was typed, so blaming the
            search would be the same lie one state along.

            A style that nothing has yet is the same case (#43), and names the
            style so the dancer can see which control emptied the grid. */}
        {(wanted || styled) && shown.length > 0 && ordered.length === 0 && (
          <p className="mt-4 text-xs text-ink/60">
            {wanted
              ? `No ${styled ? `${styled} ` : ''}clips match “${query.trim()}”.`
              : `No ${styled} clips yet.`}
          </p>
        )}

        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((clip) => (
            <ClipTile
              key={clip.id}
              clip={clip}
              onOpen={onOpen}
              onDelete={demo ? undefined : onDelete}
              onStyle={demo ? undefined : onStyle}
              uploading={uploading[clip.id]}
            />
          ))}
        </ul>

        {!demo && (
          <>
            <p className="mt-6 text-xs text-ink/40">
              Clips live in Google Drive. The app only sees files it uploaded
              itself, so every clip has to come in through Add clip.
            </p>

            <DriveStatus onDemo={() => setDemo(true)} />
          </>
        )}
      </main>
    </div>
  )
}

export default Library
