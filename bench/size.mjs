import { brotliCompressSync, gzipSync } from 'node:zlib'
import Ajv from 'ajv'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { build } from 'esbuild'

const entries = {
  litetype: `
    import { number, safeParse, string } from 'litetype'
    const schema = { name: string, email: string, city: string, age: number }
    export const validate = value => safeParse(schema, value)
  `,
  zod: `
    import { z } from 'zod'
    const schema = z.object({ name: z.string(), email: z.string(), city: z.string(), age: z.number() })
    export const validate = value => schema.safeParse(value)
  `,
  ajv: `
    import Ajv from 'ajv'
    const ajv = new Ajv({ allErrors: true })
    export const validate = ajv.compile({
      type: 'object',
      properties: {
        name: { type: 'string' }, email: { type: 'string' },
        city: { type: 'string' }, age: { type: 'number' },
      },
      required: ['name', 'email', 'city', 'age'],
    })
  `,
  arktype: `
    import { type } from 'arktype'
    const schema = type({ name: 'string', email: 'string', city: 'string', age: 'number' })
    export const validate = value => schema(value)
  `,
}

const ajv = new Ajv({ allErrors: true, code: { source: true, esm: true } })
entries['ajv-standalone'] = standaloneCode(ajv, ajv.compile({
  type: 'object',
  properties: {
    name: { type: 'string' }, email: { type: 'string' },
    city: { type: 'string' }, age: { type: 'number' },
  },
  required: ['name', 'email', 'city', 'age'],
}))

const results = {}
for (const [name, source] of Object.entries(entries)) {
  const built = await build({
    stdin: { contents: source, resolveDir: process.cwd(), sourcefile: `${name}.mjs` },
    bundle: true,
    minify: true,
    treeShaking: true,
    platform: 'browser',
    format: 'esm',
    write: false,
  })
  const bytes = built.outputFiles[0].contents
  results[name] = {
    minified: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes).length,
  }
}

console.log(JSON.stringify(results, null, 2))
