import { useState } from 'react'
import Library from './Library.jsx'
import Player from './Player.jsx'

/* Stand-in for what Drive will return. Only the first entry is a real clip —
   the rest are deliberately blank placeholders, so the grid reads as a list of
   separate clips rather than one clip chopped into pieces. The loops belonging
   to a clip live on the player screen; here they are only a count. */
const SEED_CLIPS = [
  {
    id: 1,
    name: 'Turn combo — Dubai',
    added: '2026-08-29',
    seconds: 26,
    loops: 5,
    src: '/sample.mp4',
  },
  { id: 2, name: 'Clip 2', added: '2026-08-27', seconds: 18, loops: 2 },
  { id: 3, name: 'Clip 3', added: '2026-08-24', seconds: 41, loops: 0 },
  { id: 4, name: 'Clip 4', added: '2026-08-19', seconds: 12, loops: 3 },
  { id: 5, name: 'Clip 5', added: '2026-08-11', seconds: 33, loops: 1 },
  { id: 6, name: 'Clip 6', added: '2026-08-04', seconds: 24, loops: 0 },
]

/* Two screens, switched by state rather than a router — the mockup has no URLs
   to preserve and a router would be one more thing to strip out later. The clip
   list lives here so an added clip survives a trip into the player and back. */
function App() {
  const [clips, setClips] = useState(SEED_CLIPS)
  const [clip, setClip] = useState(null)

  const addClip = (added) => setClips([added, ...clips])

  /* The mockup has no Drive, so a delete is just the tile going. In the product
     this trashes the Drive file first and only then drops the tile (UC-01
     Q-08) — the clip stays recoverable from Drive's own bin. */
  const deleteClip = (gone) => setClips(clips.filter((clip) => clip.id !== gone.id))

  if (clip) {
    return <Player clip={clip} onBack={() => setClip(null)} />
  }

  // Placeholder clips have no source of their own, so they fall back to the
  // sample — the player is what's being mocked here, not the clip.
  return (
    <Library
      clips={clips}
      onAdd={addClip}
      onDelete={deleteClip}
      onOpen={(chosen) => setClip({ ...chosen, src: chosen.src ?? '/sample.mp4' })}
    />
  )
}

export default App
