import { createSuite } from './suite'
import { safeParse } from '../src/parse'
import { partial, required } from '../src/compose'
import { string } from '../src/leaf'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

const User = { "id": string, "name": string, 'email?': string.email() }

// partial：每 key 加 `?` → 全可选，空对象通过。
snapshotSuite<{ data: unknown }>('partial-user', ({ data }) => render(safeParse(partial(User), data)))
// required：去 `?` → email 变必填，缺则报错。
snapshotSuite<{ data: unknown }>('required-user', ({ data }) => render(safeParse(required(User), data)))
