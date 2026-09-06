import { describe, expect, it } from 'vitest'

import type { DriveFile } from './driveClips'
import { clipFromDriveFile, isClipFile } from './driveClips'

/* What Drive hands back for a file the app uploaded. `appProperties` is ours —
   everything else is Drive's own, and Drive has no field for a video's length. */
const aDriveFile = (overrides: Partial<DriveFile> = {}): DriveFile => ({
  id: '1c0JePvIVQayCo5nR2xxwZBgHRXCxdxwZ',
  name: 'Shuffle drill.mp4',
  mimeType: 'video/mp4',
  createdTime: '2026-08-28T09:14:22.000Z',
  appProperties: { clipId: 'added-shuffle-drill-9784045-1756', seconds: '27' },
  md5Checksum: '2f8a9c4e1b7d3055a6f0e9c8b1d4a7e2',
  ...overrides,
})

describe('reading a clip off a file stored in Drive', () => {
  it('identifies the clip by the file it came from, not by Drive', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.id).toBe('added-shuffle-drill-9784045-1756')
  })

  it('keeps Drive’s own id, which is what the bytes are fetched by', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.driveId).toBe('1c0JePvIVQayCo5nR2xxwZBgHRXCxdxwZ')
  })

  it('reads the length the upload stored, since Drive has no field for it', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.seconds).toBe(27)
  })

  it('takes the added date off the day Drive created the file', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.added).toBe('2026-08-28')
  })

  it('strips the extension the file still carries in Drive', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.name).toBe('Shuffle drill')
  })

  it('carries no source, because the bytes have not been fetched yet', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.src).toBeUndefined()
  })

  /* A length that is unknown rather than never asked for — which is exactly the
     distinction `Clip.seconds` was made optional for. */
  it('leaves the length unknown when the file carries none', () => {
    const clip = clipFromDriveFile(aDriveFile({ appProperties: undefined }))

    expect(clip.seconds).toBeUndefined()
  })

  it('leaves the length unknown when what was stored is not a number', () => {
    const clip = clipFromDriveFile(
      aDriveFile({ appProperties: { seconds: 'a while' } }),
    )

    expect(clip.seconds).toBeUndefined()
  })

  /* The mapping has to be total. A file uploaded by an older build carries no
     clip id, and dropping it from the library would be a clip the dancer can
     see in Drive and not in the app. */
  it('falls back to Drive’s id for a file that carries no clip id', () => {
    const clip = clipFromDriveFile(aDriveFile({ appProperties: {} }))

    expect(clip.id).toBe('1c0JePvIVQayCo5nR2xxwZBgHRXCxdxwZ')
  })

  /* Drive's own checksum of the bytes. It is what lets a cached copy be told
     apart from the copy in Drive without downloading either one (US-01-16), and
     it rides a listing the library already makes. */
  it('carries Drive’s checksum of the bytes', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.checksum).toBe('2f8a9c4e1b7d3055a6f0e9c8b1d4a7e2')
  })

  /* Unknown, not stale. Drive omits the checksum for some files, and a cache
     that treated "no checksum" as "changed" would re-download a good copy on
     every open — the exact cost this story exists to remove. */
  it('leaves the checksum unknown when Drive names none', () => {
    const clip = clipFromDriveFile(aDriveFile({ md5Checksum: undefined }))

    expect(clip.checksum).toBeUndefined()
  })

  it('counts no loops, which are not this story’s to read', () => {
    const clip = clipFromDriveFile(aDriveFile())

    expect(clip.loops).toBe(0)
  })
})

/* The folder holds more than clips, and always has — `loops.json` has lived
   beside them since US-01-15. Under `drive.file` everything in it is something
   this app put there, which is what makes the question answerable at all. */
describe('telling a clip from the other files the app keeps beside it', () => {
  it('reads a video as a clip', () => {
    expect(isClipFile(aDriveFile())).toBe(true)
  })

  /* #79. It is one file, re-found by name every session, and it belongs where
     it is — it is simply not something to put a tile on. */
  it('does not read the app’s own loops file as a clip', () => {
    expect(
      isClipFile(
        aDriveFile({
          name: 'loops.json',
          mimeType: 'application/json',
          appProperties: undefined,
        }),
      ),
    ).toBe(false)
  })

  /* #77 puts a `Thumbnails` folder in here, and a folder comes back from the
     listing exactly as a file does. Keying on video-ness rather than on the
     name `loops.json` is what makes that ticket cost nothing here. */
  it('does not read a subfolder as a clip', () => {
    expect(
      isClipFile(
        aDriveFile({
          name: 'Thumbnails',
          mimeType: 'application/vnd.google-apps.folder',
          appProperties: undefined,
        }),
      ),
    ).toBe(false)
  })

  /* The upload declares `file.type || 'application/octet-stream'`, and a clip
     that failed to compress goes up as the file the dancer picked — so a clip
     whose `File.type` was empty is sitting in Drive under a mime that says
     nothing. It is still a clip, and a rule that read only the mime would hide
     it on every device at once. */
  it('reads a file this app uploaded as a clip whatever mime Drive gave it', () => {
    expect(isClipFile(aDriveFile({ mimeType: 'application/octet-stream' }))).toBe(
      true,
    )
  })

  /* A field left out of `fields` is simply absent from the answer, which this
     listing has been caught by twice already. Absent is not video. */
  it('does not read a file Drive named no type for, and this app never sent, as a clip', () => {
    expect(
      isClipFile(aDriveFile({ mimeType: undefined, appProperties: undefined })),
    ).toBe(false)
  })
})
