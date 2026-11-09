import { useEffect, useRef } from 'react'

import type { PlaybackSurface } from './playbackSurface'
import type { MountYouTube } from './youtubeMount'
import type { YouTubePlayer } from './youtubeSurface'
import { youtubeSurface } from './youtubeSurface'

/* How long to wait between asks for a length YouTube has not got yet. */
const LENGTH_POLL = 200

/* #20. YouTube's player where the <video> would be, handing the player a
   surface (`youtubeSurface`) once it has a length to give — which on a cued
   video can trail `onReady` by a moment.

   Sized for 16:9, which is what YouTube serves even for a portrait upload — it
   letterboxes inside its own frame — and capped by width and by height the way
   the <video> is, so a phone in portrait keeps room for the controls. */
export function YouTubeFrame({
  videoId,
  mount,
  isolated,
  onReady,
  onState,
  onRate,
  onError,
  onSeeked,
}: {
  readonly videoId: string
  readonly mount: MountYouTube
  readonly isolated: boolean
  readonly onReady: (surface: PlaybackSurface) => void
  readonly onState: (state: number) => void
  readonly onRate: (rate: number) => void
  readonly onError: (code: number) => void
  readonly onSeeked: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  /* The player is made once per video; the handlers change every render, so
     it reaches the current ones through here rather than closing over the
     first. */
  const handlers = useRef({ onReady, onState, onRate, onError, onSeeked })

  useEffect(() => {
    handlers.current = { onReady, onState, onRate, onError, onSeeked }
  })

  useEffect(() => {
    const element = host.current

    if (!element) return

    let alive = true
    let player: YouTubePlayer | undefined
    let waiting: ReturnType<typeof setTimeout> | undefined

    const whenItHasALength = () => {
      if (!alive) return

      if (!player || player.getDuration() <= 0) {
        waiting = setTimeout(whenItHasALength, LENGTH_POLL)
        return
      }

      handlers.current.onReady(
        youtubeSurface(player, { onSeeked: () => handlers.current.onSeeked() }),
      )
    }

    void mount(element, videoId, {
      onReady: whenItHasALength,
      onStateChange: (state) => {
        if (alive) handlers.current.onState(state)
      },
      onPlaybackRateChange: (rate) => {
        if (alive) handlers.current.onRate(rate)
      },
      onError: (code) => {
        if (alive) handlers.current.onError(code)
      },
    }).then((made) => {
      player = made
      if (!alive) made.destroy()
    })

    return () => {
      alive = false
      clearTimeout(waiting)
      player?.destroy()
    }
  }, [mount, videoId])

  return (
    <div
      ref={host}
      className={isolated ? 'aspect-video' : 'aspect-video overflow-hidden rounded-lg bg-black'}
      style={{
        width: isolated
          ? 'min(100vw, 100dvh * 16 / 9)'
          : 'min(100vw - 4rem, 1100px, 55vh * 16 / 9)',
      }}
    />
  )
}
