import { spawnSync } from 'node:child_process'

const result = spawnSync('./node_modules/.bin/tsc', [
  'bench/type-fixture.ts',
  '--noEmit',
  '--skipLibCheck',
  '--strict',
  '--module', 'ESNext',
  '--moduleResolution', 'bundler',
  '--target', 'ES2022',
  '--extendedDiagnostics',
], { encoding: 'utf8' })

if (result.status !== 0) {
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const line = result.stdout.split('\n').find(value => value.startsWith('Instantiations:'))
if (!line)
  throw new Error('TypeScript did not report instantiations')

const count = Number(line.slice(line.indexOf(':') + 1).trim())
const budget = 10_000
console.log(`Type instantiations: ${count.toLocaleString()} / ${budget.toLocaleString()}`)
if (count > budget)
  process.exit(1)
