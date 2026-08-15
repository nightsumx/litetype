import { createSuite } from './suite'
import { discriminatedUnion } from '../src/compose'
import { literal } from '../src/leaf'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// 判别联合：按 data.type O(1) 选支，只校验那支 → 错误精准（不是 union 的全试 best-match）。
const Shape = discriminatedUnion(
    'type',
    { type: literal('circle'), radius: number },
    { type: literal('square'), side: number },
    { type: literal('label'), text: string },
)

// 命中精准（circle 支只查 radius）、判别非法、判别缺失、选中支内字段错。
snapshotSuite<{ data: unknown }>('discriminated', ({ data }) => render(safeParse(Shape, data)))
