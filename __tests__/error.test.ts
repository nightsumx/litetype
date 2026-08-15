import { createSuite } from './suite'
import { SchemaError } from '../src/error'
import { number } from '../src/leaf'
import { parse, safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// collect-all：3 个坏字段 → 3 条 issue（render 按 path 排序，确定序）。
const Form = { name: string.min(1), age: number.min(0), bio: string.max(5) }
snapshotSuite<{ data: unknown }>('error-collect-fields', ({ data }) => render(safeParse(Form, data)))

// 单叶多 refinement 同时失败 → 全收集，不止第一条。5.5 同时违反 int 和 min(10)。
const Tight = number.int().min(10)
snapshotSuite<{ data: unknown }>('error-collect-refinements', ({ data }) => render(safeParse(Tight, data)))

// 类型不符短路 refinement：非 string 只一条 type 错，不叠 length 错。
snapshotSuite<{ data: unknown }>('error-typefail-shortcircuits', ({ data }) =>
    render(safeParse({ name: string.min(3) }, data)))

// parse 抛 SchemaError：issues 完整（插入序确定）+ message 是前 3 摘要。
snapshotSuite<{ data: unknown }>('error-throw-summarize', ({ data }) => {
    try {
        parse(Form, data)
        return 'NO THROW'
    }
    catch (e) {
        if (!(e instanceof SchemaError))
            return `WRONG ERROR ${String(e)}`
        return `THREW ${e.issues.length} issues\n${e.message}`
    }
})
