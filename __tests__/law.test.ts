import { law, roundtrip } from './suite'
import { describe } from 'vitest'
import { coerce, strip } from '../src/compose'
import { array, record, union } from '../src/compose'
import { describe as deschema } from '../src/compose'
import { number } from '../src/leaf'
import { check, run, safeParse } from '../src/parse'
import { boolean } from '../src/leaf'
import { partial, required } from '../src/compose'
import { string } from '../src/leaf'

// law 钉「对所有输入成立的不变式」——fixture 钉具体值，law 钉契约。schema 的输入是领域特定
// 的 (schema, data) 组，typegen 采不出，故全部显式 inputs（边界优先：空/null/嵌套/脏类型）。

// ── 1. soundness：check ⟺ safeParse.success（两动词同一遍历，绝不分叉）──────
const SCHEMAS: unknown[] = [string, number, boolean, array(number), record(string), union(string, number), { "a": number, 'b?': string }]
const DATA = [undefined, null, 0, '', 'x', 42, true, [], [1, 2], { a: 1 }, { a: 'no' }, [1, 'x'], Number.NaN, { __proto__: { p: 1 }, a: 1 }]
const pairs: unknown[][] = SCHEMAS.flatMap(s => DATA.map(d => [s, d]))

describe('schema laws', () => {
    law('check⟺safeParse', (s: never, d: never) => check(s, d) === safeParse(s, d).success, [
        out => out === true,
    ], { inputs: pairs })

    // ── 2. idempotent：transform-free schema 下 parse 出来的值再 parse 必同（值不被改写）。
    // run 拿 value（成功时即 data 本体，无 transform）；二次喂回必再成功且等值。
    law('parse-idempotent', (s: never, d: never) => {
        const r1 = run(s, d)
        if (r1.issues.length)
            return true // 失败输入不在幂等域内（只钉成功路径的稳定性）
        const r2 = run(s, r1.value)
        return r2.issues.length === 0 && Object.is(r2.value, r1.value)
    }, [out => out === true], { inputs: pairs })

    // ── 3. identity-preservation：transform-free 校验返回同一引用（不无谓拷贝，命脉性能契约）。
    const OBJS: unknown[][] = [
        [{ a: number }, { a: 1 }],
        [array(number), [1, 2, 3]],
        [record(string), { k: 'v' }],
        [{ "a": number, 'b?': string }, { a: 1, b: 'x' }],
        [strip({ a: number }), { a: 1 }],
    ]
    law('no-copy', (s: never, d: never) => {
        const r = run(s, d)
        return r.issues.length === 0 && Object.is(r.value, d)
    }, [out => out === true], { inputs: OBJS })

    // ── describe 透传律：挂描述对校验零影响 —— describe(s,'…') 与 s 在所有输入上同结果（success + 值引用）。
    // 钉「描述只是元数据」契约：若 walker 漏了 describe 分支或动了 inner，此律必破。
    law('describe-passthrough', (s: never, d: never) => {
        const bare = run(s, d)
        const desc = run(deschema(s, 'meta') as never, d)
        return bare.issues.length === desc.issues.length && Object.is(bare.value, desc.value)
    }, [out => out === true], { inputs: pairs })

    // ── 4. partial/required 对偶：key 名集合（去 ?）不变，只翻转可选性；幂等收敛。
    const SHAPES: unknown[][] = [
        [{ a: number }],
        [{ "a": number, 'b?': string }],
        [{ 'x?': number, 'y?': string }],
        [{}],
    ]
    const keyset = (sh: unknown) => new Set(Object.keys(sh as object).map(k => k.endsWith('?') ? k.slice(0, -1) : k))
    const eqSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x))
    const par = partial as (s: object) => object
    const req = required as (s: object) => object
    law('partial-required-dual', (sh: never) => {
        const s = sh as object
        const ks = keyset(s)
        const allReq = req(par(s))
        const allOpt = par(req(s))
        return (
            eqSet(keyset(allReq), ks) // key 名集合守恒
            && eqSet(keyset(allOpt), ks)
            && Object.keys(allReq).every(k => !k.endsWith('?')) // required∘partial：全必填
            && Object.keys(allOpt).every(k => k.endsWith('?')) // partial∘required：全可选
            && eqSet(keyset(req(req(s))), keyset(req(s))) // required 幂等
            && eqSet(keyset(par(par(s))), keyset(par(s))) // partial 幂等
        )
    }, [out => out === true], { inputs: SHAPES })
})

// ── 5. roundtrip：coerce.number ∘ String —— Number(String(n)) === n（有限数双射）。
// 前端 query/表单到处是 number↔string 来回，bug 藏在边界经一来一回后变形。
const nums: unknown[][] = [[0], [-0], [1], [-1], [42], [3.14], [-3.14], [1e10], [1e-10], [Number.MAX_SAFE_INTEGER], [Number.MIN_SAFE_INTEGER]]
const co = coerce.number()
roundtrip('coerce-number', (n: number) => String(n), s => safeParse(co, s).success ? (safeParse(co, s) as { data: number }).data : Number.NaN, { inputs: nums })
