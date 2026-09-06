import { describe, expect, it, vi } from 'vitest'

import type { DriveApi, StoredJson } from '../drive/driveApi'
import { A_LOOPS_FILE, aDriveApi } from '../drive/driveApi.factory'
import { A_FOLDER, A_TOKEN } from '../drive/driveHost.factory'
import { applyToLoops, LOOPS_FILE, LoopsRefused } from './driveLoops'
import type { SavedLoop } from './loop'
import { getLoop } from './loop.factory'
import { withLoop, withoutLoop } from './loopsChange'
import { NO_LOOPS, serialiseLoops } from './loopsFile'

const A_CLIP = 'shuffle-drill'
const THE_OTHER_CLIP = 'pivot-turn'

const holding = (
  clips: Record<string, readonly SavedLoop[]>,
  versions: readonly string[] = ['3', '3'],
) => {
  const found = versions.reduce<ReturnType<typeof vi.fn>>(
    (find, version) =>
      find.mockResolvedValueOnce({
        id: A_LOOPS_FILE,
        version,
      } satisfies StoredJson),
    vi.fn(),
  )

  return aDriveApi({
    findJson: found as DriveApi['findJson'],
    readJson: vi.fn(async () => serialiseLoops({ ...NO_LOOPS, clips })),
  })
}

const bodyWritten = (api: DriveApi, call = 0) =>
  JSON.parse(String(vi.mocked(api.writeJson).mock.calls[call]?.[2])) as unknown

describe('writing a change back to Drive', () => {
  it('patches the same file, in place', async () => {
    const api = holding({})

    await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withLoop(loops, A_CLIP, getLoop()),
    )

    expect(api.writeJson).toHaveBeenCalledWith(
      A_TOKEN,
      A_LOOPS_FILE,
      expect.any(String),
    )
    expect(api.createJson).not.toHaveBeenCalled()
  })

  it('hands back the loops as they now are', async () => {
    const loop = getLoop()
    const api = holding({})

    await expect(
      applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
        withLoop(loops, A_CLIP, loop),
      ),
    ).resolves.toEqual({ ...NO_LOOPS, clips: { [A_CLIP]: [loop] } })
  })

  /* UC-01 Q-05, and the whole reason this is a read-modify-write rather than a
     last-write-wins. The loop the other device saved an hour ago is in the file
     when this save reads it, so it is in the file when this save writes it. A
     write built from what the screen was holding would take it out. */
  it('applies the change to what Drive holds now, not to a stale copy', async () => {
    const theirs = getLoop({ id: 'saved-on-the-phone' })
    const mine = getLoop({ id: 'saved-on-the-laptop' })
    const api = holding({ [THE_OTHER_CLIP]: [theirs] })

    await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withLoop(loops, A_CLIP, mine),
    )

    expect(bodyWritten(api)).toEqual({
      schema: 1,
      clips: { [THE_OTHER_CLIP]: [theirs], [A_CLIP]: [mine] },
    })
  })

  it('carries a removal the same way a save is carried', async () => {
    const going = getLoop({ id: 'going' })
    const kept = getLoop({ id: 'kept' })
    const api = holding({ [A_CLIP]: [going, kept] })

    await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withoutLoop(loops, A_CLIP, 'going'),
    )

    expect(bodyWritten(api)).toEqual({
      schema: 1,
      clips: { [A_CLIP]: [kept] },
    })
  })
})

describe('the first save of all', () => {
  it('creates the file, then writes the loop into it', async () => {
    const loop = getLoop()
    const api = aDriveApi()

    await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withLoop(loops, A_CLIP, loop),
    )

    expect(api.createJson).toHaveBeenCalledWith(A_TOKEN, {
      folderId: A_FOLDER,
      name: LOOPS_FILE,
    })
    expect(bodyWritten(api)).toEqual({
      schema: 1,
      clips: { [A_CLIP]: [loop] },
    })
  })
})

/* The one failure mode in this story that destroys the asset rather than
   merely failing to add to it. Everything else here can be retried; this
   cannot be undone. */
describe('a file nobody can read', () => {
  it('refuses to write over it', async () => {
    const api = aDriveApi({
      findJson: vi.fn(async () => ({ id: A_LOOPS_FILE, version: '3' })),
      readJson: vi.fn(async () => 'this is not the file we wrote'),
    })

    const refused = await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withLoop(loops, A_CLIP, getLoop()),
    ).catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(LoopsRefused)
    expect(refused).toMatchObject({ because: 'unreadable' })
    expect(api.writeJson).not.toHaveBeenCalled()
  })
})

/* What is left of Q-05 after the re-read: one round trip, between reading the
   file and patching it. The version catches a write that lands inside it. */
describe('a write that lands inside our own round trip', () => {
  it('reads again and re-applies, rather than clobbering', async () => {
    const api = holding({}, ['3', '4', '4', '4'])

    await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withLoop(loops, A_CLIP, getLoop()),
    )

    expect(api.readJson).toHaveBeenCalledTimes(2)
    expect(api.writeJson).toHaveBeenCalledTimes(1)
  })

  /* Twice in a row is not a race any more, it is something this app does not
     understand — so it stops rather than keeping on trying to win. */
  it('gives up if it moves again, and writes nothing', async () => {
    const api = holding({}, ['3', '4', '4', '5'])

    const refused = await applyToLoops(api, A_TOKEN, A_FOLDER, (loops) =>
      withLoop(loops, A_CLIP, getLoop()),
    ).catch((error: unknown) => error)

    expect(refused).toBeInstanceOf(LoopsRefused)
    expect(refused).toMatchObject({ because: 'moved' })
    expect(api.writeJson).not.toHaveBeenCalled()
  })
})
