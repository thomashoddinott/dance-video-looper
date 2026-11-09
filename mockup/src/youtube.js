/* #20 spike: everything the mockup needs to treat a YouTube video as a clip,
   without downloading it. Nothing here touches a backend or an API key. */

/* The id is all that is kept. A link as shared from a playlist carries `list`
   and `index` too (the example does), and those are about where the dancer
   found the video, not which video it is — so they are dropped. */
export function videoIdFrom(link) {
  let url

  try {
    url = new URL(link.trim())
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '')
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? url.searchParams.get('v') ??
          url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1]
        : null

  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
}

export const thumbnailFor = (videoId) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`

/* Title and thumbnail, from the oEmbed endpoint: CORS-open, no key. It answers
   401 for a video whose uploader has turned embedding off, which is the one
   refusal worth telling apart — that video can never play here. It knows
   nothing about the length; that arrives when the player first loads it. */
export async function lookUp(videoId) {
  const watch = `https://www.youtube.com/watch?v=${videoId}`
  const response = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
  )

  if (response.status === 401 || response.status === 403) return { refused: 'embed' }
  if (!response.ok) return { refused: 'missing' }

  const { title, author_name: channel } = await response.json()

  return { title, channel }
}

let api

/* One script tag for the whole page, however many players ask. */
export function loadYouTubeApi() {
  api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)

    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT)
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })

  return api
}

const PLAYING = 1
const BUFFERING = 3

/* The playback port, prototyped: the slice of HTMLVideoElement the player
   already drives, answered by the IFrame API instead. The player keeps a ref to
   "whatever the clip is playing in" and never learns which one it got.

   `currentTime` is the one that does not translate cleanly. `getCurrentTime()`
   reads a value the iframe posts across every so often rather than the
   decoder's own clock, so straight after a seek it still reports where the
   video *was* — and the loop tick, seeing a time past B, would seek again on
   every frame until the report caught up. So a seek is remembered and stands
   in for the reported time until the report agrees with it, or half a second
   passes. */
export function youtubeSurface(player, { onSeeked } = {}) {
  let seekedTo = null
  let seekedAt = 0

  return {
    get currentTime() {
      const reported = player.getCurrentTime()

      if (seekedTo === null) return reported

      const settled =
        Math.abs(reported - seekedTo) < 0.35 || performance.now() - seekedAt > 500

      if (settled) {
        seekedTo = null
        return reported
      }

      return seekedTo
    },
    set currentTime(seconds) {
      seekedTo = seconds
      seekedAt = performance.now()
      player.seekTo(seconds, true)
      /* There is no `seeked` event to wait for. The player's seek gate wants
         one, so it gets it on the next tick. */
      setTimeout(() => onSeeked?.(), 0)
    },
    get duration() {
      return player.getDuration()
    },
    get paused() {
      const state = player.getPlayerState()
      return state !== PLAYING && state !== BUFFERING
    },
    play() {
      player.playVideo()
      return Promise.resolve()
    },
    pause() {
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
    player,
  }
}

/* What the IFrame API's error codes mean to a dancer. */
export const ERRORS = {
  2: 'That link does not name a video.',
  5: 'This video will not play in an embedded player.',
  100: 'This video is private or has been removed.',
  101: 'The uploader does not allow this video to be played outside YouTube.',
  150: 'The uploader does not allow this video to be played outside YouTube.',
  153: 'YouTube refused the embed because the page sent no referrer.',
}
