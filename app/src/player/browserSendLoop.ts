import type { SendLoop } from './loopShare'

/* Loaded on the first send and not before, for `mediabunnyHost`'s reason: a
   dancer opening the app to watch a loop should never pay for an encoder. */
const mediabunny = () => import('mediabunny')

/* The browser's half of `SendLoop`, and the part no test drives: WebCodecs,
   the share sheet and the clipboard do not exist in jsdom. Checked in Chrome
   instead, against a real MP4 (#123). */
export const browserSendLoop: SendLoop = {
  cut: async (src, { a, b }) => {
    const {
      ALL_FORMATS,
      BlobSource,
      BufferTarget,
      Conversion,
      Input,
      Mp4OutputFormat,
      Output,
      QUALITY_HIGH,
    } = await mediabunny()

    const bytes = await (await fetch(src)).blob()
    const input = new Input({ source: new BlobSource(bytes), formats: ALL_FORMATS })
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    })

    const conversion = await Conversion.init({
      input,
      output,
      trim: { start: a, end: b },
      /* Re-encoded rather than copied, so the cut starts on A and not on the
         keyframe before it, which on phone footage can be seconds earlier.
         H.264, which every phone plays. */
      video: { codec: 'avc', bitrate: QUALITY_HIGH, forceTranscode: true },
      /* AAC, which WhatsApp plays; a phone's own recording already is. */
      audio: { codec: 'aac', bitrate: QUALITY_HIGH },
      /* None of the clip's metadata comes with it: a phone video carries
         where it was filmed, and the copy sent to a friend need not. */
      tags: {},
      showWarnings: false,
    })

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((entry) => `${entry.track.type}: ${entry.reason}`)
        .join('; ')

      throw new Error(`this loop could not be cut — ${reasons}`)
    }

    await conversion.execute()

    const { buffer } = output.target

    if (buffer === null) throw new Error('the cut produced no bytes')

    return new Blob([buffer], { type: 'video/mp4' })
  },

  hand: async (file, phone) => {
    if (phone && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: file.name })

        return 'sent'
      } catch (error) {
        /* The dancer closed the sheet: nothing went wrong, and nothing more
           to do. */
        if (error instanceof DOMException && error.name === 'AbortError') return 'sent'
        /* The tap that asked for it was too long ago by the time the cut was
           done. The next tap shares it at once. */
        if (error instanceof DOMException && error.name === 'NotAllowedError') return 'held'

        throw error
      }
    }

    /* A download, which a phone without a share sheet for files can do too */
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')

    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)

    return 'sent'
  },

  link: async (url, title, phone) => {
    if (phone && 'share' in navigator) {
      try {
        await navigator.share({ url, title })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) throw error
      }

      return
    }

    await navigator.clipboard.writeText(url)
  },
}
