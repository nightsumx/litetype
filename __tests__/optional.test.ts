import { createSuite } from './suite'
import { array } from '../src/compose'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// undefinable：undefined 放行，否则校验 inner。null 仍交 inner 报型错。
const Opt = string.undefinable()
snapshotSuite<{ data: unknown }>('optional-leaf', ({ data }) => render(safeParse(Opt, data)))

// nullable：null 放行，否则校验 inner。undefined 交 inner 报型错。
const Nul = string.nullable()
snapshotSuite<{ data: unknown }>('nullable-leaf', ({ data }) => render(safeParse(Nul, data)))

// nullish：undefined / null 皆放行。
const Nsh = number.nullish()
snapshotSuite<{ data: unknown }>('nullish-leaf', ({ data }) => render(safeParse(Nsh, data)))

// 复合上可调：数组元素 undefinable —— 元素可为 undefined，非空元素须为 string。
const ArrOpt = array(string.undefinable())
snapshotSuite<{ data: unknown }>('optional-in-array', ({ data }) => render(safeParse(ArrOpt, data)))

// 对象字段 undefinable：key 仍必填，值可为 undefined；非 undefined 须校验。
const Prof = { name: string, bio: string.undefinable() }
snapshotSuite<{ data: unknown }>('optional-in-object', ({ data }) => render(safeParse(Prof, data)))
