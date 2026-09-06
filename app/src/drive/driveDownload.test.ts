import { describe, expect, it, vi } from 'vitest'

import {
  A_MINTED_URL,
  A_TOKEN,
  anApiOver,
  answeringWith,
  arrivingIn,
  fetchAnswering,
  initOf,
} from './driveHost.factory'

const A_DRIVE_ID = 'drive-file-id'

const serving = (bytes: Blob, status = 200) =>
  answeringWith({ blob: () => Promise.resolve(bytes) }, {}, status)

describe('fetching a clip this device did not upload', () => {
  /* The bytes, not a url over them. Whoever asked for them decides what to do
     with them — play them, and now also keep them (US-01-16) — and a url is no
     use to a cache. Minting moved to `useClipSource`, which is the one place
     that can also release. */
  it('hands back the bytes Drive served', async () => {
    const bytes = new Blob([new Uint8Array(26)])
    const { api } = anApiOver({ fetch: fetchAnswering(serving(bytes)) })

    await expect(api.download(A_TOKEN, A_DRIVE_ID)).resolves.toBe(bytes)
  })

  it('mints a url over bytes when asked, which is the other half of releasing one', () => {
    const { api } = anApiOver()

    expect(api.toUrl(new Blob())).toBe(A_MINTED_URL)
  })

  it('asks Drive for the bytes rather than for the file’s description', async () => {
    const fetch = fetchAnswering(serving(new Blob()))
    const { api } = anApiOver({ fetch })

    await api.download(A_TOKEN, A_DRIVE_ID)

    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      `/files/${A_DRIVE_ID}?alt=media`,
    )
  })

  it('sends the token it was handed', async () => {
    const fetch = fetchAnswering(serving(new Blob()))
    const { api } = anApiOver({ fetch })

    await api.download(A_TOKEN, A_DRIVE_ID)

    expect(initOf(fetch)).toMatchObject({
      headers: { Authorization: `Bearer ${A_TOKEN}` },
    })
  })

  /* The spike measured 7.08 s for 9.33 MB, nearly all of it transfer. Counting
     it is what turns a blank seven seconds into a number that moves, and
     `Content-Length` is CORS-readable where `Content-Range` is not
     (FINDINGS.md Q8-2), so there is a total to count against. */
  it('reports how far along it is as the bytes arrive', async () => {
    const onProgress = vi.fn()
    const { api } = anApiOver({
      fetch: fetchAnswering(
        arrivingIn([new Uint8Array(4), new Uint8Array(6)]),
      ),
    })

    await api.download(A_TOKEN, A_DRIVE_ID, onProgress)

    expect(onProgress.mock.calls).toEqual([
      [4, 10],
      [10, 10],
    ])
  })

  it('hands back every byte it was streamed, not just the last piece', async () => {
    const { api } = anApiOver({
      fetch: fetchAnswering(
        arrivingIn([new Uint8Array(4), new Uint8Array(6)]),
      ),
    })

    const bytes = await api.download(A_TOKEN, A_DRIVE_ID, vi.fn())

    expect(bytes.size).toBe(10)
  })

  /* Progress is a courtesy; the bytes are not. A response that cannot be read
     in pieces still has to yield them, it just arrives all at once with nothing
     to report on the way. The spike's `downloadBlob` keeps the same fallback. */
  it('still yields the bytes when the response cannot be streamed', async () => {
    const onProgress = vi.fn()
    const { api } = anApiOver({
      fetch: fetchAnswering(serving(new Blob([new Uint8Array(10)]))),
    })

    const bytes = await api.download(A_TOKEN, A_DRIVE_ID, onProgress)

    expect(bytes.size).toBe(10)
    expect(onProgress).not.toHaveBeenCalled()
  })

  /* Drive answering without a length is not Drive answering without bytes. The
     download must still complete; there is simply nothing to be a fraction of,
     and the player says so rather than dividing by zero. */
  it('reports what has arrived even when the total is not readable', async () => {
    const onProgress = vi.fn()
    const { api } = anApiOver({
      fetch: fetchAnswering(
        arrivingIn([new Uint8Array(4)], { totalIsReadable: false }),
      ),
    })

    await api.download(A_TOKEN, A_DRIVE_ID, onProgress)

    expect(onProgress).toHaveBeenCalledWith(4, 0)
  })

  it('refuses rather than handing back bytes Drive would not serve', async () => {
    const { api } = anApiOver({
      fetch: fetchAnswering(serving(new Blob(), 404)),
    })

    await expect(api.download(A_TOKEN, A_DRIVE_ID)).rejects.toMatchObject({
      name: 'DriveError',
      status: 404,
    })
  })
})
