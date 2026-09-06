import { nameFromFilename } from './fileClip'

/* Practice quality, and one setting for every clip — chosen by Thomas on
   2026-09-04 from the spike's comparison table, watching the output at 0.25x,
   which is the speed the player actually reaches. There is deliberately no
   picker and no per-clip override: the dancer never sees this. */
export const LONG_EDGE = 854
export const VIDEO_BITRATE = 1_400_000
export const AUDIO_BITRATE = 128_000

/* The output is always an mp4, whatever the container that came in, so the name
   says so. Only ever applied to bytes that were actually re-encoded — a clip
   uploaded untouched keeps the name the dancer picked, extension and all. */
export const mp4NameFor = (filename: string) =>
  `${nameFromFilename(filename)}.mp4`

export type SourceShape = {
  readonly width: number
  readonly height: number
}

/* A cap on the **long edge** rather than on the width, because clips come off a
   phone in portrait and nothing may assume that (UC-01 BR-16). One rule scales
   1080x1920 and 1920x1080 alike, and carries an odd aspect ratio through
   untouched. */
export const targetSizeFor = (
  { width, height }: SourceShape,
  longEdge: number,
): SourceShape => {
  /* Down, never up. Some H.264 profiles reject odd dimensions, so both edges
     have to land even — and rounding to the *nearest* even number would grow a
     641 px edge to 642, which is a one-pixel upscale on a clip the cap was
     never going to touch. The spike rounded; flooring is what makes "never
     upscaled" true as written rather than nearly. Two is the floor because
     nothing can encode a zero-width frame. */
  const even = (edge: number) => Math.max(2, Math.floor(edge / 2) * 2)

  const long = Math.max(width, height)

  /* Already inside the cap, so only the bitrate does any work — which is also
     the "it is an mp4 already, it just needs bringing down" case. */
  if (long <= longEdge) return { width: even(width), height: even(height) }

  const scale = longEdge / long

  return { width: even(width * scale), height: even(height * scale) }
}

export type EncodeTarget = SourceShape & {
  readonly videoBitrate: number
  /* Null where the source has no audio track to re-encode. Asking for one that
     does not exist is how a silent clip fails. */
  readonly audioBitrate: number | null
}

/* The seam, and the only browser-only part of this. WebCodecs does not exist in
   jsdom, so a compressor that reached for it directly would be one no test could
   drive — the same reason `ProbeHost` exists, and the same shape. Everything
   that can be decided without a codec is decided above this line. */
export type EncodeHost = {
  readonly inspect: (
    file: File,
  ) => Promise<SourceShape & { readonly hasAudio: boolean }>
  readonly encode: (file: File, target: EncodeTarget) => Promise<Blob>
}

/* Never rejects. Whatever goes in, a `File` worth uploading comes out. */
export type ClipCompressor = (file: File) => Promise<File>

export const compressor =
  (host: EncodeHost): ClipCompressor =>
  async (file) => {
    try {
      const source = await host.inspect(file)

      const encoded = await host.encode(file, {
        ...targetSizeFor(source, LONG_EDGE),
        videoBitrate: VIDEO_BITRATE,
        audioBitrate: source.hasAudio ? AUDIO_BITRATE : null,
      })

      /* The stored file is never the worse of the two. A clip that is already
         near the floor encodes *up*, and when it does the honest answer is the
         one the dancer picked. */
      if (encoded.size >= file.size) return file

      return new File([encoded], mp4NameFor(file.name), {
        type: 'video/mp4',
        lastModified: file.lastModified,
      })
    } catch {
      /* A catch rather than a probe, decided at the approval gate. The failure
         worth naming is iOS Safari 16.4-18.7 — VideoEncoder present,
         AudioEncoder absent, so any clip whose audio starts off the video dies
         partway through — but a probe for that would only decide what this
         decides, and would still not cover the failures nobody has seen. The
         clip goes up uncompressed and the add succeeds; it costs Drive quota,
         not correctness. */
      return file
    }
  }
