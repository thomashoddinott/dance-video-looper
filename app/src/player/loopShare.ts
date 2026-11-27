import type { Loop } from './playback'

/* #123. Sending a loop to a friend. A clip from Drive is cut to its own MP4,
   A to B, from the bytes the app already holds; a YouTube entry, which the
   app never holds, goes as a link that opens it at A.

   What only a browser can do sits behind `SendLoop`: the cut, which needs
   WebCodecs, and handing a file or a link on, which needs the share sheet, a
   download or the clipboard. The app gets the browser's; a test gets a
   stand-in. */
export type SendLoop = {
  /* The clip at `src`, cut to the loop */
  readonly cut: (src: string, span: Loop) => Promise<Blob>
  /* The cut handed on: the share sheet on a phone, a download otherwise.
     `held` when the browser would only share it after a fresh tap, the cut
     having outlasted the one that asked for it. */
  readonly hand: (file: File, phone: boolean) => Promise<'sent' | 'held'>
  /* A link handed on: the share sheet on a phone, the clipboard otherwise */
  readonly link: (url: string, title: string, phone: boolean) => Promise<void>
}

/* youtu.be with `t` opens a Short in the ordinary player, which is the only
   one that takes a start. A link cannot say where to stop. */
export const linkFromA = (videoId: string, a: number) =>
  `https://youtu.be/${videoId}?t=${Math.floor(a)}`

/* The characters one system or another will not have in a file name */
const REFUSED = /[/\\:*?"<>|]/g

const safe = (name: string) =>
  name
    .replace(REFUSED, '-')
    .replace(/\s+/g, ' ')
    .trim()

export const loopFileName = (clipName: string, loopName: string) =>
  `${safe(clipName)} – ${safe(loopName)}.mp4`
