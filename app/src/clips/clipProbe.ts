/* One reason, not several. A decode error, a length that is not a number and a
   file that never answers are the same fact to the dancer — this did not yield
   a video — and nothing acts on the difference. `DriveStatus` keeps a refusal
   apart from a withdrawal because the dancer *can* act on that; the same test
   applied here says one. */
export type ProbeResult =
  | { readonly ok: true; readonly seconds: number; readonly src: string }
  | { readonly ok: false }

export type ClipProbe = (file: File) => Promise<ProbeResult>

/* The seam. Neither of the two browser APIs this needs exists in jsdom —
   nothing decodes, `duration` is a read-only NaN, and `URL.createObjectURL` is
   absent entirely — so a probe that reached for them directly would be a probe
   no test could drive. Passed in rather than read off globals, as
   `browserTokenSource` already does for Google's SDK. */
export type ProbeHost = {
  readonly createProbe: () => HTMLVideoElement
  readonly toUrl: (file: File) => string
  readonly releaseUrl: (url: string) => void
}

/* The spike's figure (`playback.js`), and it is a ceiling rather than a wait:
   a local file answers in milliseconds or not at all. */
const EIGHT_SECONDS = 8000

export const clipProbe =
  (host: ProbeHost, timeoutMs: number = EIGHT_SECONDS): ClipProbe =>
  (file) =>
    new Promise<ProbeResult>((resolve) => {
      const src = host.toUrl(file)
      const probe = host.createProbe()

      /* Releasing here is what keeps a failed add from leaking: the url is
         only worth holding when it turned out to be a clip. */
      const abandon = () => {
        host.releaseUrl(src)
        resolve({ ok: false })
      }

      /* The mockup has no equivalent, which is why a file that answers with
         neither metadata nor an error hangs it forever in silence. */
      const timer = setTimeout(abandon, timeoutMs)

      probe.addEventListener(
        'loadedmetadata',
        () => {
          clearTimeout(timer)

          const seconds = probe.duration

          if (!Number.isFinite(seconds) || seconds <= 0) return abandon()

          resolve({ ok: true, seconds, src })
        },
        { once: true },
      )

      probe.addEventListener(
        'error',
        () => {
          clearTimeout(timer)
          abandon()
        },
        { once: true },
      )

      /* Metadata is all this needs — the length and nothing else. Loading the
         whole clip to find out how long it is would cost the dancer a download
         before the tile even appears. */
      probe.preload = 'metadata'
      probe.src = src
    })

/* The one part of this no test can drive, and pushing it to the edge is the
   point of the seam: jsdom has neither a decoder nor `URL.createObjectURL`, so
   everything above is testable precisely because these three lines are not. */
export const browserProbeHost: ProbeHost = {
  createProbe: () => document.createElement('video'),
  toUrl: (file) => URL.createObjectURL(file),
  releaseUrl: (url) => {
    URL.revokeObjectURL(url)
  },
}

export const browserClipProbe = clipProbe(browserProbeHost)
