import { useRef, useState } from 'react'

import type { ClipGroup } from './clipGroups'

/* How many chips the row holds before the rest go behind All groups: 2 on a
   phone, 4 from `sm`, 5 from `lg`. Counted rather than measured, so a long
   name truncates instead of pushing its neighbours off the row — and spelled
   out whole, because Tailwind only generates a class it can find written. */
const chipShownAt = (index: number) =>
  index < 2 ? '' : index < 4 ? 'hidden tablet:block' : index < 5 ? 'hidden desktop:block' : 'hidden'

/* All groups is offered only where some chip did not fit. */
const moreShownAt = (count: number) =>
  count > 5 ? '' : count > 4 ? 'desktop:hidden' : count > 2 ? 'tablet:hidden' : 'hidden'

/* #70. One row that never wraps, however many groups a dancer makes: the
   newest that fit, then All groups for the rest — every group, with a field
   to find one by name. The picked group is pinned to the front, so the row
   always says what the grid is narrowed to, even when it is an old one.

   Picking the picked group again gives the whole library back, as a style
   chip does (#43): nothing picked is no narrowing at all. */
export function GroupFilter({
  groups,
  picked,
  onPick,
}: {
  readonly groups: readonly ClipGroup[]
  readonly picked: string | undefined
  readonly onPick: (group: string | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const more = useRef<HTMLButtonElement>(null)

  if (groups.length === 0) return null

  const pinned = groups.find(({ name }) => name === picked)
  const row =
    pinned === undefined ? groups : [pinned, ...groups.filter((group) => group !== pinned)]
  const wanted = query.trim().toLowerCase()
  const listed =
    wanted === '' ? groups : groups.filter(({ name }) => name.toLowerCase().includes(wanted))

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const pick = (name: string) => {
    onPick(name === picked ? undefined : name)
    close()
  }

  return (
    <div
      role="group"
      aria-label="Filter by group"
      className="relative mt-3 flex items-center gap-1.5"
    >
      {row.map((group, index) => (
        <button
          key={group.name}
          type="button"
          aria-pressed={group.name === picked}
          onClick={() => {
            pick(group.name)
          }}
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
        ref={more}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) close()
          else setOpen(true)
        }}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-ink/60 hover:bg-control ${moreShownAt(groups.length)}`}
      >
        All groups ▾
      </button>

      {open && (
        <>
          {/* Anywhere else on the page closes the list, as a menu does. */}
          <div aria-hidden="true" className="fixed inset-0 z-20" onClick={close} />
          <div
            role="dialog"
            aria-label="All groups"
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              close()
              more.current?.focus()
            }}
            className="absolute top-full right-0 left-0 z-30 mt-1.5 rounded-xl bg-panel p-2 shadow-lg ring-1 ring-ink/10 tablet:left-auto tablet:w-80"
          >
            {/* 16px on a phone so iOS does not zoom the page in on it (#20). */}
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
              }}
              aria-label="Find a group"
              placeholder="Find a group"
              className="w-full rounded-lg bg-control px-3 py-2 text-base text-ink placeholder:text-ink/40 tablet:text-sm"
            />
            <ul className="mt-1.5 max-h-64 overflow-y-auto">
              {listed.map((group) => (
                <li key={group.name}>
                  <button
                    type="button"
                    onClick={() => {
                      pick(group.name)
                    }}
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
              <p className="px-3 py-2 text-sm text-ink/50">
                No group matches “{query.trim()}”.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
