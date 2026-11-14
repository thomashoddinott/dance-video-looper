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

/* #70. A group is said once the clip is in Drive, so it is written by a patch
   as a style is (`driveStyle.test`). */
describe('putting a clip in a group in Drive', () => {
  it('stores the group on the clip’s own file', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.setGroup(A_TOKEN, A_CLIP, 'Tuesday class · 27 Aug')

    expect(initOf(fetch)?.method).toBe('PATCH')
    expect(sentBody(fetch)).toEqual({
      appProperties: { group: 'Tuesday class · 27 Aug' },
    })
  })

  it('takes the clip out of its group when it is given none', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.setGroup(A_TOKEN, A_CLIP, undefined)

    expect(sentBody(fetch)).toEqual({ appProperties: { group: null } })
  })

  it('patches the metadata, leaving the bytes alone', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.setGroup(A_TOKEN, A_CLIP, 'Shines')

    expect(urlOf(fetch)).toContain(`/drive/v3/files/${A_CLIP}`)
    expect(urlOf(fetch)).not.toContain('/upload/')
  })

  it('refuses loudly, carrying the status', async () => {
    const { api } = apiAnswering(
      answering({ error: { message: 'the grant was withdrawn' } }, 401),
    )

    const refused = await api
      .setGroup(A_TOKEN, A_CLIP, 'Shines')
      .catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(DriveError)
    expect(refused).toMatchObject({ status: 401, message: 'the grant was withdrawn' })
  })
})
