import { useState } from 'react'

/* #70, the mockup gate pass, drawn ahead of the build. A clip can be put in
   one group, shown as a label under its name and set from a chooser on the
   tile; a row of chips narrows the grid to one group. Picked over folders
   (a view of their own, with a Select mode): labels work like the style chips
   already do and never hide a clip.

   A group exists while any clip is in it — there is no list of groups to keep
   beside the clips (`clipGroups.js`). */

/* A name typed for a new group. Enter or Add takes it; an empty one cannot. */
function NewGroupField({ onAdd }) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (trimmed) onAdd(trimmed)
      }}
      className="flex w-full gap-1.5"
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="New group"
        placeholder="New group"
        className="min-w-0 flex-1 rounded-lg bg-control px-2 py-1.5 text-base text-ink placeholder:text-ink/40 sm:text-xs"
      />
      <button
        type="submit"
        disabled={!trimmed}
        className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-on-accent hover:bg-accent-2 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  )
}

/* Under the tile's name and date: the group if it has one, or a quiet way to
   give it one. A sibling of the tile's open button — a button cannot sit
   inside another. */
export function GroupLabel({ clip, onAsk }) {
  return (
    <button
      type="button"
      aria-label={`Group of ${clip.name}: ${clip.group ?? 'none'}`}
      onClick={onAsk}
      className={`mt-0.5 max-w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-semibold ${
        clip.group
          ? 'bg-accent/15 text-accent hover:bg-accent/25'
          : 'text-ink/40 hover:text-ink'
      }`}
    >
      {clip.group ?? '+ Group'}
    </button>
  )
}

/* Over the tile, as the style chooser is: every group, newest first, the
   current one ringed; a new one typed in place; or out of any group. Scrolls
   inside the tile once there are more groups than it holds. */
export function GroupChooser({ clip, groups, onChoose, onCancel }) {
  return (
    <div className="absolute inset-x-0 top-0 flex aspect-[9/16] flex-col items-center gap-1.5 overflow-y-auto rounded-xl bg-shell/95 px-2 py-3 text-center">
      <p className="text-xs font-semibold">Group</p>
      <NewGroupField onAdd={onChoose} />
      {groups.map(({ name }) => (
        <button
          key={name}
          type="button"
          aria-pressed={clip.group === name}
          onClick={() => onChoose(name)}
          className={`w-full shrink-0 truncate rounded-lg bg-control px-2 py-1.5 text-xs font-semibold text-ink/80 hover:bg-control-hi ${
            clip.group === name ? 'ring-2 ring-accent ring-offset-2 ring-offset-shell' : ''
          }`}
        >
          {name}
        </button>
      ))}
      {clip.group && (
        <button
          type="button"
          onClick={() => onChoose(undefined)}
          className="w-full shrink-0 rounded-lg bg-control px-2 py-1.5 text-xs font-semibold text-ink/60 hover:bg-control-hi"
        >
          Take out of group
        </button>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 text-[11px] text-ink/50 underline underline-offset-2 hover:text-ink"
      >
        Cancel
      </button>
    </div>
  )
}

/* How many chips the row holds before the rest go behind All groups: 2 on a
   phone, 4 from `sm`, 5 from `lg`. Counted rather than measured, so a long
   name truncates instead of pushing its neighbours off the row. Spelled out
   whole, because Tailwind only generates a class it can find written down. */
const chipShownAt = (index) =>
  index < 2 ? '' : index < 4 ? 'hidden sm:block' : index < 5 ? 'hidden lg:block' : 'hidden'

/* All groups is offered only where some chip did not fit. */
const moreShownAt = (count) =>
  count > 5 ? '' : count > 4 ? 'lg:hidden' : count > 2 ? 'sm:hidden' : 'hidden'

/* One row that never wraps, however many groups there are: the newest that
   fit, then All groups for the rest — every group, with a field to find one
   by name. The picked group is pinned to the front, so the row always says
   what the grid is narrowed to, even when it is an old one. */
export function GroupFilter({ groups, picked, onPick }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  if (groups.length === 0) return null

  const row = picked
    ? [groups.find(({ name }) => name === picked), ...groups.filter(({ name }) => name !== picked)]
    : groups
  const wanted = query.trim().toLowerCase()
  const listed = wanted
    ? groups.filter(({ name }) => name.toLowerCase().includes(wanted))
    : groups

  const pick = (name) => {
    onPick(name === picked ? null : name)
    setOpen(false)
    setQuery('')
  }

  return (
    <div role="group" aria-label="Filter by group" className="relative mt-3 flex items-center gap-1.5">
      {row.map((group, index) => (
        <button
          key={group.name}
          type="button"
          aria-pressed={group.name === picked}
          onClick={() => pick(group.name)}
          className={`max-w-36 shrink-0 truncate rounded-full px-3 py-1 text-xs font-semibold ${chipShownAt(index)} ${
            group.name === picked
              ? 'bg-accent text-on-accent'
              : 'bg-control text-ink/70 hover:bg-control-hi'
          }`}
        >
          {group.name}
        </button>
      ))}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((held) => !held)}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-ink/60 hover:bg-control ${moreShownAt(groups.length)}`}
      >
        All groups ▾
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 left-0 z-30 mt-1.5 rounded-xl bg-panel p-2 shadow-lg ring-1 ring-ink/10 sm:left-auto sm:w-80">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOpen(false)
              }}
              aria-label="Find a group"
              placeholder="Find a group"
              className="w-full rounded-lg bg-control px-3 py-2 text-base text-ink placeholder:text-ink/40 sm:text-sm"
            />
            <ul className="mt-1.5 max-h-64 overflow-y-auto">
              {listed.map((group) => (
                <li key={group.name}>
                  <button
                    type="button"
                    aria-pressed={group.name === picked}
                    onClick={() => pick(group.name)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-control ${
                      group.name === picked ? 'font-semibold text-accent' : ''
                    }`}
                  >
                    <span className="flex-1 truncate">{group.name}</span>
                    <span className="text-xs text-ink/40">{group.count}</span>
                  </button>
                </li>
              ))}
            </ul>
            {listed.length === 0 && (
              <p className="px-3 py-2 text-sm text-ink/50">No group matches “{query.trim()}”.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
