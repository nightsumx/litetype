---
title: Zod → litetype
description: Jobs, not methods. Do not copy z.object.
---

# Coming from Zod

Map jobs. Do not translate the Zod method table line by line.

```ts
// Zod
const User = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
})
type User = z.infer<typeof User>
User.parse(data)

// litetype
const User = {
  name: string.min(1),
  'email?': string.email(),
}
type User = Infer<typeof User>
parse(User, data)
```

| job | Zod | litetype |
|---|---|---|
| object | `z.object({…})` | `{…}` |
| optional key | `.optional()` | `"key?"` |
| value may be undefined | `.optional()` | `.undefinable()` (key still required) |
| extend / pick / omit | `.extend` `.pick` `.omit` | spread / pick / rest |
| infer | `z.infer` | `Infer` |
| validate | `.parse` / `.safeParse` | `parse` / `safeParse` / `check` |
| reject extra keys | `.strict()` | `strict(shape)` |
| drop extra keys | **default** | `strip(shape)` (default: pass through) |
| empty string → missing | `preprocess` | same name |
| coerce | `z.coerce.number()` | `coerce.number()` |
| object refinement | `.refine()` | `refine(shape, pred, message)` |
| tRPC / RHF | `~standard` built in | wrap once at the export: `standard(User)` |

Keep schemas bare inside the file. Wrap only at the export:

```ts
export const User = { name: string.min(1), 'email?': string.email() }
export const UserIn = standard(User)
t.procedure.input(UserIn)
```

React Hook Form and Hono also consume the same wrapper through `@hookform/resolvers/standard-schema` and `@hono/standard-validator`; litetype-specific adapters are unnecessary.

Do not port these: `.and` → spread; `.trim` / `.brand` → `transform`; error maps → project `issue.code`; `z.map` / `z.set` / `z.promise` → skip.
