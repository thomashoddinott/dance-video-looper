export const npmCommand = (dir, script) => ({
  command: 'npm',
  args: ['run', script],
  cwd: dir,
})

const declaresDependencies = ({ dependencies = {}, devDependencies = {} }) =>
  Object.keys(dependencies).length > 0 || Object.keys(devDependencies).length > 0

export const dependenciesMissing = ({ manifest, hasNodeModules }) =>
  declaresDependencies(manifest) && !hasNodeModules
