#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { planChecks } from './gate/checks.mjs'
import { dependenciesMissing, npmCommand } from './gate/npm.mjs'
import { formatReport, verdict } from './gate/report.mjs'
import { findWorkspaces } from './gate/workspaces.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const shouldInstall = process.argv.includes('--install')

const absolute = (dir) => resolve(repoRoot, dir)

const io = {
  listDirs: (dir) =>
    readdirSync(absolute(dir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  readPackageJson: (dir) => {
    const manifest = join(absolute(dir), 'package.json')
    return existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : null
  },
  isIgnored: (dir) =>
    spawnSync('git', ['check-ignore', '--quiet', dir], { cwd: repoRoot }).status === 0,
}

const workspaces = findWorkspaces(io).map((workspace) => ({
  ...workspace,
  manifest: io.readPackageJson(workspace.dir),
  hasNodeModules: existsSync(join(absolute(workspace.dir), 'node_modules')),
}))

const run = ({ command, args, cwd }, stdio) =>
  spawnSync(command, args, { cwd: absolute(cwd), stdio, encoding: 'utf8' })

const notInstalled = workspaces.filter(dependenciesMissing)

if (notInstalled.length > 0 && !shouldInstall) {
  const lines = notInstalled.map(({ dir }) => `${dir}  DEPS MISSING  — run \`npm install\` in ${dir}`)
  console.error(
    [
      ...lines,
      '',
      `GATE: FAIL — dependencies not installed, 0 checks ran`,
      `Re-run with --install to install them first.`,
    ].join('\n'),
  )
  process.exit(1)
}

notInstalled.forEach(({ dir }) => {
  console.error(`Installing dependencies in ${dir}...`)
  const installed = run({ command: 'npm', args: ['install'], cwd: dir }, 'inherit')
  if (installed.status !== 0) {
    console.error(`GATE: FAIL — \`npm install\` failed in ${dir}, 0 checks ran`)
    process.exit(1)
  }
})

const plan = planChecks(workspaces)

console.error(`Running ${plan.filter(({ action }) => action === 'run').length} checks...\n`)

const results = plan.map((check) => {
  if (check.action === 'skip') return check

  const outcome = run(npmCommand(check.dir, check.script), 'pipe')
  return { ...check, passed: outcome.status === 0, output: `${outcome.stdout}${outcome.stderr}` }
})

console.log(formatReport(results))

const failed = results.filter(({ action, passed }) => action === 'run' && !passed)

failed.forEach(({ dir, script, output }) => {
  console.log(`\n--- ${dir} ${script} ---\n${output.trim()}`)
})

process.exit(verdict(results) === 'PASS' ? 0 : 1)
