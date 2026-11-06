import { describe, expect, it } from 'vitest'

import type { FetchLike } from './driveApi'
import { DriveError } from './driveApi'
import { clipFromDriveFile } from './driveClips'
import {
  A_TOKEN,
  anApiOver,
  answering,
  fetchAnswering,
  initOf,
  urlOf,
} from './driveHost.factory'

const A_CLIP = 'drive-shuffle-drill'

/* Drive answers twice: what the file is called now, then the patch. */
const apiHolding = (filename: string) => {
  const fetch = fetchAnswering(
    answering({ name: filename }),
    answering({ id: A_CLIP }),
  )

  return { ...anApiOver({ fetch }), fetch }
}

const THE_PATCH = 1

const sentBody = (fetch: FetchLike) =>
  JSON.parse(String(initOf(fetch, THE_PATCH)?.body)) as unknown

const sentName = (fetch: FetchLike) =>
  (sentBody(fetch) as { readonly name: string }).name

/* #54. The clip's name is its Drive file's name, so a rename is a patch to that
   and nothing else — and the dancer's own Drive folder says the new name too. */
describe('renaming a clip in Drive', () => {
  it('renames the clip’s own file, keeping the extension it has there', async () => {
    const { api, fetch } = apiHolding('Shuffle drill.mp4')

    await api.rename(A_TOKEN, A_CLIP, 'Basic step')

    expect(initOf(fetch, THE_PATCH)?.method).toBe('PATCH')
    expect(sentBody(fetch)).toEqual({ name: 'Basic step.mp4' })
  })

  /* The extension is read off the file rather than off the tile, because the
     two can differ: a clip picked as a .MOV went up as the .mp4 it was
     re-encoded to. */
  it('asks Drive what the file is called before renaming it', async () => {
    const { api, fetch } = apiHolding('Shuffle drill.MOV')

    await api.rename(A_TOKEN, A_CLIP, 'Basic step')

    expect(urlOf(fetch)).toContain(`/drive/v3/files/${A_CLIP}?fields=name`)
    expect(sentName(fetch)).toBe('Basic step.MOV')
  })

  /* The extension is what keeps a dot the dancer typed: the name is read back
     with everything after the last dot stripped, so without it "v2.0" would
     come back as "v2". */
  it('reads back as exactly the name given, dots and all', async () => {
    const { api, fetch } = apiHolding('Shuffle drill.mp4')

    await api.rename(A_TOKEN, A_CLIP, 'Basic step v2.0')

    expect(
      clipFromDriveFile({ id: A_CLIP, name: sentName(fetch) }).name,
    ).toBe('Basic step v2.0')
  })

  it('gives a file that has no extension none', async () => {
    const { api, fetch } = apiHolding('Shuffle drill')

    await api.rename(A_TOKEN, A_CLIP, 'Basic step')

    expect(sentName(fetch)).toBe('Basic step')
  })

  /* `setStyle`'s reasoning, for the same two endpoints: the upload one would
     replace the clip's bytes with a scrap of JSON. Naming only `name` leaves
     `appProperties` — the clip's id, and with it its loops — untouched. */
  it('patches the metadata, leaving the bytes alone', async () => {
    const { api, fetch } = apiHolding('Shuffle drill.mp4')

    await api.rename(A_TOKEN, A_CLIP, 'Basic step')

    expect(urlOf(fetch, THE_PATCH)).toContain(`/drive/v3/files/${A_CLIP}`)
    expect(urlOf(fetch, THE_PATCH)).not.toContain('/upload/')
  })

  it('refuses loudly, carrying the status', async () => {
    const { api } = anApiOver({
      fetch: fetchAnswering(
        answering({ name: 'Shuffle drill.mp4' }),
        answering({ error: { message: 'the grant was withdrawn' } }, 401),
      ),
    })

    const refused = await api
      .rename(A_TOKEN, A_CLIP, 'Basic step')
      .catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(DriveError)
    expect(refused).toMatchObject({
      status: 401,
      message: 'the grant was withdrawn',
    })
  })

  it('renames nothing when Drive will not say what the file is called', async () => {
    const fetch = fetchAnswering(
      answering({ error: { message: 'File not found' } }, 404),
    )
    const { api } = anApiOver({ fetch })

    const refused = await api
      .rename(A_TOKEN, A_CLIP, 'Basic step')
      .catch((error: unknown) => error)

    expect(refused).toMatchObject({ status: 404 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
