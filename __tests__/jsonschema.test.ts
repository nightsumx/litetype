import { createSuite } from './suite'
import { expect, test } from 'vitest'
import { KIND } from '../src/node'
import { coerce } from '../src/compose'
import { array, discriminatedUnion, lazy, record, tuple, union } from '../src/compose'
import { describe } from '../src/compose'
import { fromJsonSchema, toJsonSchema } from '../src/jsonschema'
import { enum_, literal } from '../src/leaf'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { boolean, date, unknown } from '../src/leaf'
import { strict } from '../src/compose'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

test('required JSON Schema properties ending in ? are rejected', () => {
    expect(() => fromJsonSchema({
        type: 'object',
        properties: { 'name?': { type: 'string' } },
        required: ['name?'],
    })).toThrow('unsupported required property ending in ?: "name?"')
})

test('optional marker collisions cannot serialize', () => {
    expect(() => toJsonSchema({ x: string, 'x?': number })).toThrow('duplicate field after optional marker: "x"')
})

// fromJsonSchema：in.json = { doc, data } —— 把 doc 翻成 schema 再 parse data，钉 round-trip。
snapshotSuite<{ doc: any, data: unknown }>('jsonschema-from', ({ doc, data }) =>
    render(safeParse(fromJsonSchema(doc) as any, data)))

// fromJsonSchema 抛错分支：unsupported / unresolved $ref，钉错误消息。
snapshotSuite<{ doc: any }>('jsonschema-from-throws', ({ doc }) => {
    try {
        fromJsonSchema(doc)
        return 'NO THROW'
    }
    catch (e) {
        return (e as Error).message
    }
})

// toJsonSchema：每个结构分支单独建 schema，钉产出文档结构（覆盖 leaf/literal/enum/array/tuple/record/union/discriminated/strict/nullable/lazy）。
const cases: Record<string, unknown> = {
    'object-optional': { "id": string, 'nick?': string, "age": number, "tags": array(string), "kind": literal('user') },
    'tuple': tuple(string, number),
    'record': record(number),
    'union': union(string, number),
    'enum': enum_(['a', 'b']),
    'discriminated': discriminatedUnion('type', { type: literal('a'), x: number }, { type: literal('b'), y: string }),
    'strict': strict({ "name": string, 'age?': number }),
    'nullable': { v: string.nullable() },
    'boolean-date': { flag: boolean, when: number.nullable() },
    'lazy': lazy(() => ({ id: string })),
    'optional': { v: string.undefinable() }, // 顶层 undefinable/default 解到 inner 的 type（key 可选性走 required 不在此）
    'default': { v: string.default('x') },
    'date': { ts: date }, // date leaf → {type:'string',format:'date-time'}
    'unknown-field': { id: string, payload: unknown }, // unknown → 空 schema {}（任意值，OpenAPI 无 type 字段）
    'nullable-no-type': { v: union(string, number).nullable() }, // inner 无 type（anyOf）→ nullable 退化纯 'null'
    'nullable-of-nullable': { v: string.nullable().nullable() }, // inner.type 已是数组 → 追加 'null' 走 Array.isArray 分支
    'describe-leaf': describe(string, 'the user query'), // describe → inner type + description（模型/OpenAPI 需要）
    'describe-shape-field': { q: describe(string, 'search query'), 'n?': describe(number, 'max results') }, // 字段级描述
    'describe-nested': describe(array(describe(number, 'a score')), 'list of scores'), // 嵌套：内外各挂描述
    // check.meta 反读：JSON-Schema-可表达约束折出关键字（破 Phase-3「约束不可反读」边界）。
    'string-constraints': { id: string.uuid(), name: string.min(1).max(20), site: string.url(), when: string.datetime(), code: string.regex(/[a-z]+/) },
    // startsWith 无标准关键字 → 不反读（仍只产 type:'string'，不谎报）；email format。
    'string-no-keyword': { tag: string.startsWith('x_').email() },
    // int 的 type:'integer' 覆写 base type:'number'；min/max/multipleOf/positive 折出。
    'number-constraints': { age: number.int().min(0).max(120), ratio: number.positive().multipleOf(0.5), n: number.nonnegative() },
}
snapshotSuite<{ data: string }>('jsonschema-to', ({ data }) => JSON.stringify(toJsonSchema(cases[data] as any)))

// toJsonSchema 抛错分支：transform/refine/coerce 不可序列化，钉错误消息。
const throwCases: Record<string, unknown> = {
    'transform': string.transform(s => s.length),
    'refine': string.refine(s => s.length > 0, 'non-empty'),
    'coerce': coerce.number(),
    'bogus-kind': Object.freeze({ [KIND]: 'bogus-kind' }), // 伪 KIND → serialize default 抛，坏 schema 不静默
}
snapshotSuite<{ data: string }>('jsonschema-to-throws', ({ data }) => {
    try {
        toJsonSchema(throwCases[data] as any)
        return 'NO THROW'
    }
    catch (e) {
        return (e as Error).message
    }
})

// 约束往返：schema → toJsonSchema → fromJsonSchema 重建的 schema 必须仍 enforce 同样的约束。
// 这是 check.meta 反读的真收益锚 —— 反读出的关键字被 fromJsonSchema 再吃回，违例数据照样拒。
// in.json = { schema: cases 名, data: 待校验输入 }；输出渲染重建 schema 对 data 的 safeParse 结果。
snapshotSuite<{ schema: string, data: unknown }>('jsonschema-roundtrip', ({ schema, data }) => {
    const rebuilt = fromJsonSchema(toJsonSchema(cases[schema] as any))
    return render(safeParse(rebuilt as any, data))
})
