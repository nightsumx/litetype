import { createSuite } from './suite'
import { strip } from '../src/compose'
import { number, string } from '../src/leaf'
import { safeParse } from '../src/parse'
import { render } from './render'

const snapshotSuite = createSuite(import.meta.dirname)

const User = strip({ "name": string.min(1), 'age?': number })
snapshotSuite<{ data: unknown }>('strip-user', ({ data }) => render(safeParse(User, data)))

const Trans = strip({ name: string.transform(s => s.toUpperCase()) })
snapshotSuite<{ data: unknown }>('strip-transform', ({ data }) => render(safeParse(Trans, data)))
