# litetype

[![npm](https://img.shields.io/npm/v/litetype)](https://www.npmjs.com/package/litetype)
[![CI](https://github.com/nightsumx/litetype/actions/workflows/ci.yml/badge.svg)](https://github.com/nightsumx/litetype/actions/workflows/ci.yml)

**A literal is a schema.** Zod adds three layers of noise: `z.`, `.object()`, `.optional()`. Here the schema is lazy bare data and the verbs are free functions. Write it like an interface. Compose it like JS.

```ts
import { string, number, type Infer, parse } from 'litetype'

const User = {
  name: string.min(1),
  age: number.min(0),
  'email?': string.email(),
}
type User = Infer<typeof User>
// { name: string; age: number; email?: string }

parse(User, { name: 'Ann', age: 3 })
```

```sh
npm i litetype
```

## Three things, separate

| | |
|---|---|
| value | `const User = { name: string, 'email?': string }` |
| type | `type User = Infer<typeof User>` |
| check | `parse` / `safeParse` / `check` |

A schema is data. Spread is extend. Pick fields by hand. Rest-destructure is omit. `'email?'` stays optional through all of that.

```ts
import { string, number, date } from 'litetype'

const User = { name: string, age: number, 'email?': string.email() }
const Timestamps = { createdAt: date, 'deletedAt?': date }

const Post = { title: string, ...Timestamps }
const Public = { name: User.name, 'email?': User['email?'] }
const { age: _, ...NoAge } = User
```

## Check

```ts
import { string, parse, safeParse, check, flatten } from 'litetype'

const User = { name: string.min(1) }
const input: unknown = { name: 'Ann' }

parse(User, input)                 // { name: 'Ann' }
const r = safeParse(User, input)   // { success, data } | { success, error }
if (check(User, input)) input.name

if (!r.success) flatten(r.error)   // { formErrors, fieldErrors }
```

`parse` collects every issue in the tree. Each one is `{ path, message, code }`.

Extra keys pass through (same object, no copy). Drop them with `strip`, reject them with `strict`:

```ts
import { strip, strict, parse, string } from 'litetype'

parse(strip({ name: string }), { name: 'Ann', role: 'x' })
// { name: 'Ann' }

parse(strict({ name: string }), { name: 'Ann', role: 'x' })
// throws: role unexpected key
```

Forms send strings. Map first, then check:

```ts
import { preprocess, coerce, string, number, parse } from 'litetype'

parse(preprocess(v => v === '' ? undefined : v, string.undefinable()), '')
// undefined

parse(coerce.number(), '42')
// 42
```

Cross-field checks use the same free-function shape:

```ts
import { refine, string } from 'litetype'

const Signup = refine({
  password: string.min(8),
  confirm: string,
}, value => value.password === value.confirm, 'passwords do not match')
```

JSON Schema is a subpath — it does not land in the main import:

```ts
import { fromJsonSchema, toJsonSchema } from 'litetype/jsonschema'
```

Dictionary: [docs/api.md](https://github.com/nightsumx/litetype/blob/main/docs/api.md). Coming from Zod: [docs/zod.md](https://github.com/nightsumx/litetype/blob/main/docs/zod.md).

## Ecosystem

Wrap a bare schema once with `standard` for tools that accept [Standard Schema](https://github.com/standard-schema/standard-schema). No framework adapter is required.

```ts
// tRPC
import { initTRPC } from '@trpc/server'
import { standard, string } from 'litetype'

const t = initTRPC.create()
const input = standard({ name: string.min(1) })
export const router = t.router({
  user: t.procedure.input(input).query(({ input }) => input),
})
```

```ts
// React Hook Form
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { standard, string } from 'litetype'

const User = { name: string.min(1), 'email?': string.email() }

export function useUserForm() {
  return useForm({ resolver: standardSchemaResolver(standard(User)) })
}
```

```ts
// Hono
import { sValidator } from '@hono/standard-validator'
import { Hono } from 'hono'
import { standard, string } from 'litetype'

const app = new Hono()
const User = standard({ name: string.min(1) })

app.post('/users', sValidator('json', User), c =>
  c.json(c.req.valid('json')))
```

## vs Zod

| job | Zod | litetype |
|---|---|---|
| object | `z.object({…})` | `{…}` |
| optional key | `.optional()` | `'key?'` |
| value may be undefined | `.optional()` | `.undefinable()` (key still required) |
| extend / pick / omit | `.extend` `.pick` `.omit` | spread / pick / rest |
| infer | `z.infer` | `Infer` |
| validate | `.parse` / `.safeParse` | `parse` / `safeParse` / `check` |
| reject extra keys | `.strict()` | `strict(shape)` |
| drop extra keys | **default** | `strip(shape)` (default: pass through) |
| empty string → missing | `preprocess` | same name |
| coerce | `z.coerce.number()` | `coerce.number()` |
| cross-field check | `.refine()` | `refine(shape, pred, message)` |
| tRPC / RHF | `~standard` built in | wrap once at the export: `standard(User)` |

## Edges

- A trailing `?` on a schema key is always the optional marker; required data keys ending in `?` are unsupported.
- `lazy` does not guard cyclic **data** (same as Zod).
- `toJsonSchema` will not serialize `transform` / `refine` / `preprocess`.
- `number` accepts `Infinity`. Exclude it with `.finite()`.
- `coerce.boolean` only accepts `'true'` / `'false'`.

Zero runtime dependencies. MIT.
