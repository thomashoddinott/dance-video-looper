import type { Clip } from './clip'

export const orderings = [
  {
    id: 'added',
    label: 'Recent',
    compare: (a: Clip, b: Clip) => b.added.localeCompare(a.added),
  },
  {
    id: 'name',
    label: 'Name',
    compare: (a: Clip, b: Clip) => a.name.localeCompare(b.name),
  },
  {
    id: 'loops',
    label: 'Most looped',
    compare: (a: Clip, b: Clip) => b.loops - a.loops,
  },
] as const

export type OrderingId = (typeof orderings)[number]['id']
