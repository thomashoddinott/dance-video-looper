import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findWorkspaces } from './workspaces.mjs'

const getFakeRepo = (overrides = {}) => ({
  '.': {
    dirs: ['app', 'mockup', 'docs', 'node_modules', '.git'],
    pkg: { scripts: { test: 'node --test scripts/gate/' } },
  },
  app: {
    dirs: ['src', 'node_modules'],
    pkg: { scripts: { test: 'vitest run', lint: 'oxlint' } },
  },
  mockup: { dirs: ['src'], pkg: { scripts: { lint: 'oxlint' } } },
  docs: { dirs: ['use-cases'] },
  ...overrides,
})

const getIo = (repo) => ({
  listDirs: (dir) => repo[dir]?.dirs ?? [],
  readPackageJson: (dir) => repo[dir]?.pkg ?? null,
  isIgnored: (dir) => repo[dir]?.ignored === true,
})

const dirsOf = (workspaces) => workspaces.map((workspace) => workspace.dir)

test('every directory holding a package.json is a workspace', () => {
  const workspaces = findWorkspaces(getIo(getFakeRepo()))

  assert.deepEqual(dirsOf(workspaces), ['.', 'app', 'mockup'])
})

test('a directory without a package.json is not a workspace', () => {
  const workspaces = findWorkspaces(getIo(getFakeRepo()))

  assert.ok(!dirsOf(workspaces).includes('docs'))
})

test('vendored and generated trees are never searched', () => {
  const repo = getFakeRepo({
    node_modules: { dirs: ['react'], pkg: { scripts: { test: 'should never run' } } },
    'node_modules/react': { dirs: [], pkg: { scripts: {} } },
    '.git': { dirs: [], pkg: { scripts: {} } },
  })

  const workspaces = findWorkspaces(getIo(repo))

  assert.deepEqual(dirsOf(workspaces), ['.', 'app', 'mockup'])
})

test('a git-ignored directory is never a workspace', () => {
  const repo = getFakeRepo({
    '.': {
      dirs: ['app', 'mockup', 'spike-google-drive-storage'],
      pkg: { scripts: { test: 'node --test scripts/gate/' } },
    },
    'spike-google-drive-storage': {
      dirs: [],
      pkg: { scripts: { build: 'vite build' } },
      ignored: true,
    },
  })

  const workspaces = findWorkspaces(getIo(repo))

  assert.deepEqual(dirsOf(workspaces), ['.', 'app', 'mockup'])
})

test('nothing inside a git-ignored directory is a workspace either', () => {
  const repo = getFakeRepo({
    '.': { dirs: ['app', 'scratch'], pkg: { scripts: { test: 'node --test' } } },
    scratch: { dirs: ['nested'], ignored: true },
    'scratch/nested': { dirs: [], pkg: { scripts: { build: 'vite build' } } },
  })

  const workspaces = findWorkspaces(getIo(repo))

  assert.deepEqual(dirsOf(workspaces), ['.', 'app'])
})

test('a workspace carries the scripts it declares', () => {
  const workspaces = findWorkspaces(getIo(getFakeRepo()))
  const app = workspaces.find((workspace) => workspace.dir === 'app')

  assert.deepEqual(app.scripts, { test: 'vitest run', lint: 'oxlint' })
})

test('a workspace declaring no scripts carries an empty set', () => {
  const repo = getFakeRepo({ mockup: { dirs: [], pkg: { name: 'mockup' } } })

  const mockup = findWorkspaces(getIo(repo)).find((workspace) => workspace.dir === 'mockup')

  assert.deepEqual(mockup.scripts, {})
})
