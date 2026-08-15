---
title: litetype API
description: Dictionary. Narrative lives on the homepage.
---

# API

```sh
npm i litetype
```

```ts
import { string, number, parse } from 'litetype'
import { fromJsonSchema, toJsonSchema } from 'litetype/jsonschema'
```

`import 'litetype'` does not pull jsonschema.

## Verbs

| | |
|---|---|
| `parse(s, data)` | ok → `Infer<S>`; fail → throw `SchemaError` |
| `safeParse(s, data)` | `{ success, data }` / `{ success, error }` |
| `check(s, data)` | type guard |
| `compile(s)` | cached type guard for a hot loop |

Failure collects the whole tree. Each issue is `{ path, message, code }`.

```ts
import { string, parse, safeParse, check, compile } from 'litetype'

const Name = { name: string.min(1) }

parse(Name, { name: 'Ann' })
const r = safeParse(Name, { name: '' })
if (check(Name, input)) input.name
const allowsName = compile(Name)
if (allowsName(input)) input.name
```

All verbs compile a schema on first use. `compile` returns that same predicate so repeated
validation pays no schema-cache lookup. It reports only true/false; use `safeParse` for issues.

## Types

| | |
|---|---|
| `Infer<S>` | Output |
| `InferInput<S>` | Input (`transform` argument; `default` fields optional on the way in) |
| `Schema<O, I>` / `Shape` | node / bare object |

```ts
import { string, type Infer, type InferInput } from 'litetype'

const Len = string.transform(s => s.length)
type Out = Infer<typeof Len>        // number
type In  = InferInput<typeof Len>   // string
```

## Leaves

| | Infer |
|---|---|
| `string` | `string` |
| `number` | `number` (accepts `Infinity`; rejects `NaN`; drop infinities with `.finite()`) |
| `boolean` | `boolean` |
| `date` | `Date` (instance, not a string) |
| `unknown` | `unknown` |
| `literal(v)` | `v` |
| `enum_([...])` | union of the values |

| method | |
|---|---|
| `string.min/max/length(n, msg?)` | length |
| `string.email/url/uuid/datetime/ip(msg?)` | lexical; no regex |
| `string.startsWith/endsWith/includes(s, msg?)` | substring |
| `string.regex(re, msg?)` | only allowed regex: user's pattern vs user data |
| `number.min/max/gt/lt(n, msg?)` | range |
| `number.int/finite/positive/nonnegative(msg?)` | |
| `number.multipleOf(n, msg?)` | |
| `date.min/max(d, msg?)` | |

```ts
import { string, number, parse } from 'litetype'

parse(string.email(), 'a@b.co')
parse(number.int().min(0), 3)
```

## On every node

| | |
|---|---|
| `.transform(fn)` | map after validate; not called on failure |
| `.refine(pred, msg)` | predicate; type unchanged |
| `.default(v)` | fill when `undefined`; does not catch bad values |
| `.undefinable()` | allow `undefined` (key still required) |
| `.nullable()` | allow `null` |
| `.nullish()` | both |

Bare shapes have no methods — use `transform(shape, fn)`.

`'key?'` makes the key omitable. `.undefinable()` only widens the value.

```ts
import { string, parse } from 'litetype'

parse(string.default('user'), undefined)     // 'user'
parse(string.undefinable(), undefined)       // undefined

const A = { bio: string.undefinable() }      // { bio: string | undefined }
const B = { 'bio?': string }                 // { bio?: string }
```

## Free functions

| | |
|---|---|
| `array(T)` / `tuple(...)` / `union(...)` | |
| `record(V)` / `record(K, V)` | two-arg form also checks keys |
| `discriminatedUnion(key, ...shapes)` | each branch `key` must be `literal` |
| `lazy(() => S)` | recursion |
| `strict(shape)` | extra keys fail |
| `strip(shape)` | extra keys dropped |
| `partial` / `required` | add/remove `?` on every key; bare shapes only |
| `preprocess(fn, s)` | map before validate; `fn` throw → `custom` |
| `refine(s, pred, message)` | cross-field or whole-schema predicate |
| `coerce.number/boolean/date/string(inner?)` | four specializations of preprocess |
| `fallback(s, v)` | on failure, return `v` (`default` is missing; this is bad values) |
| `describe(s, text)` / `descriptionOf(s)` | metadata; check unchanged |
| `standard(s)` | wrap `~standard` at the ecosystem edge |
| `flatten` / `treeify` / `prettify` | accept `SchemaError` or `issues[]` |

```ts
import { array, discriminatedUnion, lazy, literal, number, parse, preprocess, refine, string } from 'litetype'

parse(array(string.min(1)), ['a', 'b'])

const Shape = discriminatedUnion('type',
  { type: literal('circle'), radius: number },
  { type: literal('square'), side: number },
)
parse(Shape, { type: 'circle', radius: 5 })

parse(preprocess(v => v === '' ? undefined : v, string.undefinable()), '')

const Signup = refine(
  { password: string.min(8), confirm: string },
  value => value.password === value.confirm,
  'passwords do not match',
)

const Tree = { value: string, 'children?': array(lazy(() => Tree)) }
```

`coerce.boolean` only accepts `'true'` / `'false'`.

## Errors

```ts
interface Issue {
  path: ReadonlyArray<PropertyKey>
  message: string
  code: IssueCode
}
```

`code`: `invalid_type` `invalid_value` `too_small` `too_big` `not_multiple_of` `invalid_string` `unrecognized_key` `invalid_union` `custom`.

```ts
import { flatten, prettify, safeParse, string } from 'litetype'

const r = safeParse({ name: string.min(2) }, { name: 'x' })
if (!r.success) {
  flatten(r.error)    // { formErrors: [], fieldErrors: { name: ['length must be >= 2'] } }
  prettify(r.error)   // ✖ length must be >= 2\n  → at name
}
```

## JSON Schema

```ts
import { fromJsonSchema, toJsonSchema } from 'litetype/jsonschema'
import { parse, string } from 'litetype'

const sch = fromJsonSchema({
  type: 'object',
  properties: { name: { type: 'string', minLength: 1 } },
  required: ['name'],
})
parse(sch, { name: 'Ann' })

toJsonSchema({ id: string.uuid() })
// { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] }
```

Does not serialize `transform` / `refine` / `preprocess`. Checks with no standard keyword (`startsWith`, …) are not read back. `fromJsonSchema` throws on `allOf` / `if-then` / `patternProperties`.
