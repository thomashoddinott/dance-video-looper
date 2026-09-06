import { useEffect, useRef, useState } from 'react'

const SORTS = [
  { id: 'added', label: 'Recent', compare: (a, b) => b.added.localeCompare(a.added) },
  { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  { id: 'loops', label: 'Most looped', compare: (a, b) => b.loops - a.loops },
]

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
function ClipTile({ clip, onOpen, onDelete, uploading }) {
  const [asking, setAsking] = useState(false)

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

      {uploading === undefined && (
        <button
          type="button"
          aria-label={`Delete ${clip.name}`}
          aria-expanded={asking}
          onClick={() => setAsking((open) => !open)}
          className="absolute top-1.5 right-1.5 rounded-full bg-black/70 px-2 py-0.5 text-lg leading-none text-white/70 opacity-100 transition hover:text-white sm:opacity-0 sm:group-hover/tile:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100"
        >
          &times;
        </button>
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

function DriveStatus() {
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

/* The mockup has no Drive, so an upload is played out rather than performed —
   0 to 1 over roughly the 13 s the spike measured for a 9 MB clip, scaled down
   to something watchable. It exists so the affordance can be looked at, which
   is the only thing a mockup is for. */
const UPLOAD_PLAYS_OUT_OVER = 2500

function Library({ clips, onOpen, onAdd, onDelete }) {
  const [sort, setSort] = useState(SORTS[0].id)
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
  const ordered = [...clips].sort(active.compare)

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
      setSort('added')
      playOutAnUpload(id)
    }
  }

  return (
    <div className="min-h-screen bg-shell text-ink">
      <main className="mx-auto max-w-4xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Clips</h1>
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
        </div>

        {notice && (
          <p className="mt-2 text-xs text-ink/60">{notice}</p>
        )}

        {loading && (
          <p className="mt-2 text-xs text-ink/40">Loading your clips…</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSort(option.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                option.id === sort
                  ? 'bg-control-hi text-ink'
                  : 'bg-control text-ink/60 hover:bg-control-hi'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {ordered.map((clip) => (
            <ClipTile
              key={clip.id}
              clip={clip}
              onOpen={onOpen}
              onDelete={onDelete}
              uploading={uploading[clip.id]}
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

export default Library
