import { createSuite } from './suite'
import { array, lazy } from '../src/compose'
import { flatten, prettify, treeify } from '../src/error'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'

const snapshotSuite = createSuite(import.meta.dirname)

// 嵌套 schema：顶层字段 + 数组 + 深层对象，足以让三投影各显形状。
const Order = {
    id: string.min(1),
    qty: number.min(1),
    items: array({ sku: string.min(1), price: number.min(0) }),
    'note?': string.max(10),
}

function badOf(data: unknown) {
    const r = safeParse(Order, data)
    return r.success ? null : r.error
}

// flatten：单层投影，formErrors + fieldErrors（顶层 key 桶）。
snapshotSuite<{ data: unknown }>('flatten', ({ data }) => {
    const e = badOf(data)
    return e ? JSON.stringify(flatten(e), null, 2) : 'OK'
})

// treeify：沿 path 下钻的镜像树（properties/items 嵌套）。
snapshotSuite<{ data: unknown }>('treeify', ({ data }) => {
    const e = badOf(data)
    return e ? JSON.stringify(treeify(e), null, 2) : 'OK'
})

// prettify：人读多行串。
snapshotSuite<{ data: unknown }>('prettify', ({ data }) => {
    const e = badOf(data)
    return e ? prettify(e) : 'OK'
})

// 吃裸 issues[]（非 SchemaError）也成立 —— verbs 外置则投影也外置。
snapshotSuite<{ data: unknown }>('accepts-bare-issues', ({ data }) => {
    const e = badOf(data)
    return e ? JSON.stringify(flatten(e.issues)) : 'OK'
})

// 递归 schema 的深层 path 也能 treeify（lazy 不影响 path 累积）。
const Tree: any = { name: string.min(1), 'kids?': array(lazy(() => Tree)) }
snapshotSuite<{ data: unknown }>('treeify-recursive', ({ data }) => {
    const r = safeParse(Tree, data)
    return r.success ? 'OK' : JSON.stringify(treeify(r.error), null, 2)
})
