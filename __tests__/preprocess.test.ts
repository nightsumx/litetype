import { createSuite } from './suite'
import { preprocess } from '../src/compose'
import { number, string } from '../src/leaf'
import { safeParse } from '../src/parse'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// 空串当缺 —— 表单岗位。
const Empty = preprocess(v => v === '' ? undefined : v, string.undefinable())
snapshotSuite<{ data: unknown }>('preprocess-empty', ({ data }) => render(safeParse(Empty, data)))

const Trim = preprocess(v => typeof v === 'string' ? v.trim() : v, string.min(1))
snapshotSuite<{ data: unknown }>('preprocess-trim', ({ data }) => render(safeParse(Trim, data)))

const Boom = preprocess(() => { throw new Error('bad pre') }, number)
snapshotSuite<{ data: unknown }>('preprocess-throw', ({ data }) => render(safeParse(Boom, data)))
