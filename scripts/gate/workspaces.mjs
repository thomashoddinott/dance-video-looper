import { join } from 'node:path'

const isSearchable = (name) => !name.startsWith('.') && name !== 'node_modules'

export const findWorkspaces = (io, dir = '.') => {
  const pkg = io.readPackageJson(dir)
  const here = pkg ? [{ dir, scripts: pkg.scripts ?? {} }] : []

  const nested = io
    .listDirs(dir)
    .filter(isSearchable)
    .map((child) => join(dir, child))
    .filter((path) => !io.isIgnored(path))
    .flatMap((path) => findWorkspaces(io, path))

  return [...here, ...nested]
}
