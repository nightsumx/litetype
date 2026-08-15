import type { Shape } from '../src/types'
import { createSuite } from './suite'
import { array, fallback, lazy, record, tuple, union } from '../src/compose'
import { enum_, literal } from '../src/leaf'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

snapshotSuite<{ data: unknown }>('array-string', ({ data }) => render(safeParse(array(string), data)))
snapshotSuite<{ data: unknown }>('tuple-pair', ({ data }) => render(safeParse(tuple(literal('ok'), string), data)))
snapshotSuite<{ data: unknown }>('record-number', ({ data }) => render(safeParse(record(number), data)))
// 两参 record：key 也校验（值层 string 约束）。key 失败 issue 落该 key path，key 不变换。
snapshotSuite<{ data: unknown }>('record-keyed', ({ data }) => render(safeParse(record(enum_(['admin', 'user']), number), data)))
snapshotSuite<{ data: unknown }>('union-prim', ({ data }) => render(safeParse(union(string, number), data)))

// collect-all：全败时一条 invalid_union 伞 issue，内嵌每支（含判别字段）的失败原因，不挑「最像那支」谎报。
const Shape2 = union(
    { kind: literal('circle'), radius: number },
    { kind: literal('square'), side: number },
)
snapshotSuite<{ data: unknown }>('union-best-match', ({ data }) => render(safeParse(Shape2, data)))

snapshotSuite<{ data: unknown }>('union-tie-first-wins', ({ data }) => render(safeParse(union(number, literal('x')), data)))

// 混合 member：leaf 与裸 shape 同一 union。命中 leaf 支零 issue 即过。
snapshotSuite<{ data: unknown }>('union-leaf-and-shape', ({ data }) => render(safeParse(union(string, { tag: literal('t') }), data)))

// collect-all 路径分层：union 嵌对象字段 → 伞 issue 挂字段 path，每支 path 相对 union（member N @ ·）。
snapshotSuite<{ data: unknown }>('union-nested-path', ({ data }) => render(safeParse({ val: union(string, number) }, data)))
snapshotSuite<{ data: unknown }>('enum-role', ({ data }) => render(safeParse(enum_(['admin', 'user']), data)))
snapshotSuite<{ data: unknown }>('enum-number', ({ data }) => render(safeParse(enum_([1, 2, 3]), data)))
snapshotSuite<{ data: unknown }>('literal-const', ({ data }) => render(safeParse(literal(42), data)))
// format 的 boolean/null 分支：错误消息要正确序列化字面量。
snapshotSuite<{ data: unknown }>('literal-bool', ({ data }) => render(safeParse(literal(true), data)))
snapshotSuite<{ data: unknown }>('literal-null', ({ data }) => render(safeParse(literal(null), data)))

// fallback(schema, value)：inner 通过则原样产出，失败则吞 issue 返回兜底值（zod .catch()）。
snapshotSuite<{ data: unknown }>('fallback-number', ({ data }) => render(safeParse(fallback(number, 0), data)))
snapshotSuite<{ data: unknown }>('fallback-refine', ({ data }) => render(safeParse(fallback(string.min(5), 'def'), data)))

// 嵌套：array of bare-shape，深路径错误。
const Items = array({ "id": number, 'tag?': string })
snapshotSuite<{ data: unknown }>('array-of-shape', ({ data }) => render(safeParse(Items, data)))

// lazy 递归 schema：Tree = { value, children: Tree[] }。循环 schema 解析 OK。
const Tree: Shape = { value: number, children: array(lazy(() => Tree)) }
snapshotSuite<{ data: unknown }>('lazy-tree', ({ data }) => render(safeParse(Tree, data)))

// lazy thunk 记忆化：resolve 只跑一次，多次取同一引用。钉行为契约（防回归成每次重建）。
snapshotSuite<{ data: unknown }>('lazy-memoized', () => {
    let calls = 0
    const node = lazy(() => {
        calls++
        return { v: number }
    }) as unknown as { resolve: () => unknown }
    const a = node.resolve()
    const b = node.resolve()
    return `calls=${calls} same-ref=${a === b}`
})
