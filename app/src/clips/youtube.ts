/* #20. YouTube's own picture of a video, which it serves for every public one.
   `mqdefault` is the 16:9 one with no letterbox bars, so it crops into a tile
   the way a clip's frame does. Served with `access-control-allow-origin: *`,
   so its bytes could be kept in Drive for an offline grid later. */
export const thumbnailFor = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
