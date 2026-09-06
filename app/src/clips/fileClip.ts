/* Only the last dot separates an extension. Clips are named by hand and by
   download tools, so a dot mid-name is ordinary rather than an edge case. */
export const nameFromFilename = (filename: string) =>
  filename.replace(/\.[^.]+$/, '')

const slugged = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/* Name, size and last-modified together. All three come free off the File, none
   costs a read of the bytes, and three-way collision between two genuinely
   different clips is vanishingly unlikely — where name and size alone collide
   often enough to matter.

   This doubles as the clip's id, so it must survive a URL: `ClipTile` puts it
   straight into a path. */
export const clipIdFor = (file: File) =>
  `added-${slugged(nameFromFilename(file.name))}-${file.size}-${file.lastModified}`
