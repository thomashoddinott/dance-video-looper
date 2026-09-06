import { test } from 'node:test'
import assert from 'node:assert/strict'

import { dependenciesMissing, npmCommand } from './npm.mjs'

test('a check runs as an npm script in its own workspace', () => {
  assert.deepEqual(npmCommand('app', 'lint'), {
    command: 'npm',
    args: ['run', 'lint'],
    cwd: 'app',
  })
})

test('a check in the repo root runs there', () => {
  assert.deepEqual(npmCommand('.', 'test'), {
    command: 'npm',
    args: ['run', 'test'],
    cwd: '.',
  })
})

const getInstalledWorkspace = (overrides = {}) => ({
  dir: 'app',
  manifest: { dependencies: { react: '^19.2.8' } },
  hasNodeModules: true,
  ...overrides,
})

test('a workspace with its dependencies installed is ready', () => {
  assert.equal(dependenciesMissing(getInstalledWorkspace()), false)
})

test('a workspace declaring dependencies without node_modules is not ready', () => {
  assert.equal(dependenciesMissing(getInstalledWorkspace({ hasNodeModules: false })), true)
})

test('a workspace declaring only devDependencies still needs them installed', () => {
  const workspace = getInstalledWorkspace({
    manifest: { devDependencies: { oxlint: '^1.80.0' } },
    hasNodeModules: false,
  })

  assert.equal(dependenciesMissing(workspace), true)
})

test('a workspace with no dependencies never reports them missing', () => {
  const workspace = getInstalledWorkspace({ manifest: { scripts: {} }, hasNodeModules: false })

  assert.equal(dependenciesMissing(workspace), false)
})

test('an empty dependency block counts as no dependencies', () => {
  const workspace = getInstalledWorkspace({
    manifest: { dependencies: {}, devDependencies: {} },
    hasNodeModules: false,
  })

  assert.equal(dependenciesMissing(workspace), false)
})
