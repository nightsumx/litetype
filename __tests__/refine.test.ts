import { createSuite } from './suite'
import { expect, test } from 'vitest'
import { array, refine } from '../src/compose'
import { number } from '../src/leaf'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// refine：自定义谓词，pred 返回 false → push message。复用 with，对所有 leaf 子类开放。
const Even = number.refine(n => n % 2 === 0, 'must be even')
snapshotSuite<{ data: unknown }>('refine-even', ({ data }) => render(safeParse(Even, data)))

// refine 在 type-check 之后跑：类型不符先短路（refine 不执行），消息是 type 错而非谓词错。
snapshotSuite<{ data: unknown }>('refine-typefail-shortcircuits', ({ data }) => render(safeParse(Even, data)))

// 链式 refine：多个谓词都跑（collect-all），各自报错。
const Pw = string.min(8).refine(s => /\d/.test(s), 'need a digit').refine(s => /[A-Z]/.test(s), 'need an uppercase')
snapshotSuite<{ data: unknown }>('refine-chain', ({ data }) => render(safeParse(Pw, data)))

// 复合节点同构持有 .refine：array 上加谓词。型错（非数组）短路谓词，谓词错正常报。
const NonEmpty = array(number).refine(xs => xs.length > 0, 'must be non-empty')
snapshotSuite<{ data: unknown }>('refine-composite-array', ({ data }) => render(safeParse(NonEmpty, data)))

test('free refine validates bare shapes', () => {
    const Signup = refine({ password: string.min(8), confirm: string },
        value => value.password === value.confirm,
        'passwords do not match')

    expect(safeParse(Signup, { password: 'password', confirm: 'password' })).toEqual({
        success: true,
        data: { password: 'password', confirm: 'password' },
    })
    const result = safeParse(Signup, { password: 'password', confirm: 'different' })
    expect(result.success).toBe(false)
    if (!result.success)
        expect(result.error.issues).toEqual([{ path: [], message: 'passwords do not match', code: 'custom' }])
})
