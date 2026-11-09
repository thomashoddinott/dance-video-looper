import { vi } from 'vitest'

import type { YouTubeEvents, MountYouTube } from './youtubeMount'
import type { YouTubePlayer } from './youtubeSurface'
import { PAUSED } from './youtubeSurface'

/* A stand-in for the IFrame API's player, holding what YouTube would report
   and recording what it was asked to do. Complete by construction, like the
   other seams' factories. */
export const aYouTubePlayer = (
  overrides: Partial<YouTubePlayer> = {},
): YouTubePlayer => ({
  getCurrentTime: vi.fn(() => 0),
  seekTo: vi.fn(),
  getDuration: vi.fn(() => 712),
  getPlayerState: vi.fn(() => PAUSED),
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  getPlaybackRate: vi.fn(() => 1),
  setPlaybackRate: vi.fn(),
  isMuted: vi.fn(() => false),
  mute: vi.fn(),
  unMute: vi.fn(),
  destroy: vi.fn(),
  ...overrides,
})

/* YouTube itself, as far as the player can tell: a mount that hands back the
   player above and keeps hold of the events, so a case can say "YouTube is
   ready", "it started playing", "it refused" when it chooses to. */
export const aYouTube = (player: YouTubePlayer = aYouTubePlayer()) => {
  const held: { events?: YouTubeEvents; videoId?: string } = {}

  const mount: MountYouTube = vi.fn(async (_host, videoId, events) => {
    held.videoId = videoId
    held.events = events

    return player
  })

  const events = () => {
    if (!held.events) throw new Error('YouTube was never mounted')

    return held.events
  }

  return {
    mount,
    player,
    videoId: () => held.videoId,
    ready: () => events().onReady(),
    state: (state: number) => events().onStateChange(state),
    rate: (rate: number) => events().onPlaybackRateChange(rate),
    error: (code: number) => events().onError(code),
  }
}
