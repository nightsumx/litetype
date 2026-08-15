import { createSuite } from './suite'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { strict } from '../src/compose'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// strict 收紧为闭集：schema 外的 key 报 unexpected key。
const User = strict({ "name": string.min(1), 'age?': number })
snapshotSuite<{ data: unknown }>('strict-user', ({ data }) => render(safeParse(User, data)))

// strict 与 collect-all 并存：多余 key + 缺必填同时报。
snapshotSuite<{ data: unknown }>('strict-mixed', ({ data }) => render(safeParse(User, data)))

// strict 只作用本层；内层裸 shape 仍宽松（多余 key 被忽略）。
const Outer = strict({ inner: { a: string }, tag: string })
snapshotSuite<{ data: unknown }>('strict-shallow', ({ data }) => render(safeParse(Outer, data)))

// 嵌套 strict：内层也收紧。
const Nested = strict({ inner: strict({ a: string }), tag: string })
snapshotSuite<{ data: unknown }>('strict-nested', ({ data }) => render(safeParse(Nested, data)))

// strict × transform：字段变换与多余 key 反扫共存。变换在已知字段，多余 key 仍报错。
const StrictTrans = strict({ name: string.transform(s => s.toUpperCase()) })
snapshotSuite<{ data: unknown }>('strict-transform', ({ data }) => render(safeParse(StrictTrans, data)))
