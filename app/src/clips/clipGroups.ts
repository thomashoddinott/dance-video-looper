import type { Clip } from './clip'

export type ClipGroup = {
  readonly name: string
  readonly count: number
}

/* #70. There is no list of groups to keep beside the clips: a group is read
   off them, and exists while any clip is in it. Newest first, because back
   from a lesson that lesson's group is the one wanted — and a group is as
   recent as its most recently added clip. */
export const groupsOf = (clips: readonly Clip[]): readonly ClipGroup[] => {
  const held = new Map<string, { count: number; newest: string }>()

  for (const { group, added } of clips) {
    if (group === undefined) continue

    const so = held.get(group)

    held.set(group, {
      count: (so?.count ?? 0) + 1,
      newest: so === undefined || added > so.newest ? added : so.newest,
    })
  }

  return [...held]
    .sort(([, a], [, b]) => b.newest.localeCompare(a.newest))
    .map(([name, { count }]) => ({ name, count }))
}

/* Drive keeps an app property of at most 124 bytes, its key included,
   and the group is kept under `group` (`driveClips.GROUP`). A name is counted
   in bytes rather than characters because "Tuesday class · 27 Aug" is more of
   the one than the other, and a name Drive would refuse is better refused
   where it is typed. */
const DRIVE_PROPERTY_BYTES = 124
const GROUP_KEY_BYTES = 'group'.length

export const fitsAsGroupName = (name: string) =>
  new TextEncoder().encode(name).length <= DRIVE_PROPERTY_BYTES - GROUP_KEY_BYTES
