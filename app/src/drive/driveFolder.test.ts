import { describe, expect, it } from 'vitest'

import { CLIPS_FOLDER, DriveError } from './driveApi'
import {
  A_FOLDER,
  A_TOKEN,
  anApiOver,
  answering,
  answeringWith,
  fetchAnswering,
  initOf,
  urlOf,
} from './driveHost.factory'

describe('finding the folder the app keeps clips in', () => {
  it('re-finds a folder made in an earlier session rather than making another', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'folder-1' }] }))
    const { api } = anApiOver({ fetch })

    await expect(api.findOrCreateFolder(A_TOKEN)).resolves.toBe('folder-1')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('creates the folder the first time, when Drive holds none', async () => {
    const fetch = fetchAnswering(
      answering({ files: [] }),
      answering({ id: 'folder-made' }),
    )
    const { api } = anApiOver({ fetch })

    await expect(api.findOrCreateFolder(A_TOKEN)).resolves.toBe('folder-made')
    expect(initOf(fetch, 1)).toMatchObject({ method: 'POST' })
  })

  it('asks for the folder by the name the dancer sees in their own Drive', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'folder-1' }] }))
    const { api } = anApiOver({ fetch })

    await api.findOrCreateFolder(A_TOKEN)

    expect(urlOf(fetch)).toContain(`name='${CLIPS_FOLDER}'`)
  })

  /* Drive's query language single-quotes its values, so an apostrophe does not
     break the query — it *changes* it, which is worse. Carried from the spike,
     which escapes for the same reason. */
  it('escapes a quote in the folder name rather than letting it alter the query', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'folder-1' }] }))
    const { api } = anApiOver({ fetch })

    await api.findOrCreateFolder(A_TOKEN, "Thomas' clips")

    expect(urlOf(fetch)).toContain("name='Thomas\\' clips'")
  })

  it('sends the token it was handed, and holds no copy of it', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'folder-1' }] }))
    const { api } = anApiOver({ fetch })

    await api.findOrCreateFolder(A_TOKEN)

    expect(initOf(fetch)).toMatchObject({
      headers: { Authorization: `Bearer ${A_TOKEN}` },
    })
  })

  it('refuses trashed folders, which are not the folder', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'folder-1' }] }))
    const { api } = anApiOver({ fetch })

    await api.findOrCreateFolder(A_TOKEN)

    expect(urlOf(fetch)).toContain('trashed=false')
  })

  /* The clips folder is found by name across the whole of Drive, which is what
     lets the dancer move it wherever they like. Scoping that search to a parent
     would pin it to wherever it happened to be made. */
  it('looks for the clips folder wherever in Drive it has been moved to', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'folder-1' }] }))
    const { api } = anApiOver({ fetch })

    await api.findOrCreateFolder(A_TOKEN)

    expect(urlOf(fetch)).not.toContain('in parents')
  })

  it('reports the status Drive refused with, which is what tells a withdrawal from an outage', async () => {
    const { api } = anApiOver({
      fetch: fetchAnswering(answering({ error: { message: 'no' } }, 401)),
    })

    await expect(api.findOrCreateFolder(A_TOKEN)).rejects.toMatchObject({
      name: 'DriveError',
      status: 401,
    })
  })

  it('survives a refusal that carries no readable body', async () => {
    const { api } = anApiOver({
      fetch: fetchAnswering(
        answeringWith(
          {
            json: () => Promise.reject(new Error('not json')),
            text: () => Promise.reject(new Error('not text')),
          },
          null,
          500,
        ),
      ),
    })

    await expect(api.findOrCreateFolder(A_TOKEN)).rejects.toBeInstanceOf(
      DriveError,
    )
  })
})

/* A folder inside another one, which is where #77 keeps its stills. Unlike the
   clips folder, this one is found *within* its parent: two folders named
   `Thumbnails` are perfectly possible once the dancer starts rearranging their
   Drive, and picking the wrong one would scatter the stills. */
describe('finding a folder inside another folder', () => {
  it('looks only inside the parent it was given', async () => {
    const fetch = fetchAnswering(answering({ files: [{ id: 'stills-1' }] }))
    const { api } = anApiOver({ fetch })

    await expect(
      api.findOrCreateFolder(A_TOKEN, 'Thumbnails', A_FOLDER),
    ).resolves.toBe('stills-1')
    expect(urlOf(fetch)).toContain(`'${A_FOLDER}' in parents`)
  })

  it('makes it inside that parent when there is none there yet', async () => {
    const fetch = fetchAnswering(
      answering({ files: [] }),
      answering({ id: 'stills-made' }),
    )
    const { api } = anApiOver({ fetch })

    await expect(
      api.findOrCreateFolder(A_TOKEN, 'Thumbnails', A_FOLDER),
    ).resolves.toBe('stills-made')
    expect(initOf(fetch, 1)?.body).toContain(A_FOLDER)
  })
})
