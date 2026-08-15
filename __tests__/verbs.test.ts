import { createSuite } from './suite'
import { SchemaError } from '../src/error'
import { number } from '../src/leaf'
import { check, parse, safeParse } from '../src/parse'
import { string } from '../src/leaf'

const snapshotSuite = createSuite(import.meta.dirname)

const User = { name: string.min(1), age: number.min(0) }

// 三个动词共用 walker，但出口形态各异 —— 逐一钉死契约。

// parse：成功返回原始 data（同引用）；失败抛 SchemaError。
snapshotSuite<{ data: unknown }>('verb-parse', ({ data }) => {
    try {
        const out = parse(User, data)
        return `RETURNED same-ref=${out === data} ${JSON.stringify(out)}`
    }
    catch (e) {
        return e instanceof SchemaError ? `THREW SchemaError ${e.issues.length} issues` : `THREW ${String(e)}`
    }
})

// safeParse：成功 {success:true,data}，失败 {success:false,error}。
snapshotSuite<{ data: unknown }>('verb-safeparse', ({ data }) => {
    const r = safeParse(User, data)
    return r.success
        ? `success data=${JSON.stringify(r.data)}`
        : `fail issues=${r.error.issues.length} isError=${r.error instanceof SchemaError}`
})

// check：类型守卫，返回 boolean。true（零 issue）/ false（有 issue）两态都要走到。
snapshotSuite<{ data: unknown }>('verb-check', ({ data }) => `check=${check(User, data)}`)

// summarize 边界（经 SchemaError.message 暴露）：空 issue → 'validation failed'；
// >3 issue → 取前 3 + (+N more)。4 个坏字段构造 >3。
const Quad = { a: string, b: string, c: string, d: string }
snapshotSuite<{ data: unknown }>('error-summarize-bounds', ({ data }) => {
    if (data === 'EMPTY')
        return `empty: ${new SchemaError([]).message}`
    const r = safeParse(Quad, data)
    return r.success ? 'NO FAIL' : `${r.error.issues.length} issues -> ${r.error.message}`
})
