export type Loop = {
  readonly a: number
  readonly b: number
}

/* Three states rather than a length of zero standing in for two of them. A clip
   whose metadata has not arrived has a duration that is *unknown*; one that will
   not decode has none to know. The tile draws the same distinction for the length
   it carries (`clips/clip.ts`), and collapsing it here is what makes the mockup
   fail silently — 00:00 reads as a very short clip. */
export type Playback =
  | { readonly kind: 'opening' }
  | {
      readonly kind: 'ready'
      readonly duration: number
      readonly loop: Loop
      readonly looping: boolean
    }
  | { readonly kind: 'undecodable' }

export const opening: Playback = { kind: 'opening' }

export const undecodable: Playback = { kind: 'undecodable' }

/* BR-01: the player opens ready to loop. A and B span the whole clip and looping
   is already on, so pressing play immediately does the thing the app is for.
   Nothing has to be armed first. */
export const decoded = (seconds: number): Playback =>
  Number.isFinite(seconds) && seconds > 0
    ? {
        kind: 'ready',
        duration: seconds,
        loop: { a: 0, b: seconds },
        looping: true,
      }
    : undecodable
