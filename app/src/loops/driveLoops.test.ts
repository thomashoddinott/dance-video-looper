import { describe, expect, it, vi } from 'vitest'

import { A_FOLDER, A_TOKEN } from '../drive/driveHost.factory'
import { A_LOOPS_FILE, aDriveApi } from '../drive/driveApi.factory'
import { LOOPS_FILE, readLoops } from './driveLoops'
import { getLoop } from './loop.factory'
import { NO_LOOPS, serialiseLoops } from './loopsFile'

const A_CLIP = 'shuffle-drill'

const holding = (body: string) =>
  aDriveApi({
    findJson: vi.fn(async () => ({ id: A_LOOPS_FILE, version: '3' })),
    readJson: vi.fn(async () => body),
  })

describe('reading the loops out of Drive', () => {
  it('reads back what the file holds', async () => {
    const loop = getLoop()
    const api = holding(
      serialiseLoops({ ...NO_LOOPS, clips: { [A_CLIP]: [loop] } }),
    )

    await expect(readLoops(api, A_TOKEN, A_FOLDER)).resolves.toEqual({
      readable: true,
      loops: { ...NO_LOOPS, clips: { [A_CLIP]: [loop] } },
    })
  })

  it('looks for the file by name in the app’s own folder', async () => {
    const api = holding(serialiseLoops(NO_LOOPS))

    await readLoops(api, A_TOKEN, A_FOLDER)

    expect(api.findJson).toHaveBeenCalledWith(A_TOKEN, A_FOLDER, LOOPS_FILE)
  })

  /* A dancer who has never saved a loop, which is where everyone starts. Not a
     failure, and not something to create either — the file appears on the first
     save, not on the first read. */
  it('reads a folder with no loops file as nothing saved yet', async () => {
    const api = aDriveApi()

    await expect(readLoops(api, A_TOKEN, A_FOLDER)).resolves.toEqual({
      readable: true,
      loops: NO_LOOPS,
    })
  })

  it('does not go looking for the contents of a file that is not there', async () => {
    const api = aDriveApi()

    await readLoops(api, A_TOKEN, A_FOLDER)

    expect(api.readJson).not.toHaveBeenCalled()
  })

  /* The create hop landed and the content hop did not, so the file exists and
     holds nothing. Reading that as broken would refuse every save after it. */
  it('reads a zero-byte file as nothing saved yet', async () => {
    await expect(readLoops(holding(''), A_TOKEN, A_FOLDER)).resolves.toEqual({
      readable: true,
      loops: NO_LOOPS,
    })
  })

  /* The distinction the whole module exists for. "Nothing there" invites the
     next save to write; "we could not read it" must not, because that write
     would be the dancer's loops gone. */
  it('keeps a file it cannot read apart from a file with nothing in it', async () => {
    await expect(
      readLoops(holding('{ this is not json'), A_TOKEN, A_FOLDER),
    ).resolves.toEqual({ readable: false })
  })
})
