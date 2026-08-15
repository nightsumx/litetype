import { createSuite } from './suite'
import { array } from '../src/compose'
import { number } from '../src/leaf'
import { parse, safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// default：缺值（undefined）填默认值；给值则校验内层。leaf 便捷方法 .default。
const Role = string.default('user')
snapshotSuite<{ data: unknown }>('default-leaf', ({ data }) => render(safeParse(Role, data)))

// 给了值 → 校验内层，坏值照报（default 只兜「缺」不兜「坏」）。
snapshotSuite<{ data: unknown }>('default-validates-present', ({ data }) => render(safeParse(Role, data)))

// 对象字段 default：缺 key 自动回填，无需写 "key?"。
const Cfg = { name: string, role: string.default('user'), retries: number.default(3) }
snapshotSuite<{ data: unknown }>('default-in-object', ({ data }) => render(safeParse(Cfg, data)))

// 复合上的 default：缺值填整个数组。复合节点与 leaf 同构持有 .default。
const Tags = array(string).default([])
snapshotSuite<{ data: unknown }>('default-composite', ({ data }) => render(safeParse(Tags, data)))

// 身份保持：default 字段已present且未变 → 对象仍同引用（回填才浅拷贝）。
snapshotSuite('default-identity', () => {
    const data = { name: 'a', role: 'admin' }
    const out = parse(Cfg, data) as typeof data & { retries: number }
    // role present 不回填，但 retries 缺 → 回填，故 root 必新建；role 值不变。
    return `root-new=${out !== data} role=${out.role} retries=${out.retries}`
})

// 全present → 无回填 → 同引用。
snapshotSuite('default-identity-allpresent', () => {
    const data = { name: 'a', role: 'admin', retries: 5 }
    const out = parse(Cfg, data)
    return `root-same=${out === data}`
})
