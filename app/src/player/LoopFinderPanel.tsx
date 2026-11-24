/* #121. The Loop Finder's panel, in its own colour, where Saved loops sits
   while the finder is closed. */
export function LoopFinderPanel({ column }: { readonly column: boolean }) {
  return (
    <div
      role="group"
      aria-label="Loop Finder"
      className={`rounded-2xl bg-panel p-4 ring-2 ring-finder/60 ${column ? '' : 'mt-6'}`}
    >
      <h2 className="text-xs font-bold tracking-widest text-finder">LOOP FINDER</h2>
    </div>
  )
}
