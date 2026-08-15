import { createSuite } from './suite'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// 裸字面量 schema，"key?" 可选。钉死：必填在/缺、可选在/缺、嵌套、spread 组合、
// isPlainObject 边界（null/数组/Date/Object.create(null)）。
const Timestamps = { "createdAt": number, 'deletedAt?': number }
const User = {
    "name": string.min(1),
    "age": number.min(0),
    'email?': string.email(),
    ...Timestamps,
}
snapshotSuite<{ data: unknown }>('object-user', ({ data }) => render(safeParse(User, data)))

// 嵌套裸字面量
const Team = { lead: { "name": string, 'nick?': string }, size: number }
snapshotSuite<{ data: unknown }>('object-nested', ({ data }) => render(safeParse(Team, data)))

// isPlainObject 边界：data 不是裸对象时整体拒；null-proto 对象应放行。
const Simple = { a: string }
snapshotSuite<{ data: unknown }>('object-shape-guard', ({ data }) => {
    const v
        = data === 'MAKE_DATE'
            ? new Date()
            : data === 'MAKE_NULLPROTO'
                ? Object.assign(Object.create(null), { a: 'x' })
                : data
    return render(safeParse(Simple, v))
})
