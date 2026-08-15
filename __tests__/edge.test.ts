import { createSuite } from './suite'
import { expect, test } from 'vitest'
import { KIND } from '../src/node'
import { array, discriminatedUnion, partial, record, required, tuple, union } from '../src/compose'
import { literal } from '../src/leaf'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { boolean } from '../src/leaf'
import { string } from '../src/leaf'
import { render } from './render'

// 注：循环引用（JSON 无法表达，用哨兵 'CIRCULAR' 在测内构造）。

const snapshotSuite = createSuite(import.meta.dirname)

test('optional marker collisions fail before validation', () => {
    const shape = { x: string, 'x?': number }
    expect(() => safeParse(shape, { x: 'a' })).toThrow('duplicate field after optional marker: "x"')
    expect(() => partial(shape)).toThrow('duplicate field after optional marker: "x"')
    expect(() => required(shape)).toThrow('duplicate field after optional marker: "x"')
})

test('required fields only accept own properties', () => {
    const result = safeParse({ constructor: string }, {})
    expect(result.success).toBe(false)
    if (!result.success)
        expect(result.error.issues[0]?.message).toBe('missing required key')
})

test('discriminated unions reject duplicate tags', () => {
    expect(() => discriminatedUnion('type',
        { type: literal('same'), x: number },
        { type: literal('same'), y: number },
    )).toThrow('duplicate discriminator value "same"')
})

// ── 分支洞：防御性路径（商业级库必须钉死「非法输入必爆/必报」）──────────────

// 空 union：无 member 可匹配 → walker 119 'no union member matched'。
snapshotSuite<{ data: unknown }>('union-empty', ({ data }) => render(safeParse(union(), data)))

// 非法 KIND 的伪 schema → walker 185 抛 'unhandled kind'。契约：坏 schema 必爆，不静默吞。
snapshotSuite<{ data: unknown }>('unhandled-kind', ({ data }) => {
    const fake = Object.freeze({ [KIND]: 'bogus-kind' })
    try {
        safeParse(fake as never, data)
        return 'NO THROW'
    }
    catch (e) {
        return (e as Error).message
    }
})

// discriminatedUnion 成员缺 literal 判别字段 → 构造期 composite 48 抛错。
snapshotSuite<{ data: unknown }>('discriminated-bad-member', () => {
    try {
        discriminatedUnion('type', { type: string, x: number } as never)
        return 'NO THROW'
    }
    catch (e) {
        return (e as Error).message
    }
})

// uuid 连字符位错（第 8 位非 `-`，长度仍 36）→ string 99 false 分支。
snapshotSuite<{ data: unknown }>('uuid-hyphen-misplaced', ({ data }) => render(safeParse(string.uuid(), data)))

// datetime 各结构位错（长度够 19 但分隔符位不对）→ string 114 false 分支。
snapshotSuite<{ data: unknown }>('datetime-structure', ({ data }) => render(safeParse(string.datetime(), data)))

// ── 对抗性安全：原型污染（命脉，zod 也专门防）────────────────────────────

// data 含 __proto__/constructor key（JSON.parse 产 own key）→ 当普通字段校验，
// 绝不污染 Object.prototype。record 把它当 number 校验。
snapshotSuite<{ data: unknown }>('proto-pollution-record', ({ data }) => {
    const r = render(safeParse(record(number), data))
    // 验证全局原型未被污染（污染了则 polluted 可见）。
    const clean = (Object.prototype as Record<string, unknown>).polluted === undefined
    return `${r}\nprototype-clean: ${clean}`
})

// Object.create(null)（无原型）作 record 输入 → isPlainObject 应认（proto===null 分支）。
snapshotSuite<{ data: unknown }>('null-proto-object', ({ data }) => {
    const bare = Object.create(null) as Record<string, unknown>
    if (data && typeof data === 'object')
        Object.assign(bare, data)
    return render(safeParse(record(number), bare))
})

// 类实例（非字面量对象）作 shape 输入 → isPlainObject 拒（proto 非 Object.prototype）。
snapshotSuite<{ data: unknown }>('class-instance-shape', () => {
    class Box {
        x = 1
    }
    return render(safeParse({ x: number }, new Box()))
})

// ── 对抗性边界值：特殊数值 / 空值 / 类型混淆 ────────────────────────────

// number 对 Infinity/-Infinity/NaN（NaN 走 typeof number 特化消息）。
snapshotSuite<{ data: unknown }>('number-infinity', ({ data }) =>
    render(safeParse(number, data === 'INF' ? Infinity : data === '-INF' ? -Infinity : data === 'NAN' ? Number.NaN : data)))

// 数组喂给对象 shape（Array.isArray 在 isPlainObject 里拒）。
snapshotSuite<{ data: unknown }>('array-as-object', ({ data }) => render(safeParse({ a: number }, data)))

// null vs undefined vs 缺 key 在对象里的区分：null 是 present-but-wrong，undefined/缺是 missing。
snapshotSuite<{ data: unknown }>('null-vs-missing', ({ data }) => render(safeParse({ name: string }, data)))

// 深嵌套（5 层）+ 底层类型错 → path 必须精确指到底。
const Deep = { a: { b: { c: { d: { e: number } } } } }
snapshotSuite<{ data: unknown }>('deep-nested-path', ({ data }) => render(safeParse(Deep, data)))

// 数组里多个元素分别出错 → 全收集，path 带各自下标。
snapshotSuite<{ data: unknown }>('array-multi-error', ({ data }) => render(safeParse(array(number), data)))

// tuple 长度不符（短/长）→ 型错，不逐元素报。
snapshotSuite<{ data: unknown }>('tuple-length-mismatch', ({ data }) => render(safeParse(tuple(string, number, boolean), data)))

// 嵌套 record(array(record)) — 三层复合，深层错 path 完整。
snapshotSuite<{ data: unknown }>('nested-composite', ({ data }) => render(safeParse(record(array(record(number))), data)))

// union 全败：报 issue 最少那支（best-match）；此处两支都是 shape，错落在各自字段。
const UnionShapes = union({ kind: literal('a'), x: number }, { kind: literal('b'), y: string })
snapshotSuite<{ data: unknown }>('union-shapes-allfail', ({ data }) => render(safeParse(UnionShapes, data)))

// 循环引用（DoS 健壮性契约）：walker 按 schema 结构遍历非按 data 图，故 self-ref 当普通对象值
// 喂给 record(number) → 型错，不爆栈不死循环。JSON 无法表达环 → 哨兵在测内构造。
snapshotSuite<{ data: unknown }>('circular-data', ({ data }) => {
    if (data !== 'CIRCULAR')
        return 'sentinel-only'
    const a: Record<string, unknown> = {}
    a.self = a
    return render(safeParse(record(number), a))
})

// Unicode 长度语义：.min/.max 数 UTF-16 code unit（String.length），故 emoji '😀'=2。
// 钉这个契约，用户必须知道 emoji 算 2（非 1 code point）。min(2) 过、max(1) 败。
snapshotSuite<{ data: unknown }>('unicode-length', ({ data }) => {
    const s = data === 'EMOJI' ? '😀' : String(data)
    return `${render(safeParse(string.min(2), s))} | ${render(safeParse(string.max(1), s))}`
})
