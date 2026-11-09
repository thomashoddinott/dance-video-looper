import { describe, expect, it, vi } from 'vitest'

import { aYouTubePlayer } from './youtubePlayer.factory'
import { BUFFERING, PAUSED, PLAYING, youtubeSurface } from './youtubeSurface'

/* #20. The player drives a YouTube video through the same surface a <video>
   offers, so these are the element's behaviours, answered by YouTube. */
describe('a YouTube video as a playback surface', () => {
  it('is where YouTube says it is', () => {
    const surface = youtubeSurface(aYouTubePlayer({ getCurrentTime: () => 42.5 }))

    expect(surface.currentTime).toBe(42.5)
  })

  it('seeks exactly, by asking YouTube to go there', () => {
    const player = aYouTubePlayer()
    const surface = youtubeSurface(player)

    surface.currentTime = 12.25

    expect(player.seekTo).toHaveBeenCalledWith(12.25, true)
  })

  /* There is no `seeked` event, and the player's seek gate waits for one. */
  it('says the seek landed, on the next turn rather than inside the write', async () => {
    const onSeeked = vi.fn()
    const surface = youtubeSurface(aYouTubePlayer(), { onSeeked })

    surface.currentTime = 12.25

    expect(onSeeked).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onSeeked).toHaveBeenCalledTimes(1)
  })

  /* YouTube's report trails a seek: straight after one it still says where
     the video was. Read as-is, a loop jumping back from B would see a time
     past B and jump again on every frame until the report caught up. */
  it('answers where it was sent until YouTube’s report catches up', () => {
    let reported = 40.02
    const surface = youtubeSurface(
      aYouTubePlayer({ getCurrentTime: () => reported }),
      { now: () => 0 },
    )

    surface.currentTime = 36

    expect(surface.currentTime).toBe(36)

    reported = 36.05

    expect(surface.currentTime).toBe(36.05)
  })

  it('stops waiting for the report after half a second', () => {
    let clock = 0
    const surface = youtubeSurface(
      aYouTubePlayer({ getCurrentTime: () => 40.02 }),
      { now: () => clock },
    )

    surface.currentTime = 36
    clock = 501

    expect(surface.currentTime).toBe(40.02)
  })

  it('is paused unless YouTube is playing or buffering to play', () => {
    const state = vi.fn(() => PAUSED)
    const surface = youtubeSurface(aYouTubePlayer({ getPlayerState: state }))

    expect(surface.paused).toBe(true)

    state.mockReturnValue(PLAYING)
    expect(surface.paused).toBe(false)

    state.mockReturnValue(BUFFERING)
    expect(surface.paused).toBe(false)
  })

  it('plays and pauses', async () => {
    const player = aYouTubePlayer()
    const surface = youtubeSurface(player)

    await surface.play()
    surface.pause()

    expect(player.playVideo).toHaveBeenCalledTimes(1)
    expect(player.pauseVideo).toHaveBeenCalledTimes(1)
  })

  it('takes its length from YouTube', () => {
    expect(youtubeSurface(aYouTubePlayer()).duration).toBe(712)
  })

  /* What YouTube is playing at, not what was asked: below 0.25 it clamps. */
  it('reports the rate YouTube is actually playing at', () => {
    const player = aYouTubePlayer({ getPlaybackRate: () => 0.25 })
    const surface = youtubeSurface(player)

    surface.playbackRate = 0.1

    expect(player.setPlaybackRate).toHaveBeenCalledWith(0.1)
    expect(surface.playbackRate).toBe(0.25)
  })

  it('mutes and unmutes', () => {
    const muted = vi.fn(() => false)
    const player = aYouTubePlayer({ isMuted: muted })
    const surface = youtubeSurface(player)

    surface.muted = true
    surface.muted = false

    expect(player.mute).toHaveBeenCalledTimes(1)
    expect(player.unMute).toHaveBeenCalledTimes(1)

    muted.mockReturnValue(true)
    expect(surface.muted).toBe(true)
  })
})
