import { createSuite } from './suite'
import { safeParse } from '../src/parse'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

// 每个 in.json = { data }，schema 在闭包里建。一个 suite 钉一个 check 关注点。
snapshotSuite<{ data: unknown }>('string-type', ({ data }) => render(safeParse(string, data)))
snapshotSuite<{ data: unknown }>('string-min', ({ data }) => render(safeParse(string.min(3), data)))
snapshotSuite<{ data: unknown }>('string-max', ({ data }) => render(safeParse(string.max(3), data)))
snapshotSuite<{ data: unknown }>('string-email', ({ data }) => render(safeParse(string.email(), data)))
snapshotSuite<{ data: unknown }>('string-url', ({ data }) => render(safeParse(string.url(), data)))
// regex 是唯一允许的正则（校验用户数据，非解析结构化文本）。pattern: 仅小写字母。
snapshotSuite<{ data: unknown }>('string-regex', ({ data }) => render(safeParse(string.regex(/^[a-z]+$/), data)))

// 自定义 message：给了就覆盖默认错信息（默认信息其余 suite 已钉）。
snapshotSuite<{ data: unknown }>('string-min-message', ({ data }) => render(safeParse(string.min(3, '太短了'), data)))
snapshotSuite<{ data: unknown }>('string-email-message', ({ data }) => render(safeParse(string.email('邮箱格式不对'), data)))

// 补齐 check：词法判定（禁正则），各钉通过 + 失败。
snapshotSuite<{ data: unknown }>('string-uuid', ({ data }) => render(safeParse(string.uuid(), data)))
snapshotSuite<{ data: unknown }>('string-datetime', ({ data }) => render(safeParse(string.datetime(), data)))
snapshotSuite<{ data: unknown }>('string-length', ({ data }) => render(safeParse(string.length(4), data)))
snapshotSuite<{ data: unknown }>('string-startswith', ({ data }) => render(safeParse(string.startsWith('api_'), data)))
snapshotSuite<{ data: unknown }>('string-endswith', ({ data }) => render(safeParse(string.endsWith('.json'), data)))
snapshotSuite<{ data: unknown }>('string-includes', ({ data }) => render(safeParse(string.includes('@'), data)))
// ip 词法判定（禁正则）：IPv4 四段点分 + IPv6 含 :: 压缩与内嵌 v4 尾。
snapshotSuite<{ data: unknown }>('string-ip', ({ data }) => render(safeParse(string.ip(), data)))
