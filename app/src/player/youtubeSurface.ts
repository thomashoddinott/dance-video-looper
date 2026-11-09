import type { PlaybackSurface } from './playbackSurface'

/* The IFrame API's player, as much of it as this app calls. Named rather than
   taken from a typings package, for the reason `FetchLike` names its slice of
   `fetch`: a narrow contract is easy to stand in for in a test, and it says
   exactly which of YouTube's behaviours the player depends on. */
export type YouTubePlayer = {
  readonly getCurrentTime: () => number
  readonly seekTo: (seconds: number, allowSeekAhead: boolean) => void
  readonly getDuration: () => number
  readonly getPlayerState: () => number
  readonly playVideo: () => void
  readonly pauseVideo: () => void
  readonly getPlaybackRate: () => number
  readonly setPlaybackRate: (rate: number) => void
  readonly isMuted: () => boolean
  readonly mute: () => void
  readonly unMute: () => void
  readonly destroy: () => void
}

/* YouTube's own numbering of its player states. */
export const ENDED = 0
export const PLAYING = 1
export const PAUSED = 2
export const BUFFERING = 3

/* How long a seek stands in for YouTube's report of where the video is. The
   report trails by a frame or two once a seek has landed (measured at 17 ms
   between reports on the #20 spike); half a second covers one that is slow to
   land without leaving the playhead pinned if it never does. */
const REPORT_CATCHES_UP = 500
/* Close enough to count as the report having arrived at the seek. Wider than a
   frame because the video has started moving again by the time it is read. */
const ARRIVED = 0.35

/* #20. A YouTube video made into the surface a <video> already is, so the
   player drives it without knowing which it has.

   `currentTime` is the one that does not translate cleanly. `getCurrentTime()`
   reads a value the iframe posts across rather than the decoder's own clock, so
   straight after a seek it still reports where the video *was* — and the loop,
   seeing a time past B, would seek back on every frame until the report caught
   up. So a seek is remembered and stands in for the report until the report
   agrees with it, or half a second passes. */
export const youtubeSurface = (
  player: YouTubePlayer,
  {
    onSeeked,
    now = () => performance.now(),
  }: {
    /* There is no `seeked` event, and the player's seek gate (#23) waits for
       one. A seek counts as landed on the next turn, never inside the write:
       the gate arms its backstop before writing, and a report inside the write
       would settle a seek it has not finished issuing. */
    readonly onSeeked?: () => void
    readonly now?: () => number
  } = {},
): PlaybackSurface => {
  let sentTo: number | null = null
  let sentAt = 0

  return {
    get currentTime() {
      const reported = player.getCurrentTime()

      if (sentTo === null) return reported

      if (Math.abs(reported - sentTo) < ARRIVED || now() - sentAt > REPORT_CATCHES_UP) {
        sentTo = null
        return reported
      }

      return sentTo
    },
    set currentTime(seconds) {
      sentTo = seconds
      sentAt = now()
      player.seekTo(seconds, true)
      setTimeout(() => onSeeked?.(), 0)
    },
    get duration() {
      return player.getDuration()
    },
    get paused() {
      const state = player.getPlayerState()

      return state !== PLAYING && state !== BUFFERING
    },
    play: () => {
      player.playVideo()

      return Promise.resolve()
    },
    pause: () => {
      player.pauseVideo()
    },
    get playbackRate() {
      return player.getPlaybackRate()
    },
    set playbackRate(rate) {
      player.setPlaybackRate(rate)
    },
    get muted() {
      return player.isMuted()
    },
    set muted(quiet) {
      if (quiet) player.mute()
      else player.unMute()
    },
  }
}
