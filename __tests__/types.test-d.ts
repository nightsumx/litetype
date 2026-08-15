// 编译期 Infer 断言。不进 vitest glob，由包自身 `tsc --noEmit`（include 含 __tests__）把关。
// 断言挂了即 build 红。这里钉死类型机的命脉，与运行时实现解耦：用 declare 的桩，桩类型
// 与最终导出完全一致，故既在 step 1 即可独立 gate，也随真实导出落地保持有效。

// 全部走真实导出 —— 断言钉死实际 API 的类型，任何签名漂移即 build 红。
import type { Infer, InferInput } from '../src/types'
import { coerce, preprocess, strip } from '../src/compose'
import { array, discriminatedUnion, lazy, record, tuple, union } from '../src/compose'
import { enum_, literal } from '../src/leaf'
import { number } from '../src/leaf'
import { boolean } from '../src/leaf'
import { partial, required } from '../src/compose'
import { strict } from '../src/compose'
import { string } from '../src/leaf'
import { refine, transform } from '../src/compose'
import { standard } from '../src/standard'

// --- 断言工具 ---
type Expect<T extends true> = T
// 强 Equal（<G>() 不变量技巧）：钉死「真可选 vs 假可选」这类可互相赋值但不同一的形态，
// 是 object/undefinable 断言的命脉。
type Equal<A, B> =
    (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false
// 双向可赋值（observable 等价）：用于映射元组在联合里展开的情形 —— 强 Equal 对
// mapped-tuple 的内部身份过度敏感（互相 extends 成立即用户代码里完全等价），用它避免假阴性。
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

// ===========================================================================
// 命脉 1：裸字面量 + "key?" → 真可选
// ===========================================================================
const User = {
    "name": string.min(1),
    "age": number,
    'email?': string.email(),
    'verified?': boolean,
}
type _User = Expect<Equal<Infer<typeof User>, {
    name: string
    age: number
    email?: string
    verified?: boolean
}>>

// 反证：必须 NOT 等于「假可选」形态（key 必填、值 | undefined）
type _NotFakeOptional = Expect<Equal<
    Equal<Infer<typeof User>, { name: string, age: number, email: string | undefined, verified: boolean | undefined }>,
    false
>>

// 真可选 → 可省略 key（默认 strict 下成立，无需 EOPT）
type U = Infer<typeof User>
const _omit: U = { name: 'a', age: 1 }
const _full: U = { name: 'a', age: 1, email: 'x@y.z', verified: true }
// @ts-expect-error name 必填，省略报错
const _missing: U = { age: 1 }

// ===========================================================================
// 命脉 2：链式 refinement 不污染推断类型
// ===========================================================================
const Refined = { name: string.min(1).max(100), age: number.int().min(0) }
type _Refined = Expect<Equal<Infer<typeof Refined>, { name: string, age: number }>>

// ===========================================================================
// 命脉 3：嵌套裸字面量
// ===========================================================================
const Team = { lead: { "name": string, 'nick?': string }, size: number }
type _Team = Expect<Equal<Infer<typeof Team>, {
    lead: { name: string, nick?: string }
    size: number
}>>

// ===========================================================================
// 命脉 4：spread 组合保留可选键判别
// ===========================================================================
const Timestamps = { "createdAt": number, 'deletedAt?': number }
const Post = { title: string, ...Timestamps }
type _Post = Expect<Equal<Infer<typeof Post>, {
    title: string
    createdAt: number
    deletedAt?: number
}>>

const Base = { role: string, name: string }
const Admin = { ...Base, role: literal('admin') }
type _Admin = Expect<Equal<Infer<typeof Admin>, { name: string, role: 'admin' }>>

// 裸字面量是普通 JS 对象 → TS 内置工具类型直接裁剪 schema（无需 .pick()/.omit()）。
// 关键：裁剪在 schema 层（值），Infer 仍正常工作，不触发递归陷阱。
const Full = { "id": string, "name": string, 'email?': string.email(), "secret": string }
const Public = { "id": Full.id, "name": Full.name, 'email?': Full['email?'] } // 手挑字段 = pick
type _Public = Expect<Equal<Infer<typeof Public>, { id: string, name: string, email?: string }>>

const { secret: _s, ...Safe } = Full // 解构剔除 = omit
type _Safe = Expect<Equal<Infer<typeof Safe>, { id: string, name: string, email?: string }>>

// ===========================================================================
// 命脉 5：复合类型推断
// ===========================================================================
// 通过真实工厂函数实例化（而非手填 readonly 接口参数）—— 工厂经 [...M] 推出可变元组，
// 与运行时一致；直接填 readonly 接口会得 readonly 元组，那不是库会产出的形态。
const _arr = array(string)
type _Arr = Expect<Equal<Infer<typeof _arr>, string[]>>
const _uni = union(literal('a'), literal('b'))
type _Union = Expect<Equal<Infer<typeof _uni>, 'a' | 'b'>>
const _tup = tuple(string, number)
type _Tuple = Expect<Equal<Infer<typeof _tup>, [string, number]>>
const _rec = record(number)
type _Record = Expect<Equal<Infer<typeof _rec>, Record<string, number>>>
const _en = enum_(['admin', 'user'])
type _Enum = Expect<Equal<Infer<typeof _en>, 'admin' | 'user'>>

// 判别联合 + 判别字段收窄
const Result = union(
    tuple(literal('ok'), string),
    tuple(literal('err'), string),
)
type _ResultIsTuple = Expect<Mutual<
    Infer<typeof Result>,
    ['ok', string] | ['err', string]
>>

// strict 类型透明：Infer<strict(S)> 与 Infer<S> 全等（多余 key 是运行时约束，不入类型）。
const _strict = strict({ "name": string, 'age?': number })
type _Strict = Expect<Equal<Infer<typeof _strict>, { name: string, age?: number }>>
const _strip = strip({ "name": string, 'age?': number })
type _Strip = Expect<Equal<Infer<typeof _strip>, { name: string, age?: number }>>

// ===========================================================================
// 命脉 6：transform 分叉 Output≠Input —— Infer 取 fn 返回类型，InferInput 贯穿到最内层 Input
// ===========================================================================
const _len = string.transform(s => s.length)
type _LenOut = Expect<Equal<Infer<typeof _len>, number>>
type _LenIn = Expect<Equal<InferInput<typeof _len>, string>>

// transform 嵌字段：对象 Infer 取该字段的 Output，InferInput 取 Input。
const _doc = { title: string.transform(s => s.length), tag: string }
type _DocOut = Expect<Equal<Infer<typeof _doc>, { title: number, tag: string }>>
type _DocIn = Expect<Equal<InferInput<typeof _doc>, { title: string, tag: string }>>

// 复合上的 transform：array<string> → string。
const _join = transform(array(string), xs => xs.join(','))
type _JoinOut = Expect<Equal<Infer<typeof _join>, string>>
type _JoinIn = Expect<Equal<InferInput<typeof _join>, string[]>>

const _lengths = array(string.transform(s => s.length))
type _LengthsOut = Expect<Equal<Infer<typeof _lengths>, number[]>>
type _LengthsIn = Expect<Equal<InferInput<typeof _lengths>, string[]>>

const _tupleInput = tuple(string.transform(s => s.length), coerce.number())
type _TupleInput = Expect<Equal<InferInput<typeof _tupleInput>, [string, unknown]>>
const _recordInput = record(string.transform(s => s.length))
type _RecordInput = Expect<Equal<InferInput<typeof _recordInput>, Record<string, string>>>
const _unionInput = union(string.transform(s => s.length), number.transform(n => String(n)))
type _UnionInput = Expect<Equal<InferInput<typeof _unionInput>, string | number>>
const _lazyInput = lazy(() => string.transform(s => s.length))
type _LazyInput = Expect<Equal<InferInput<typeof _lazyInput>, string>>

const _chain = coerce.number().transform(n => String(n))
type _ChainOut = Expect<Equal<Infer<typeof _chain>, string>>
type _ChainIn = Expect<Equal<InferInput<typeof _chain>, unknown>>

const _strictInput = strict({ n: coerce.number() })
type _StrictInput = Expect<Equal<InferInput<typeof _strictInput>, { n: unknown }>>
const _stripInput = strip({ n: string.transform(s => s.length) })
type _StripInput = Expect<Equal<InferInput<typeof _stripInput>, { n: string }>>

const _standard = standard(_chain)
type _StandardTypes = NonNullable<typeof _standard['~standard']['types']>
type _StandardIn = Expect<Equal<_StandardTypes['input'], unknown>>
type _StandardOut = Expect<Equal<_StandardTypes['output'], string>>

interface EcosystemSchema<I, O> {
    readonly '~standard': {
        readonly version: 1
        readonly vendor: string
        readonly validate: (value: unknown) => { value: O, issues?: undefined } | { issues: ReadonlyArray<{ message: string, path?: ReadonlyArray<PropertyKey> }> }
        readonly types?: { readonly input: I, readonly output: O }
    }
}
const _ecosystemSchema: EcosystemSchema<unknown, string> = _standard

const _crossField = refine({ password: string, confirm: string }, value => value.password === value.confirm, 'mismatch')
type _CrossFieldOut = Expect<Equal<Infer<typeof _crossField>, { password: string, confirm: string }>>
type _CrossFieldIn = Expect<Equal<InferInput<typeof _crossField>, { password: string, confirm: string }>>

// ===========================================================================
// 命脉 7：default —— Output 必有，Input 端含 undefined；对象里自动让该 key 可选（无需写 ?）
// ===========================================================================
const _def = string.default('x')
type _DefOut = Expect<Equal<Infer<typeof _def>, string>>
type _DefIn = Expect<Equal<InferInput<typeof _def>, string | undefined>>

// 对象字段 default：Output 端 role 必填，Input 端 role 自动可选（可省略）。
const Cfg = { name: string, role: string.default('user') }
type _CfgOut = Expect<Equal<Infer<typeof Cfg>, { name: string, role: string }>>
type _CfgIn = Expect<Equal<InferInput<typeof Cfg>, { name: string, role?: string | undefined }>>

// Input 端可省略 role（自动可选的运行证据在快照层；此处钉类型可赋值）。
const _cfgInput: InferInput<typeof Cfg> = { name: 'a' }

// ===========================================================================
// 命脉 8：undefinable/nullable/nullish —— 值层拓宽（与对象 key 可选性正交，后者仍靠 `"key?"`）
// ===========================================================================
// 值层：undefinable 加 undefined、nullable 加 null、nullish 两者皆加。两端同拓（Output 与 Input 一致）。
const _opt = string.undefinable()
type _OptOut = Expect<Equal<Infer<typeof _opt>, string | undefined>>
type _OptIn = Expect<Equal<InferInput<typeof _opt>, string | undefined>>
const _nul = string.nullable()
type _NulOut = Expect<Equal<Infer<typeof _nul>, string | null>>
const _nsh = number.nullish()
type _NshOut = Expect<Equal<Infer<typeof _nsh>, number | null | undefined>>

// 复合上可调（array 等同样持组合子）：array(string.undefinable()) → (string|undefined)[]。
const _arrOpt = array(string.undefinable())
type _ArrOpt = Expect<Equal<Infer<typeof _arrOpt>, (string | undefined)[]>>

// 对象字段 .undefinable()：两端值含 undefined，key 仍必填；要可省写 `'key?'`。
const Prof = { name: string, bio: string.undefinable() }
type _ProfOut = Expect<Equal<Infer<typeof Prof>, { name: string, bio: string | undefined }>>
type _ProfIn = Expect<Equal<InferInput<typeof Prof>, { name: string, bio: string | undefined }>>
// @ts-expect-error undefinable 只拓宽值，不能省略 key
const _profMissing: InferInput<typeof Prof> = { name: 'a' }

// ===========================================================================
// 命脉 9：coerce —— Output 是目标类型，Input 是 unknown（吃任意输入再掰）
// ===========================================================================
const _cn = coerce.number()
type _CoerceOut = Expect<Equal<Infer<typeof _cn>, number>>
type _CoerceIn = Expect<Equal<InferInput<typeof _cn>, unknown>>
const _pre = preprocess(v => v === '' ? undefined : v, string.undefinable())
type _PreOut = Expect<Equal<Infer<typeof _pre>, string | undefined>>
type _PreIn = Expect<Equal<InferInput<typeof _pre>, unknown>>
const _cb = coerce.boolean()
type _CoerceBool = Expect<Equal<Infer<typeof _cb>, boolean>>

// ===========================================================================
// 命脉 10：discriminatedUnion —— Infer 是各支 Infer 的并（同 union），按判别 key 选支
// ===========================================================================
const Shape = discriminatedUnion(
    'type',
    { type: literal('circle'), radius: number },
    { type: literal('square'), side: number },
)
type _Disc = Expect<Mutual<
    Infer<typeof Shape>,
    { type: 'circle', radius: number } | { type: 'square', side: number }
>>

// ===========================================================================
// 命脉 11：partial/required —— 映射 key 的 `?` 重写，Infer 等价 Partial/Required
// ===========================================================================
const PU = partial(User) // User 有 name/age 必填 + email?/verified?
type _Partial = Expect<Equal<Infer<typeof PU>, {
    name?: string
    age?: number
    email?: string
    verified?: boolean
}>>
const RU = required(User)
type _Required = Expect<Equal<Infer<typeof RU>, {
    name: string
    age: number
    email: string
    verified: boolean
}>>
