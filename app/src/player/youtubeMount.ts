import type { YouTubePlayer } from './youtubeSurface'

/* What YouTube tells the page about its player. */
export type YouTubeEvents = {
  readonly onReady: () => void
  readonly onStateChange: (state: number) => void
  readonly onPlaybackRateChange: (rate: number) => void
  readonly onError: (code: number) => void
}

/* Puts YouTube's player for one video into an element, a seam for the reason
   `DriveHost` is one: jsdom cannot run the IFrame API, and a test has to be
   able to say when YouTube is ready, playing or refusing. */
export type MountYouTube = (
  host: HTMLElement,
  videoId: string,
  events: YouTubeEvents,
) => Promise<YouTubePlayer>

type YouTubeNamespace = {
  readonly Player: new (element: HTMLElement, options: unknown) => YouTubePlayer
}

type WithYouTube = {
  YT?: YouTubeNamespace
  onYouTubeIframeAPIReady?: () => void
}

let api: Promise<YouTubeNamespace> | undefined

/* One script tag for the whole app, however many times a video is opened. The
   API announces itself through a global callback, so any callback already
   there is kept and called first. */
const loadApi = () => {
  api ??= new Promise((resolve) => {
    const page = window as unknown as WithYouTube

    if (page.YT?.Player) {
      resolve(page.YT)
      return
    }

    const previous = page.onYouTubeIframeAPIReady

    page.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (page.YT) resolve(page.YT)
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })

  return api
}

/* YouTube's own controls off, because the player below is the control
   surface; its keyboard off, because the page's shortcuts are the point; and
   inline on iOS, so the first play does not take the video fullscreen. */
export const browserMountYouTube: MountYouTube = async (host, videoId, events) => {
  const YT = await loadApi()
  const element = document.createElement('div')

  host.replaceChildren(element)

  return new YT.Player(element, {
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
      onReady: () => events.onReady(),
      onStateChange: (event: { data: number }) => events.onStateChange(event.data),
      onPlaybackRateChange: (event: { data: number }) =>
        events.onPlaybackRateChange(event.data),
      onError: (event: { data: number }) => events.onError(event.data),
    },
  })
}
