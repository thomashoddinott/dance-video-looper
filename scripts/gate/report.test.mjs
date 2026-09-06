import { test } from 'node:test'
import assert from 'node:assert/strict'

import { formatReport, verdict } from './report.mjs'

const getResults = (overrides = []) => [
  { dir: 'app', script: 'test', action: 'run', passed: true },
  { dir: 'app', script: 'lint', action: 'run', passed: true },
  { dir: 'mockup', script: 'lint', action: 'run', passed: true },
  { dir: 'mockup', script: 'test', action: 'skip', reason: 'no "test" script declared in mockup/package.json' },
  ...overrides,
]

const failing = { dir: 'app', script: 'build', action: 'run', passed: false }

test('the gate passes when every check that ran passed', () => {
  assert.equal(verdict(getResults()), 'PASS')
})

test('one failing check fails the whole gate', () => {
  assert.equal(verdict(getResults([failing])), 'FAIL')
})

test('a skip alone never fails the gate', () => {
  const onlySkips = [
    { dir: 'mockup', script: 'test', action: 'skip', reason: 'no "test" script declared in mockup/package.json' },
  ]

  assert.equal(verdict(onlySkips), 'PASS')
})

test('every check that ran is named with its result', () => {
  const report = formatReport(getResults([failing]))

  assert.match(report, /app\s+test\s+PASS/)
  assert.match(report, /app\s+build\s+FAIL/)
  assert.match(report, /mockup\s+lint\s+PASS/)
})

test('a skipped check is named with its reason, not omitted', () => {
  const report = formatReport(getResults())

  assert.match(report, /mockup\s+test\s+SKIP/)
  assert.match(report, /no "test" script declared in mockup\/package\.json/)
})

test('the summary counts what ran separately from what was skipped', () => {
  const report = formatReport(getResults())

  assert.match(report, /GATE: PASS/)
  assert.match(report, /3 checks ran/)
  assert.match(report, /1 skipped/)
})

test('the summary reports how many checks failed', () => {
  const report = formatReport(getResults([failing]))

  assert.match(report, /GATE: FAIL/)
  assert.match(report, /1 of 4 failed/)
})
