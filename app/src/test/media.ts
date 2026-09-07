/* jsdom ships no media stack: a video element's duration is always NaN whatever
   file it was pointed at, play() and pause() are unimplemented, and paused never
   moves. So a test that wants a clip which decodes and plays has to say so — and
   one that wants a clip which does not can leave this alone, because jsdom's
   default *is* the failure.

   Standing up an element that behaves as a browser's does, rather than spying on
   play(), is what lets the assertions stay on the outcome: the video is playing.
   A spy would pin the implementation, and would say nothing about a clip that
   stopped for a reason the app never caused.

   `paused` moves on the *events* rather than in the methods, because that is how
   a real element works — the property and the events cannot disagree, and a test
   can stop playback the way the outside world does, by firing pause. It is the
   one piece of mutable state here, and it is mutable because the thing being
   stood in for is. */
/* What a test needs to reach about a clip's seeking that the element itself does
   not expose: whether its seeks are landing yet, and every position written to it
   so far. Held beside the element rather than on it, so the double keeps a real
   element's public shape and nothing under test can read it by accident. */
type Seeking = {
  held: boolean
  readonly writes: number[]
}

const seeking = new WeakMap<HTMLVideoElement, Seeking>()

const controlFor = (video: HTMLVideoElement) => {
  const control = seeking.get(video)

  if (!control) throw new Error('That clip surface was never made playable')

  return control
}

export const playable = (
  video: HTMLVideoElement,
  { seconds }: { readonly seconds: number },
) => {
  let paused = true
  let currentTime = 0
  const control: Seeking = { held: false, writes: [] }

  seeking.set(video, control)

  Object.defineProperty(video, 'duration', {
    value: seconds,
    configurable: true,
  })

  /* jsdom implements no seeking either: `currentTime` reads 0 forever and writing
     it does nothing, so a test could neither move the playhead nor watch anything
     move it back.

     It fires `seeked` off a write because a real element does, and because the
     scrub gate reads it — a seek is only over when the element says so, and a
     double that never said so would leave the gate wedged shut in every test
     while working perfectly in a browser. That is the exact shape of bug this
     file exists to keep out.

     Landing immediately is the fast case, not the only one. `holdSeeks` below is
     how a test gets the slow one, which is where the gate does its work. */
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (position: number) => {
      currentTime = position
      control.writes.push(position)

      if (!control.held) video.dispatchEvent(new Event('seeked'))
    },
    configurable: true,
  })

  Object.defineProperty(video, 'paused', {
    get: () => paused,
    configurable: true,
  })

  video.addEventListener('play', () => {
    paused = false
  })

  video.addEventListener('pause', () => {
    paused = true
  })

  video.play = async () => {
    video.dispatchEvent(new Event('play'))
  }

  video.pause = () => {
    video.dispatchEvent(new Event('pause'))
  }

  return video
}

/* A clip whose seeks are in flight and have not landed. The mockup gate measured
   a median of 49 ms for one on a buffered clip, against a pointer stream arriving
   every few milliseconds — so this, not the instant landing above, is what a drag
   actually meets, and it is the only condition under which the gate does anything
   at all.

   Returns the lander: calling it announces that the outstanding seek arrived, the
   way the element would. */
export const holdSeeks = (video: HTMLVideoElement) => {
  const control = controlFor(video)

  control.held = true

  return () => {
    control.held = false
    video.dispatchEvent(new Event('seeked'))
  }
}

/* Every position written to the element, in order. What a test needs to say that
   the positions between the first and the newest were never issued — an assertion
   the element's final `currentTime` cannot make, because a queue and a gate agree
   about where the drag ended and disagree about everything on the way. */
export const seeksSeen = (video: HTMLVideoElement) => [...controlFor(video).writes]

/* A clip reaching its own end, in the order a browser does it: the element stops
   *first* and `ended` announces it afterwards — the state change precedes the
   event, so every listener already sees a paused clip.

   Ordering is the whole point of having this rather than a bare
   `fireEvent.ended`. `ended` does not bubble, so React attaches its handler
   straight to the element and gets there before anything `playable` could
   register; a stub that set `paused` from its own listener would run *after* the
   app had already restarted the clip and would quietly undo it.

   The one liberty taken is the `pause` event: a real element sets `paused`
   without firing one. Dispatching it is what lets this be modelled from outside
   the element at all, and it lands on the same state a moment earlier. */
export const runsOut = (video: HTMLVideoElement) => {
  video.pause()
  video.dispatchEvent(new Event('ended'))
}
