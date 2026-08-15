import { createSuite } from './suite'
import { array, record, union } from '../src/compose'
import { literal } from '../src/leaf'
import { number } from '../src/leaf'
import { parse, safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { transform } from '../src/compose'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// transform：校验通过后把值喂给 fn，产出新值。leaf 便捷方法 .transform。
const Trimmed = string.transform(s => s.trim())
snapshotSuite<{ data: unknown }>('transform-trim', ({ data }) => render(safeParse(Trimmed, data)))

// 改变类型：string → number。Output≠Input。
const Parsed = string.transform(s => s.length)
snapshotSuite<{ data: unknown }>('transform-retype', ({ data }) => render(safeParse(Parsed, data)))

// 校验失败 → 不调 fn（值不可信），报内层错误。
snapshotSuite<{ data: unknown }>('transform-skips-on-fail', ({ data }) => render(safeParse(Parsed, data)))

// transform 嵌在对象字段里：重组对象时字段被变换。
const User = { name: string.transform(s => s.toUpperCase()), age: number }
snapshotSuite<{ data: unknown }>('transform-in-object', ({ data }) => render(safeParse(User, data)))

// transform 作用于复合 schema（array），整体变换。
const Joined = transform(array(string), xs => xs.join(','))
snapshotSuite<{ data: unknown }>('transform-on-array', ({ data }) => render(safeParse(Joined, data)))

// transform 在 union 分支里：命中的那支变换后回传。
const Tagged = union(literal('a').transform(() => 1), literal('b').transform(() => 2))
snapshotSuite<{ data: unknown }>('transform-in-union', ({ data }) => render(safeParse(Tagged, data)))

// 嵌套 transform：外层 transform 吃内层 transform 的 Output。组合子在产出节点上仍可用，故 .transform() 可链。
const Chained = string.transform(s => s.length).transform(n => n * 2)
snapshotSuite<{ data: unknown }>('transform-chained', ({ data }) => render(safeParse(Chained, data)))

// 复合节点同构持有 .transform：array 上整体变换（与自由函数 transform(array(...)) 等价）。
const JoinedMethod = array(string).transform(xs => xs.join('-'))
snapshotSuite<{ data: unknown }>('transform-composite-method', ({ data }) => render(safeParse(JoinedMethod, data)))

// record value transform：逐 value 变换，重组对象。
const Counts = record(string.transform(s => s.length))
snapshotSuite<{ data: unknown }>('transform-in-record', ({ data }) => render(safeParse(Counts, data)))

// array of transform：逐元素变换。
const Lens = array(string.transform(s => s.length))
snapshotSuite<{ data: unknown }>('transform-array-elems', ({ data }) => render(safeParse(Lens, data)))

// 身份保持是承重契约（上一轮真 bug 的根源）——非快照，直接钉引用相等。
// 无变换：parse 成功必返回原引用（对象/数组/嵌套均不分配新物）。
snapshotSuite('identity-no-transform', () => {
    const Plain = { name: string, tags: array(string), meta: { v: number } }
    const data = { name: 'a', tags: ['x'], meta: { v: 1 }, extra: 'keep' }
    const out = parse(Plain, data) as typeof data
    return [
        `root-same=${out === data}`,
        `nested-same=${out.meta === data.meta}`,
        `array-same=${out.tags === data.tags}`,
        `extra-kept=${out.extra === 'keep'}`,
    ].join(' ')
})

// 有变换：仅变换处浅拷贝新建，未变的兄弟字段/多余 key 仍同引用、键序不动。
snapshotSuite('identity-partial-transform', () => {
    const Doc = { title: string.transform(s => s.toUpperCase()), meta: { v: number } }
    const data = { title: 'hi', meta: { v: 1 }, extra: 'keep' }
    const out = parse(Doc, data) as { title: string, meta: { v: number }, extra: string }
    return [
        `root-new=${out !== data}`,
        `title-transformed=${out.title === 'HI'}`,
        `nested-same=${out.meta === data.meta}`,
        `extra-kept=${out.extra === 'keep'}`,
        `keys=${Object.keys(out).join(',')}`,
    ].join(' ')
})

// 失败不调 fn（值不可信）——副作用计数器确认 fn 零调用。
snapshotSuite('transform-fn-not-called-on-fail', () => {
    let calls = 0
    const S = string.transform((s) => {
        calls++
        return s.length
    })
    const r = safeParse(S, 42)
    return `success=${r.success} fn-calls=${calls}`
})
