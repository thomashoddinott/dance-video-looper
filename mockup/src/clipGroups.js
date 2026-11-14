/* Newest lesson first: a group is as recent as its most recent clip. */
export const groupsOf = (clips) => {
  const byName = new Map()

  for (const clip of clips) {
    if (!clip.group) continue
    const held = byName.get(clip.group) ?? { name: clip.group, count: 0, newest: '' }
    byName.set(clip.group, {
      ...held,
      count: held.count + 1,
      newest: clip.added > held.newest ? clip.added : held.newest,
    })
  }

  return [...byName.values()].sort((a, b) => b.newest.localeCompare(a.newest))
}
