import { createSuite } from './suite'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { boolean, date } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// NaN 走 typeof==='number' 侧的特化消息（JSON 无 NaN 字面量，闭包注入）。
snapshotSuite<{ data: unknown }>('number-type', ({ data }) =>
    render(safeParse(number, data === 'NAN' ? Number.NaN : data)))
snapshotSuite<{ data: unknown }>('number-min', ({ data }) => render(safeParse(number.min(0), data)))
snapshotSuite<{ data: unknown }>('number-max', ({ data }) => render(safeParse(number.max(10), data)))
snapshotSuite<{ data: unknown }>('number-int', ({ data }) => render(safeParse(number.int(), data)))
// 自定义 message：number.min 覆盖默认。
snapshotSuite<{ data: unknown }>('number-min-message', ({ data }) => render(safeParse(number.min(0, '不能为负'), data)))
snapshotSuite<{ data: unknown }>('number-finite', ({ data }) =>
    render(safeParse(number.finite(), data === 'INF' ? Infinity : data === '-INF' ? -Infinity : data)))
snapshotSuite<{ data: unknown }>('boolean-type', ({ data }) => render(safeParse(boolean, data)))
// date 输入用 ISO 字符串，闭包里转 Date 再校验（JSON 无 Date 字面量）。
snapshotSuite<{ data: unknown }>('date-type', ({ data }) =>
    render(safeParse(date, typeof data === 'string' ? new Date(data) : data)))
const epoch = new Date('2020-01-01T00:00:00.000Z')
const horizon = new Date('2020-12-31T00:00:00.000Z')
snapshotSuite<{ data: unknown }>('date-min', ({ data }) =>
    render(safeParse(date.min(epoch), typeof data === 'string' ? new Date(data) : data)))
snapshotSuite<{ data: unknown }>('date-max', ({ data }) =>
    render(safeParse(date.max(horizon), typeof data === 'string' ? new Date(data) : data)))

// 补齐 check：positive(>0)、nonnegative(>=0)、multipleOf（浮点容差）。各钉通过+失败+边界。
snapshotSuite<{ data: unknown }>('number-positive', ({ data }) => render(safeParse(number.positive(), data)))
snapshotSuite<{ data: unknown }>('number-nonnegative', ({ data }) => render(safeParse(number.nonnegative(), data)))
snapshotSuite<{ data: unknown }>('number-multipleof', ({ data }) => render(safeParse(number.multipleOf(0.5), data)))
