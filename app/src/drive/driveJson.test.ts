import { describe, expect, it } from 'vitest'

import { DriveError } from './driveApi'
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

const LOOPS = 'loops.json'
const A_FILE = 'drive-loops-1'

const apiAnswering = (...answers: readonly ReturnType<typeof answering>[]) => {
  const fetch = fetchAnswering(...answers)

  return { ...anApiOver({ fetch }), fetch }
}

/* The one file this app keeps besides the clips themselves, and the four calls
   it takes to keep it. Carried across from the spike's `drive.js`, which had
   already proved all four against real Drive (FINDINGS.md Q7). */
describe('finding the loops file', () => {
  it('looks by name, inside the app’s own folder, and not at trash', async () => {
    const { api, fetch } = apiAnswering(answering({ files: [] }))

    await api.findJson(A_TOKEN, A_FOLDER, LOOPS)

    expect(urlOf(fetch)).toContain(`'${A_FOLDER}' in parents`)
    expect(urlOf(fetch)).toContain(`name='${LOOPS}'`)
    expect(urlOf(fetch)).toContain('trashed=false')
  })

  /* The same trap `md5Checksum` and `appProperties` already sprang on the clip
     listing: a field left out of `fields` is simply absent from the answer, and
     a version nobody read is a clobber nobody catches. */
  it('asks for the version, which is what a concurrent write is caught by', async () => {
    const { api, fetch } = apiAnswering(answering({ files: [] }))

    await api.findJson(A_TOKEN, A_FOLDER, LOOPS)

    expect(urlOf(fetch)).toContain('version')
  })

  it('hands back the file’s id and version', async () => {
    const { api } = apiAnswering(
      answering({ files: [{ id: A_FILE, version: '4' }] }),
    )

    await expect(api.findJson(A_TOKEN, A_FOLDER, LOOPS)).resolves.toEqual({
      id: A_FILE,
      version: '4',
    })
  })

  /* Absent is a first save, not a failure — it is what makes "created on the
     first save" reachable at all. */
  it('answers nothing for a folder that has no loops file yet', async () => {
    const { api } = apiAnswering(answering({ files: [] }))

    await expect(api.findJson(A_TOKEN, A_FOLDER, LOOPS)).resolves.toBeNull()
  })

  it('survives Drive omitting the list entirely', async () => {
    const { api } = apiAnswering(answering({}))

    await expect(api.findJson(A_TOKEN, A_FOLDER, LOOPS)).resolves.toBeNull()
  })
})

describe('reading the loops file', () => {
  it('asks for the bytes rather than the metadata', async () => {
    const { api, fetch } = apiAnswering(answeringWith({ text: async () => '{}' }))

    await api.readJson(A_TOKEN, A_FILE)

    expect(urlOf(fetch)).toContain(`/files/${A_FILE}?alt=media`)
  })

  /* Text, deliberately, not parsed JSON. The caller has to tell an empty file
     from a corrupt one — the first is a first save that half-landed and the
     second must never be overwritten — and `response.json()` collapses both
     into the same throw. */
  it('hands back what is in the file, unparsed', async () => {
    const { api } = apiAnswering(
      answeringWith({ text: async () => '{"schema":1,"clips":{}}' }),
    )

    await expect(api.readJson(A_TOKEN, A_FILE)).resolves.toBe(
      '{"schema":1,"clips":{}}',
    )
  })

  it('hands back an empty file as an empty string rather than throwing', async () => {
    const { api } = apiAnswering(answeringWith({ text: async () => '' }))

    await expect(api.readJson(A_TOKEN, A_FILE)).resolves.toBe('')
  })
})

describe('creating the loops file', () => {
  /* Metadata first and content second, rather than one multipart request. It
     keeps the `DriveHost` seam taking a string body — the multipart form needs a
     Blob — and it happens exactly once in the app's life. The cost is a
     zero-byte `loops.json` if the second hop fails, which `readLoopsFile`
     already reads as "nothing saved yet". */
  it('puts an empty JSON file in the app’s folder', async () => {
    const { api, fetch } = apiAnswering(
      answering({ id: A_FILE, version: '1' }),
    )

    await api.createJson(A_TOKEN, { folderId: A_FOLDER, name: LOOPS })

    expect(initOf(fetch)?.method).toBe('POST')
    expect(JSON.parse(String(initOf(fetch)?.body))).toEqual({
      name: LOOPS,
      parents: [A_FOLDER],
      mimeType: 'application/json',
    })
  })

  it('hands back the id and version it was given', async () => {
    const { api } = apiAnswering(answering({ id: A_FILE, version: '1' }))

    await expect(
      api.createJson(A_TOKEN, { folderId: A_FOLDER, name: LOOPS }),
    ).resolves.toEqual({ id: A_FILE, version: '1' })
  })
})

describe('writing the loops file', () => {
  /* The spike's question 7, and the second acceptance criterion with it: PATCH
     against the *upload* endpoint replaces the bytes and keeps the same file id,
     so a save updates one file rather than leaving a second copy per save. */
  it('patches the upload endpoint in place, keeping the same file', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_FILE, version: '5' }))

    await api.writeJson(A_TOKEN, A_FILE, '{"schema":1,"clips":{}}')

    expect(urlOf(fetch)).toContain(`/upload/drive/v3/files/${A_FILE}`)
    expect(urlOf(fetch)).toContain('uploadType=media')
    expect(initOf(fetch)?.method).toBe('PATCH')
  })

  it('sends the body exactly as it was given', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_FILE, version: '5' }))

    await api.writeJson(A_TOKEN, A_FILE, '{"schema":1,"clips":{}}')

    expect(initOf(fetch)?.body).toBe('{"schema":1,"clips":{}}')
    expect(initOf(fetch)?.headers?.['Content-Type']).toBe('application/json')
  })

  /* What the write is checked against next time round. A write that did not
     report its new version would leave the guard with nothing to compare. */
  it('hands back the version the write produced', async () => {
    const { api, fetch } = apiAnswering(answering({ id: A_FILE, version: '5' }))

    await expect(
      api.writeJson(A_TOKEN, A_FILE, '{}'),
    ).resolves.toEqual({ id: A_FILE, version: '5' })
    expect(urlOf(fetch)).toContain('version')
  })

  /* A 401 has to arrive as a DriveError carrying its status, or `withdrewConsent`
     cannot tell a revoked grant from Google having a bad minute — and this is
     the story where getting that wrong reports a lost loop as a saved one. */
  it('refuses loudly, carrying the status', async () => {
    const { api } = apiAnswering(
      answering({ error: { message: 'the grant was withdrawn' } }, 401),
    )

    const refused = await api.writeJson(A_TOKEN, A_FILE, '{}').catch(
      (error: unknown) => error,
    )

    expect(refused).toBeInstanceOf(DriveError)
    expect(refused).toMatchObject({
      status: 401,
      message: 'the grant was withdrawn',
    })
  })
})
