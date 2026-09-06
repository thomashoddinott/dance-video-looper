import { describe, expect, it } from 'vitest'

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

/* Deleting a clip is the first thing this app has ever taken *out* of Drive
   (UC-01 Q-08), and the whole of the decision is in which verb it uses. */
describe('deleting a clip from Drive', () => {
  /* Trashed, never erased. `listClipFiles` already filters `trashed=false`, so
     a trashed clip leaves the grid without leaving Drive — which makes Drive's
     own bin the undo behind a control that is one mis-tap away from a clip the
     dancer cannot get back. `files.delete` would be permanent. */
  it('sends the clip to the bin rather than erasing it', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.trash(A_TOKEN, A_CLIP)

    expect(initOf(fetch)?.method).toBe('PATCH')
    expect(JSON.parse(String(initOf(fetch)?.body))).toEqual({ trashed: true })
  })

  /* `writeJson`'s trap, inverted. It patches the *upload* endpoint because it
     means to replace the bytes; this patches the plain one because it means to
     change the metadata and leave the bytes exactly where they are. Getting
     these two the wrong way round is silent in both directions. */
  it('patches the metadata, leaving the bytes alone', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_CLIP }))

    await api.trash(A_TOKEN, A_CLIP)

    expect(urlOf(fetch)).toContain(`/drive/v3/files/${A_CLIP}`)
    expect(urlOf(fetch)).not.toContain('/upload/')
  })

  /* A refusal has to arrive carrying its status or `withdrewConsent` cannot
     tell a revoked grant from Google having a bad minute — and on this story
     the difference decides whether the tile stays or the dancer is asked to
     reconnect. */
  it('refuses loudly, carrying the status', async () => {
    const { api } = apiAnswering(
      answering({ error: { message: 'the grant was withdrawn' } }, 401),
    )

    const refused = await api
      .trash(A_TOKEN, A_CLIP)
      .catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(DriveError)
    expect(refused).toMatchObject({
      status: 401,
      message: 'the grant was withdrawn',
    })
  })
})
