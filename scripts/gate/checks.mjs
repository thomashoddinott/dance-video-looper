const NEVER_TERMINATES = new Set(['dev', 'preview', 'start', 'serve'])

const isWatchMode = (name) => name.includes('watch')

const invokesTheGate = (command) => command.includes('scripts/verify.mjs')

export const runnableScripts = (scripts) =>
  Object.entries(scripts)
    .filter(([name, command]) => !NEVER_TERMINATES.has(name) && !isWatchMode(name) && !invokesTheGate(command))
    .map(([name]) => name)

const manifestOf = (dir) => (dir === '.' ? 'package.json' : `${dir}/package.json`)

export const planChecks = (workspaces) => {
  const repoChecks = [...new Set(workspaces.flatMap(({ scripts }) => runnableScripts(scripts)))]

  return workspaces.flatMap(({ dir, scripts }) => {
    const declared = new Set(runnableScripts(scripts))

    return repoChecks.map((script) =>
      declared.has(script)
        ? { dir, script, action: 'run' }
        : { dir, script, action: 'skip', reason: `no "${script}" script declared in ${manifestOf(dir)}` },
    )
  })
}
