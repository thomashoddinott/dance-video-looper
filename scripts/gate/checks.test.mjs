import { test } from 'node:test'
import assert from 'node:assert/strict'

import { planChecks, runnableScripts } from './checks.mjs'

const getAppScripts = (overrides = {}) => ({
  dev: 'vite',
  build: 'tsc --noEmit && vite build',
  preview: 'vite preview',
  test: 'vitest run',
  'test:watch': 'vitest',
  lint: 'oxlint',
  typecheck: 'tsc --noEmit',
  ...overrides,
})

test('every declared script that terminates is a check', () => {
  assert.deepEqual(runnableScripts(getAppScripts()), ['build', 'test', 'lint', 'typecheck'])
})

test('scripts that never terminate are not checks', () => {
  const scripts = { dev: 'vite', preview: 'vite preview', start: 'serve', serve: 'http-server' }

  assert.deepEqual(runnableScripts(scripts), [])
})

test('watch-mode variants are not checks', () => {
  const scripts = { test: 'vitest run', 'test:watch': 'vitest', 'watch:css': 'tailwind -w' }

  assert.deepEqual(runnableScripts(scripts), ['test'])
})

test('the gate never runs itself', () => {
  const scripts = { verify: 'node scripts/verify.mjs', lint: 'oxlint' }

  assert.deepEqual(runnableScripts(scripts), ['lint'])
})

test('the gate recognises itself under any script name', () => {
  const scripts = { 'check:all': 'node ./scripts/verify.mjs --install' }

  assert.deepEqual(runnableScripts(scripts), [])
})

test('a workspace declaring no scripts contributes no checks', () => {
  assert.deepEqual(runnableScripts({}), [])
})

const getWorkspaces = () => [
  { dir: 'app', scripts: getAppScripts() },
  { dir: 'mockup', scripts: { dev: 'vite', build: 'vite build', lint: 'oxlint' } },
]

const entryFor = (plan, dir, script) =>
  plan.find((check) => check.dir === dir && check.script === script)

test('a declared script is planned as a run', () => {
  const plan = planChecks(getWorkspaces())

  assert.equal(entryFor(plan, 'mockup', 'lint').action, 'run')
})

test('a workspace with no test runner is skipped, with the reason', () => {
  const plan = planChecks(getWorkspaces())
  const skipped = entryFor(plan, 'mockup', 'test')

  assert.equal(skipped.action, 'skip')
  assert.equal(skipped.reason, 'no "test" script declared in mockup/package.json')
})

test('a capability no workspace has is never mentioned', () => {
  const plan = planChecks(getWorkspaces())

  assert.deepEqual(
    plan.filter((check) => ['e2e', 'deploy', 'backend'].includes(check.script)),
    [],
  )
})

test('a check one workspace gains is demanded of the others', () => {
  const withE2e = [...getWorkspaces(), { dir: 'harness', scripts: { e2e: 'playwright test' } }]

  const plan = planChecks(withE2e)

  assert.equal(entryFor(plan, 'harness', 'e2e').action, 'run')
  assert.equal(entryFor(plan, 'app', 'e2e').action, 'skip')
  assert.equal(entryFor(plan, 'mockup', 'e2e').reason, 'no "e2e" script declared in mockup/package.json')
})

test('a non-terminating script is not a check any workspace is asked for', () => {
  const plan = planChecks(getWorkspaces())

  assert.deepEqual(
    plan.filter((check) => check.script === 'dev'),
    [],
  )
})

test('the repo root names its own package.json in a skip reason', () => {
  const plan = planChecks([
    { dir: '.', scripts: { test: 'node --test' } },
    { dir: 'app', scripts: { lint: 'oxlint' } },
  ])

  assert.equal(entryFor(plan, '.', 'lint').reason, 'no "lint" script declared in package.json')
})
