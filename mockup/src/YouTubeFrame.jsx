import { useEffect, useRef } from 'react'
import { loadYouTubeApi, youtubeSurface } from './youtube.js'

/* #20 spike. The YouTube IFrame player where the <video> would be, reporting
   to the player through the same surface a <video> offers (`youtubeSurface`).

   No YouTube controls (`controls: 0`) because the player below is the control
   surface, and no keyboard handling inside the iframe (`disablekb`) because the
   page's own shortcuts are the point. `playsinline` keeps iOS from taking the
   clip fullscreen on first play.

   Sized for 16:9, which is what YouTube serves even for a portrait upload — it
   letterboxes inside its own frame. Capped by width and by height, the way the
   <video> is, so a phone in portrait still has room for the controls. */
export default function YouTubeFrame({
  videoId,
  zen,
  onReady,
  onState,
  onRate,
  onError,
  onSeeked,
}) {
  const host = useRef(null)
  /* The player is built once per video; the handlers it calls change every
     render, so it reaches them through here rather than closing over stale ones. */
  const handlers = useRef({})

  useEffect(() => {
    handlers.current = { onReady, onState, onRate, onError, onSeeked }
  })

  useEffect(() => {
    let player
    let cancelled = false

    loadYouTubeApi().then((YT) => {
      if (cancelled || !host.current) return

      const mount = document.createElement('div')
      host.current.replaceChildren(mount)

      player = new YT.Player(mount, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          playsinline: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            const surface = youtubeSurface(player, {
              onSeeked: () => handlers.current.onSeeked?.(),
            })
            /* The length can lag `onReady` by a moment on a cued video. */
            const whenKnown = () => {
              if (cancelled) return
              if (player.getDuration() > 0) handlers.current.onReady(surface)
              else setTimeout(whenKnown, 200)
            }
            whenKnown()
          },
          onStateChange: (event) => handlers.current.onState?.(event.data),
          onPlaybackRateChange: (event) => handlers.current.onRate?.(event.data),
          onError: (event) => handlers.current.onError?.(event.data),
        },
      })
    })

    return () => {
      cancelled = true
      player?.destroy()
    }
  }, [videoId])

  return (
    <div
      ref={host}
      className={zen ? 'aspect-video' : 'aspect-video overflow-hidden rounded-lg bg-black'}
      style={{
        width: zen
          ? 'min(100vw, 100dvh * 16 / 9)'
          : 'min(100vw - 4rem, 1100px, 55vh * 16 / 9)',
      }}
    />
  )
}
