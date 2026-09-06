import type { EncodeHost } from './clipCompressor'
import { compressor } from './clipCompressor'

/* Loaded when a clip is added and not before. Mediabunny carries a demuxer, a
   muxer and the WebCodecs wrappers, and none of it is wanted on the way to a
   first paint — the dancer opening the app to watch a loop they already have
   should never pay for an encoder they are not using.

   It is also what keeps this module importable under jsdom: the tests above
   this seam load it for its types and never call it, so nothing here has to
   exist in a test environment. */
const mediabunny = () => import('mediabunny')

/* The edge of the seam, and the one part of this story no test drives — the
   same waiver `browserProbeHost` carries, for the same reason: WebCodecs does
   not exist in jsdom. Everything that could be decided without a codec was
   pushed above this line, so what is left is the conversion itself. Carried
   from the spike's `compress.js`, which is the version that has actually run
   against real footage. */
export const browserEncodeHost: EncodeHost = {
  inspect: async (file) => {
    const { ALL_FORMATS, BlobSource, Input } = await mediabunny()

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    })

    const [video, audio] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ])

    /* Nothing to compress. The clip probe would already have refused this file,
       so reaching here means something stranger — either way, throwing puts it
       on the uncompressed path rather than inventing a frame size. */
    if (!video) throw new Error('that file has no video track to compress')

    return {
      /* The *display* dimensions, which is what the dancer sees. A clip with
         rotation metadata has stored dimensions that disagree, and scaling by
         those would turn a portrait clip on its side. */
      width: video.displayWidth,
      height: video.displayHeight,
      hasAudio: audio !== null,
    }
  },

  encode: async (file, { width, height, videoBitrate, audioBitrate }) => {
    const {
      ALL_FORMATS,
      BlobSource,
      BufferTarget,
      Conversion,
      Input,
      Mp4OutputFormat,
      Output,
    } = await mediabunny()

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    })
    const output = new Output({
      format: new Mp4OutputFormat(),
      target: new BufferTarget(),
    })

    const conversion = await Conversion.init({
      input,
      output,
      video: {
        width,
        height,
        /* The dimensions already preserve the source's aspect ratio, so there
           is no fitting left to do. `contain` is named because Mediabunny
           requires a fit once both edges are given, and of the three it is the
           only one that can neither crop the dancer out of frame nor stretch
           them (BR-16). */
        fit: 'contain',
        /* H.264 whatever came in, which is what makes "always an mp4 that
           plays" true in practice rather than only in the container. The spike
           decoded HEVC off an iPhone this way with no special handling. */
        codec: 'avc',
        bitrate: videoBitrate,
        /* Without this a clip already at the target size is *copied* rather
           than re-encoded, and the run reports a spectacular speed having
           compressed nothing at all. It is also what makes the "it is an mp4
           already, it just needs its bitrate brought down" case work. */
        forceTranscode: true,
      },
      audio: audioBitrate === null ? {} : { codec: 'aac', bitrate: audioBitrate },
      showWarnings: false,
    })

    if (!conversion.isValid) {
      const reasons = conversion.discardedTracks
        .map((entry) => `${entry.track.type}: ${entry.reason}`)
        .join('; ')

      throw new Error(`this clip could not be converted — ${reasons}`)
    }

    await conversion.execute()

    const { buffer } = output.target

    if (buffer === null) throw new Error('the conversion produced no bytes')

    return new Blob([buffer], { type: 'video/mp4' })
  },
}

export const browserClipCompressor = compressor(browserEncodeHost)
