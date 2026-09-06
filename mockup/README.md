# Mockup

Throwaway UI mockup for the looper — vibe-coded, local only, never deployed. It
exists to be walked through so a use case can be derived from it. Don't build the
product on it.

```sh
npm install
npm run dev
```

**It needs a clip to load.** The mockup plays `public/sample.mp4`, which is not in
the repo — `mockup/public/*.mp4` is gitignored because the sample is someone
else's content. Drop any short clip in at that path and it will play; the layout
sizes itself to whatever aspect ratio it gets.

What's here: A/B loop points you drag on the timeline, playback speed, and a list
of saved loops. Loops are held in React state only — nothing persists, and there
is no Google Drive integration. That comes later, in the product proper.
