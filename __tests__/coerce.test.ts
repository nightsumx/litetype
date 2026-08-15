import { createSuite } from './suite'
import { coerce } from '../src/compose'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// coerce 先把输入掰成目标类型再走 inner check。掰失败（Number('abc')→NaN）由 inner 自然报错。
snapshotSuite<{ data: unknown }>('coerce-number', ({ data }) => render(safeParse(coerce.number(), data)))
// inner 自带 check：coerce 掰值，min 留在 inner 上。
snapshotSuite<{ data: unknown }>('coerce-number-min', ({ data }) => render(safeParse(coerce.number(number.min(0)), data)))
snapshotSuite<{ data: unknown }>('coerce-boolean', ({ data }) => render(safeParse(coerce.boolean(), data)))
snapshotSuite<{ data: unknown }>('coerce-string', ({ data }) => render(safeParse(coerce.string(), data)))
// date 输出是 Date 实例；render 顶层 Date 特化为 Date(ISO)。
// epoch/iso 走 new Date(v)；DATE_INSTANCE 哨兵（JSON 无 Date 类型）走 v instanceof Date 直通分支。
snapshotSuite<{ data: unknown }>('coerce-date', ({ data }) =>
    render(safeParse(coerce.date(), data === 'DATE_INSTANCE' ? new Date('2020-01-01T00:00:00.000Z') : data)))
