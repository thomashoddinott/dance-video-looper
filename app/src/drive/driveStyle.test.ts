import { describe, expect, it } from 'vitest'

import type { FetchLike } from './driveApi'
import { DriveError } from './driveApi'
import {
  A_TOKEN,
  anApiOver,
  answering,
  fetchAnswering,
  initOf,
  urlOf,
} from './driveHost.factory'

const A_CLIP = 'drive-shuffle-drill'

const apiAnswering = (...answers: readonly ReturnType<typeof answering>[]) => {
  const fetch = fetchAnswering(...answers)

  return { ...anApiOver({ fetch }), fetch }
}

const sentBody = (fetch: FetchLike) =>
  JSON.parse(String(initOf(fetch)?.body)) as unknown

/* #43. A style is said after the clip is already in Drive, so it is the one
   property written by a patch rather than at upload. */
describe('setting a clip’s dance style in Drive', () => {
  it('stores the style on the clip’s own file', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.setStyle(A_TOKEN, A_CLIP, 'salsa')

    expect(initOf(fetch)?.method).toBe('PATCH')
    expect(sentBody(fetch)).toEqual({ appProperties: { style: 'salsa' } })
  })

  /* Drive merges `appProperties` key by key, so the patch names the one key
     it means and leaves `clipId` and `seconds` exactly as they were — and a
     `null` is how Drive is told to drop a key rather than keep it. */
  it('removes the style when the clip is given none', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.setStyle(A_TOKEN, A_CLIP, undefined)

    expect(sentBody(fetch)).toEqual({ appProperties: { style: null } })
  })

  /* `trash`'s reasoning, for the same two endpoints: the upload one would
     replace the clip's bytes with a scrap of JSON. */
  it('patches the metadata, leaving the bytes alone', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.setStyle(A_TOKEN, A_CLIP, 'bachata')

    expect(urlOf(fetch)).toContain(`/drive/v3/files/${A_CLIP}`)
    expect(urlOf(fetch)).not.toContain('/upload/')
  })

  it('refuses loudly, carrying the status', async () => {
    const { api } = apiAnswering(
      answering({ error: { message: 'the grant was withdrawn' } }, 401),
    )

    const refused = await api
      .setStyle(A_TOKEN, A_CLIP, 'salsa')
      .catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(DriveError)
    expect(refused).toMatchObject({
      status: 401,
      message: 'the grant was withdrawn',
    })
  })
})
