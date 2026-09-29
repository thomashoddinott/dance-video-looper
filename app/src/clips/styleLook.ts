import type { DanceStyle } from './danceStyle'

/* #43. How each style is drawn, wherever it is drawn — the tile's label, its
   chooser, the filter chip — so the three read as one thing. Kept apart from
   `danceStyle`, which says what a style *is* and has no business knowing
   Tailwind.

   Spelled out whole rather than built from the id: Tailwind only generates a
   class it can find written down. */
export const STYLE_LOOK: Readonly<
  Record<DanceStyle, { readonly fill: string; readonly text: string }>
> = {
  salsa: { fill: 'bg-salsa text-on-accent', text: 'text-salsa' },
  bachata: { fill: 'bg-bachata text-on-accent', text: 'text-bachata' },
}
