/* The playback port (#20): the slice of a video element this screen drives.
   A `<video>` is one already; a YouTube video is made into one
   (`youtubeSurface`). Nothing that plays, pauses, seeks, slows or mutes the clip
   needs to know which it has, which is what keeps YouTube from forking the
   player in every place it touches the clip. */
export type PlaybackSurface = {
  currentTime: number
  readonly duration: number
  readonly paused: boolean
  readonly play: () => Promise<void>
  readonly pause: () => void
  playbackRate: number
  muted: boolean
}
