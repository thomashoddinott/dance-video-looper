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
export const playable = (
  video: HTMLVideoElement,
  { seconds }: { readonly seconds: number },
) => {
  let paused = true
  let currentTime = 0

  Object.defineProperty(video, 'duration', {
    value: seconds,
    configurable: true,
  })

  /* jsdom implements no seeking either: `currentTime` reads 0 forever and writing
     it does nothing, so a test could neither move the playhead nor watch anything
     move it back. A real element would fire `seeked` and `timeupdate` off this;
     nothing reads those, so it stays a plain readable-writable position — which is
     all the loop and START need it to be. */
  Object.defineProperty(video, 'currentTime', {
    get: () => currentTime,
    set: (position: number) => {
      currentTime = position
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
