/* #20, #92. YouTube's own pictures of a video, sharpest first. Both are 16:9
   with no letterbox bars, so they crop into a tile the way a clip's frame does;
   a Short's is the portrait video centred on a blur, so the tile's centre crop
   is the Short itself. Served with `access-control-allow-origin: *`, so their
   bytes could be kept in Drive for an offline grid later.

   `hq720` (1280×720) fills a portrait tile's height at a phone's 2x without
   stretching; `mqdefault` (320×180) is there for a video YouTube has no
   larger picture of, and was all a tile had before #92. */
export const thumbnailsFor = (videoId: string) =>
  [
    `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
  ] as const

/* What YouTube answers for a picture it does not have: a 120×90 placeholder
   with a 404, which a browser draws rather than reporting an error. Nothing
   real is this narrow. */
export const NO_SUCH_PICTURE_WIDTH = 120

/* The id a YouTube entry is known by in the library and in `loops.json`:
   namespaced, so it can never collide with a clip's. */
export const youTubeIdFor = (videoId: string) => `yt:${videoId}`

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

/* The one video a link names, from any form a share sheet or an address bar
   hands over: a watch link, a short `youtu.be` one, the phone site, Shorts.
   Only the id is kept. A link shared from a playlist carries `list` and
   `index` too, and those are where the dancer found the video, not which video
   it is. Null for anything that is not a YouTube link to one video. */
export const videoIdFrom = (link: string): string | null => {
  let url: URL

  try {
    url = new URL(link.trim())
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '')
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host === 'youtube.com'
        ? (url.searchParams.get('v') ??
          /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1])
        : undefined

  return id !== undefined && VIDEO_ID.test(id) ? id : null
}

/* The slice of `fetch` a lookup needs, for `FetchLike`'s reason. */
export type LookUpFetch = (url: string) => Promise<{
  readonly ok: boolean
  readonly status: number
  readonly json: () => Promise<unknown>
}>

export type YouTubeLookUp =
  | { readonly found: true; readonly title: string }
  | {
      readonly found: false
      readonly because: 'embedding-refused' | 'missing' | 'unreachable'
    }

/* A video's title, from YouTube's oEmbed endpoint: CORS-open and keyless, so
   a static page can ask it and the no-backend rule holds. It answers 401 for a
   video whose uploader has turned embedding off — the refusal worth telling
   apart, because that video can never play here. It does not know a video's
   length; that arrives when the player first loads it. */
export const lookUpYouTube = async (
  videoId: string,
  fetchFrom: LookUpFetch = (url) => fetch(url),
): Promise<YouTubeLookUp> => {
  const watch = `https://www.youtube.com/watch?v=${videoId}`

  try {
    const answer = await fetchFrom(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
    )

    if (answer.status === 401 || answer.status === 403) {
      return { found: false, because: 'embedding-refused' }
    }

    if (!answer.ok) return { found: false, because: 'missing' }

    const body = (await answer.json()) as { readonly title?: unknown }

    return typeof body.title === 'string'
      ? { found: true, title: body.title }
      : { found: false, because: 'missing' }
  } catch {
    return { found: false, because: 'unreachable' }
  }
}

export type VideoShape = 'landscape' | 'portrait'

export type ShapeYouTube = (videoId: string) => Promise<VideoShape>

/* #90. Which way a video faces, which YouTube's player will not say: it fits a
   Short inside whatever frame it is given, so a 16:9 frame plays one as a strip
   with black either side. oEmbed tells, but only when asked with the Shorts
   form of the link — a Short answers 113×200 and any other video 200×113,
   where the watch form answers 200×113 for every video.

   Anything short of a clear answer is landscape, the shape the frame always
   had, so a lookup that fails changes nothing. */
export const shapeOfYouTube = async (
  videoId: string,
  fetchFrom: LookUpFetch = (url) => fetch(url),
): Promise<VideoShape> => {
  const short = `https://www.youtube.com/shorts/${videoId}`

  try {
    const answer = await fetchFrom(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(short)}&format=json`,
    )

    if (!answer.ok) return 'landscape'

    const { width, height } = (await answer.json()) as {
      readonly width?: unknown
      readonly height?: unknown
    }

    return typeof width === 'number' && typeof height === 'number' && height > width
      ? 'portrait'
      : 'landscape'
  } catch {
    return 'landscape'
  }
}
