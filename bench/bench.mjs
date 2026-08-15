import {
  array,
  compile as ltCompile,
  discriminatedUnion,
  literal,
  number,
  refine,
  safeParse as ltSafeParse,
  string,
} from '../dist/index.js'
import { type } from 'arktype'
import Ajv from 'ajv'
import { z } from 'zod'

const inputCount = 1024
const flatValid = Array.from({ length: inputCount }, (_, i) => ({ name: `Ada-${i}`, email: `ada-${i}@example.com`, city: `city-${i}`, age: i }))
const flatInvalid = flatValid.map(value => ({ ...value, age: String(value.age) }))
const nestedValid = Array.from({ length: inputCount }, (_, i) => ({
  id: i,
  title: `list-${i}`,
  items: Array.from({ length: 10 }, (_, id) => ({ id: i + id, label: `item-${i}-${id}` })),
}))
const nestedInvalid = nestedValid.map(value => ({
  ...value,
  items: [...value.items.slice(0, 9), { id: 'bad', label: 9 }],
}))
const unionValid = Array.from({ length: inputCount }, (_, i) => ({ kind: 'b', value: i }))
const unionInvalid = Array.from({ length: inputCount }, () => ({ kind: 'b', value: false }))
const signupValid = Array.from({ length: inputCount }, (_, i) => ({ password: `abcdefgh-${i}`, confirm: `abcdefgh-${i}` }))
const signupInvalid = Array.from({ length: inputCount }, (_, i) => ({ password: `abcdefgh-${i}`, confirm: `abcdefghi-${i}` }))

const ltFlat = { name: string, email: string, city: string, age: number }
const zFlat = z.object({ name: z.string(), email: z.string(), city: z.string(), age: z.number() })
const aFlat = type({ name: 'string', email: 'string', city: 'string', age: 'number' })

const ltItem = { id: number, label: string }
const ltNested = { id: number, title: string, items: array(ltItem) }
const zItem = z.object({ id: z.number(), label: z.string() })
const zNested = z.object({ id: z.number(), title: z.string(), items: z.array(zItem) })
const aItem = type({ id: 'number', label: 'string' })
const aNested = type({ id: 'number', title: 'string', items: aItem.array() })

const ltUnion = discriminatedUnion(
  'kind',
  { kind: literal('a'), value: string },
  { kind: literal('b'), value: number },
)
const zUnion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('a'), value: z.string() }),
  z.object({ kind: z.literal('b'), value: z.number() }),
])
const aUnion = type({ kind: "'a'", value: 'string' }).or({ kind: "'b'", value: 'number' })

const ltSignup = refine(
  { password: string.min(8), confirm: string },
  value => value.password === value.confirm,
  'passwords do not match',
)
const zSignup = z.object({ password: z.string().min(8), confirm: z.string() }).refine(
  value => value.password === value.confirm,
  'passwords do not match',
)
const aSignup = type({ password: 'string>=8', confirm: 'string' }).narrow(
  value => value.password === value.confirm,
)

const flatJsonSchema = () => ({
  type: 'object',
  properties: {
    name: { type: 'string' },
    email: { type: 'string' },
    city: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'email', 'city', 'age'],
})
const nestedJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'number' }, label: { type: 'string' } },
        required: ['id', 'label'],
      },
    },
  },
  required: ['id', 'title', 'items'],
}
const unionJsonSchema = {
  type: 'object',
  discriminator: { propertyName: 'kind' },
  required: ['kind'],
  oneOf: [
    {
      properties: { kind: { const: 'a' }, value: { type: 'string' } },
      required: ['kind', 'value'],
    },
    {
      properties: { kind: { const: 'b' }, value: { type: 'number' } },
      required: ['kind', 'value'],
    },
  ],
}
const signupJsonSchema = {
  type: 'object',
  properties: {
    password: { type: 'string', minLength: 8 },
    confirm: { const: { $data: '1/password' } },
  },
  required: ['password', 'confirm'],
}
const ajv = new Ajv({ allErrors: true, discriminator: true, $data: true, strict: false })
const ajvOwn = new Ajv({ allErrors: true, discriminator: true, $data: true, strict: false, ownProperties: true })
const ajvFlat = ajv.compile(flatJsonSchema())
const ajvNested = ajv.compile(nestedJsonSchema)
const ajvUnion = ajv.compile(unionJsonSchema)
const ajvSignup = ajv.compile(signupJsonSchema)
const ajvOwnFlat = ajvOwn.compile(flatJsonSchema())
const ajvOwnNested = ajvOwn.compile(nestedJsonSchema)
const ajvOwnUnion = ajvOwn.compile(unionJsonSchema)
const ajvOwnSignup = ajvOwn.compile(signupJsonSchema)

const libs = {
  litetype: {
    flat: value => ltSafeParse(ltFlat, value).success,
    nested: value => ltSafeParse(ltNested, value).success,
    union: value => ltSafeParse(ltUnion, value).success,
    signup: value => ltSafeParse(ltSignup, value).success,
    check: ltCompile(ltFlat),
  },
  zod: {
    flat: value => zFlat.safeParse(value).success,
    nested: value => zNested.safeParse(value).success,
    union: value => zUnion.safeParse(value).success,
    signup: value => zSignup.safeParse(value).success,
    check: value => zFlat.safeParse(value).success,
  },
  ajv: {
    flat: value => ajvFlat(value),
    nested: value => ajvNested(value),
    union: value => ajvUnion(value),
    signup: value => ajvSignup(value),
    check: value => ajvFlat(value),
  },
  'ajv own': {
    flat: value => ajvOwnFlat(value),
    nested: value => ajvOwnNested(value),
    union: value => ajvOwnUnion(value),
    signup: value => ajvOwnSignup(value),
    check: value => ajvOwnFlat(value),
  },
  arktype: {
    flat: value => !(aFlat(value) instanceof type.errors),
    nested: value => !(aNested(value) instanceof type.errors),
    union: value => !(aUnion(value) instanceof type.errors),
    signup: value => !(aSignup(value) instanceof type.errors),
    check: value => aFlat.allows(value),
  },
}

const cases = [
  ['flat valid', 'flat', flatValid, true, 500_000],
  ['flat invalid', 'flat', flatInvalid, false, 150_000],
  ['nested x10 valid', 'nested', nestedValid, true, 150_000],
  ['nested x10 invalid', 'nested', nestedInvalid, false, 80_000],
  ['discriminated union valid', 'union', unionValid, true, 300_000],
  ['discriminated union invalid', 'union', unionInvalid, false, 100_000],
  ['cross-field refine valid', 'signup', signupValid, true, 300_000],
  ['cross-field refine invalid', 'signup', signupInvalid, false, 100_000],
  ['predicate/check valid', 'check', flatValid, true, 500_000],
]

const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const measure = (fn, inputs, iterations) => {
  let sink = 0
  for (let i = 0; i < Math.min(iterations, 50_000); i++) sink += fn(inputs[i & (inputCount - 1)]) ? 1 : 0
  const samples = []
  for (let sample = 0; sample < 7; sample++) {
    const started = performance.now()
    for (let i = 0; i < iterations; i++) sink += fn(inputs[i & (inputCount - 1)]) ? 1 : 0
    samples.push(performance.now() - started)
  }
  if (sink === Number.MIN_SAFE_INTEGER) console.log(sink)
  const ms = median(samples)
  return {
    ops: iterations * 1000 / ms,
    ns: ms * 1_000_000 / iterations,
    spread: (Math.max(...samples) - Math.min(...samples)) / ms,
  }
}

for (const [name, method, inputs, expected] of cases) {
  for (const [lib, adapter] of Object.entries(libs)) {
    const actual = adapter[method](inputs[0])
    if (actual !== expected) throw new Error(`${name}: ${lib} returned ${actual}`)
  }
}

const results = []
for (const [name, method, inputs, , iterations] of cases) {
  const row = { case: name }
  for (const [lib, adapter] of Object.entries(libs)) row[lib] = measure(adapter[method], inputs, iterations)
  results.push(row)
}

const builders = {
  litetype: () => ltCompile({ name: string, email: string, city: string, age: number }),
  zod: () => z.object({ name: z.string(), email: z.string(), city: z.string(), age: z.number() }),
  ajv: () => ajv.compile(flatJsonSchema()),
  arktype: () => type({ name: 'string', email: 'string', city: 'string', age: 'number' }),
}
const measureConstruction = fn => {
  const samples = []
  for (let sample = 0; sample < 5; sample++) {
    const built = []
    const started = performance.now()
    for (let i = 0; i < 500; i++) built.push(fn())
    samples.push(performance.now() - started)
    if (built.length !== 500) throw new Error('construction result lost')
  }
  const ms = median(samples)
  return { ops: 500_000 / ms, ns: ms * 2_000 }
}
const construction = {}
for (const [lib, build] of Object.entries(builders)) construction[lib] = measureConstruction(build)

console.log(JSON.stringify({
  runtime: process.version,
  platform: `${process.platform}-${process.arch}`,
  versions: {
    litetype: '0.3.1',
    zod: '4.4.3',
    ajv: '8.20.0',
    arktype: '2.2.3',
  },
  results,
  construction,
}, null, 2))
