import { createSuite } from './suite'
import { number } from '../src/leaf'
import { standard } from '../src/standard'
import { string } from '../src/leaf'

const snapshotSuite = createSuite(import.meta.dirname)

// transform 经 standard：生态边界（tRPC/rhf）必须拿到「变换后」的值，而非原 input。
// 零测则有人把 standard 改回返回 input 也不报 —— 这条钉死管道。
const Trans = standard({ name: string.transform(s => s.toUpperCase()), n: number })
snapshotSuite<{ data: unknown }>('standard-transform-value', ({ data }) => {
    const r = Trans['~standard'].validate(data)
    return ('issues' in r && r.issues) ? 'ISSUES' : `OK ${JSON.stringify(r.value)}`
})

const User = standard({ "name": string.min(1), 'age?': number.min(0) })

// 渲染 ~standard 的 envelope + 一次 validate 结果（成功 {value} / 失败 {issues}）。
snapshotSuite<{ data: unknown }>('standard-validate', ({ data }) => {
    const props = User['~standard']
    const r = props.validate(data)
    const head = `v${props.version} ${props.vendor}`
    if (!('issues' in r) || r.issues === undefined)
        return `${head}\nOK ${JSON.stringify(r.value)}`
    const lines = r.issues
        .map(i => `${(i.path ?? []).map(String).join('.') || '<root>'}: ${i.message}`)
        .sort()
    return `${head}\nISSUES\n${lines.join('\n')}`
})

// 幂等：standard(standard(x)) === standard(x)（同一引用，不二次包裹）。
snapshotSuite<{ data: unknown }>('standard-idempotent', () => {
    const once = standard({ a: string })
    // standard 对已带 ~standard 的对象幂等（生态边界可能重复包裹）。
    const twice = standard(once as unknown as { a: typeof string })
    return `same-ref=${(once as object) === twice} has-standard=${'~standard' in twice}`
})
