const ran = (results) => results.filter(({ action }) => action === 'run')

const skipped = (results) => results.filter(({ action }) => action === 'skip')

const failures = (results) => ran(results).filter(({ passed }) => !passed)

export const verdict = (results) => (failures(results).length === 0 ? 'PASS' : 'FAIL')

const outcomeOf = ({ action, passed }) => {
  if (action === 'skip') return 'SKIP'
  return passed ? 'PASS' : 'FAIL'
}

const widthOf = (values) => Math.max(...values.map(({ length }) => length), 0)

const lineFor = (result, dirWidth, scriptWidth) => {
  const columns = `${result.dir.padEnd(dirWidth)}  ${result.script.padEnd(scriptWidth)}  ${outcomeOf(result)}`
  return result.action === 'skip' ? `${columns}  — ${result.reason}` : columns
}

const summaryOf = (results) => {
  const runCount = ran(results).length
  const failCount = failures(results).length
  const outcome =
    failCount === 0 ? `${runCount} checks ran, all green` : `${failCount} of ${runCount} failed`

  return `GATE: ${verdict(results)} — ${outcome}; ${skipped(results).length} skipped`
}

export const formatReport = (results) => {
  const dirWidth = widthOf(results.map(({ dir }) => dir))
  const scriptWidth = widthOf(results.map(({ script }) => script))
  const lines = results.map((result) => lineFor(result, dirWidth, scriptWidth))

  return [...lines, '', summaryOf(results)].join('\n')
}
