import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const out = join(root, 'dist')

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')

const code = (source, label = 'TypeScript') => `
  <figure class="code-block">
    <figcaption>${label}</figcaption>
    <pre><code>${escapeHtml(source.trim())}</code></pre>
  </figure>`

const docsNav = active => `
  <aside class="docs-nav" aria-label="Documentation">
    <a ${active === 'docs' ? 'aria-current="page"' : ''} href="/docs/">Start</a>
    <a ${active === 'api' ? 'aria-current="page"' : ''} href="/docs/api/">API</a>
    <a ${active === 'zod' ? 'aria-current="page"' : ''} href="/docs/zod/">Zod migration</a>
    <a ${active === 'integrations' ? 'aria-current="page"' : ''} href="/docs/integrations/">Integrations</a>
    <a ${active === 'benchmarks' ? 'aria-current="page"' : ''} href="/benchmarks/">Benchmarks</a>
  </aside>`

const docs = (active, body) => `
  <div class="docs-shell">
    ${docsNav(active)}
    <article class="prose">${body}</article>
  </div>`

const page = ({ title, description, path = '/', active = '', body }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#fbfcf7">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="https://litetype.org/social.png">
  <meta property="og:url" content="https://litetype.org${path}">
  <title>${title}</title>
  <link rel="canonical" href="https://litetype.org${path}">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/style.css?v=2">
</head>
<body>
  <header class="site-header">
    <a class="wordmark" href="/" aria-label="litetype home"><span>{</span> litetype <span>}</span></a>
    <nav aria-label="Main navigation">
      <a ${active === 'docs' ? 'aria-current="page"' : ''} href="/docs/">Docs</a>
      <a ${active === 'benchmarks' ? 'aria-current="page"' : ''} href="/benchmarks/">Benchmarks</a>
      <a href="https://github.com/nightsumx/litetype">GitHub</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer>
    <span>litetype · MIT · zero dependencies</span>
    <a href="https://github.com/nightsumx/litetype">Source on GitHub</a>
  </footer>
  <script src="/site.js" defer></script>
</body>
</html>`

const home = page({
  title: 'litetype — Runtime schemas that look like TypeScript',
  description: 'A 5 kB runtime validation library where a literal is a schema.',
  body: `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Runtime validation, written like TypeScript</p>
        <h1>A literal is<br><span>already a schema.</span></h1>
        <p class="lede">No object builder. No method language. Write a value like an interface, infer its type, then validate unknown data.</p>
        <div class="hero-actions">
          <button class="install" data-copy="npm i litetype"><span>$</span> npm i litetype <b>Copy</b></button>
          <a class="primary" href="/docs/">Read the docs →</a>
        </div>
      </div>
      <div class="type-sheet" aria-label="litetype example">
        <div class="sheet-label"><span>runtime</span><span>type</span></div>
        <pre><code><i>const</i> User = {
  name: <b>string</b>.min(1),
  age: <b>number</b>.min(0),
  <mark>'email?'</mark>: <b>string</b>.email(),
}

<i>type</i> User = Infer&lt;<i>typeof</i> User&gt;

parse(User, input)</code></pre>
        <div class="brace" aria-hidden="true">}</div>
      </div>
    </section>

    <section class="thesis">
      <header>
        <p class="eyebrow">The model</p>
        <h2>Three things, kept separate.</h2>
      </header>
      <div class="model-lines">
        <div><span>value</span><code>const User = { name: string }</code></div>
        <div><span>type</span><code>type User = Infer&lt;typeof User&gt;</code></div>
        <div><span>check</span><code>parse(User, input)</code></div>
      </div>
    </section>

    <section class="proof">
      <header>
        <p class="eyebrow">Measured, not claimed</p>
        <h2>Small enough to disappear.<br>Fast enough to stop thinking about.</h2>
      </header>
      <dl class="facts">
        <div><dt>5.00 kB</dt><dd>browser bundle, min + gzip</dd></div>
        <div><dt>90.47M</dt><dd>flat valid objects / second</dd></div>
        <div><dt>341</dt><dd>TypeScript instantiations</dd></div>
        <div><dt>0</dt><dd>runtime dependencies</dd></div>
      </dl>
      <a class="text-link" href="/benchmarks/">See contracts and methodology →</a>
    </section>

    <section class="composition">
      <div>
        <p class="eyebrow">Schemas are data</p>
        <h2>Compose with JavaScript.</h2>
        <p>Spread is extend. Property access is pick. Rest destructuring is omit. Optional keys remain optional because the language already knows how objects compose.</p>
      </div>
      ${code(`const User = { name: string, age: number, 'email?': string }
const Timestamps = { createdAt: date, 'deletedAt?': date }

const Post = { title: string, ...Timestamps }
const Public = { name: User.name, 'email?': User['email?'] }
const { age: _, ...NoAge } = User`)}
    </section>

    <section class="compare">
      <p class="eyebrow">Less library language</p>
      <h2>The same job, with the scaffolding removed.</h2>
      <div class="compare-grid">
        ${code(`const User = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
})

type User = z.infer<typeof User>
User.parse(input)`, 'Zod')}
        ${code(`const User = {
  name: string.min(1),
  'email?': string.email(),
}

type User = Infer<typeof User>
parse(User, input)`, 'litetype')}
      </div>
      <a class="text-link" href="/docs/zod/">Move from Zod →</a>
    </section>

    <section class="ecosystem">
      <p class="eyebrow">One standard edge</p>
      <h2>tRPC, Hono and forms<br>without adapter packages.</h2>
      <p>Keep schemas bare inside your code. Wrap once with Standard Schema where another tool needs it.</p>
      ${code(`const User = { name: string.min(1) }

t.procedure
  .input(standard(User))
  .query(({ input }) => input)`)}
      <a class="text-link" href="/docs/integrations/">Integration recipes →</a>
    </section>

    <section class="closing">
      <h2>Keep the type.<br>Drop the ceremony.</h2>
      <button class="install inverse" data-copy="npm i litetype"><span>$</span> npm i litetype <b>Copy</b></button>
    </section>`
})

const start = page({
  title: 'Getting started — litetype',
  description: 'Install litetype, define a literal schema, infer a type, and validate unknown data.',
  path: '/docs/',
  active: 'docs',
  body: docs('docs', `
    <p class="eyebrow">Documentation</p>
    <h1>Start with a literal.</h1>
    <p class="intro">A litetype schema is either a leaf such as <code>string</code>, or a plain object whose values are schemas. That is the whole model.</p>
    ${code(`npm i litetype`, 'Terminal')}
    ${code(`import { string, number, type Infer, parse } from 'litetype'

const User = {
  name: string.min(1),
  age: number.min(0),
  'email?': string.email(),
}

type User = Infer<typeof User>
const user = parse(User, input)`)}
    <h2>Choose a validation verb</h2>
    <table><thead><tr><th>Job</th><th>Use</th></tr></thead><tbody>
      <tr><td>Return data or throw</td><td><code>parse(schema, input)</code></td></tr>
      <tr><td>Return a result union</td><td><code>safeParse(schema, input)</code></td></tr>
      <tr><td>Narrow an unknown value</td><td><code>check(schema, input)</code></td></tr>
      <tr><td>Predicate for a hot loop</td><td><code>compile(schema)</code></td></tr>
    </tbody></table>
    <p>Schemas compile automatically on first use. Call <code>compile</code> only when a hot loop should avoid the cache lookup.</p>
    <h2>Optional key ≠ undefined value</h2>
    ${code(`const A = { 'bio?': string }          // bio may be omitted
const B = { bio: string.undefinable() } // bio is required, value may be undefined`)}
    <p>The trailing <code>?</code> mirrors a TypeScript optional property. It belongs to the key. Nullability belongs to the value.</p>
    <h2>Object policy is explicit</h2>
    ${code(`parse({ name: string }, input)         // keep extra keys, no copy
parse(strip({ name: string }), input)  // remove extra keys
parse(strict({ name: string }), input) // reject extra keys`)}
    <h2>Forms: map, then check</h2>
    ${code(`parse(preprocess(v => v === '' ? undefined : v, string.undefinable()), '')
parse(coerce.number(), '42') // 42`)}
    <nav class="next"><a href="/docs/api/">Next: API dictionary →</a></nav>`)
})

const api = page({
  title: 'API — litetype',
  description: 'The complete litetype API dictionary.',
  path: '/docs/api/',
  active: 'docs',
  body: docs('api', `
    <p class="eyebrow">Dictionary</p><h1>API</h1>
    <p class="intro">Narrative lives in the guide. This page is the compact reference.</p>
    <h2>Verbs</h2>
    <table><tbody>
      <tr><td><code>parse(s, data)</code></td><td>Return <code>Infer&lt;S&gt;</code> or throw <code>SchemaError</code></td></tr>
      <tr><td><code>safeParse(s, data)</code></td><td>Return a success/error union</td></tr>
      <tr><td><code>check(s, data)</code></td><td>Type predicate</td></tr>
      <tr><td><code>compile(s)</code></td><td>Cached predicate for hot loops</td></tr>
    </tbody></table>
    <h2>Types</h2>
    <table><tbody>
      <tr><td><code>Infer&lt;S&gt;</code></td><td>Output type</td></tr>
      <tr><td><code>InferInput&lt;S&gt;</code></td><td>Input type before transforms and defaults</td></tr>
      <tr><td><code>Schema&lt;O, I&gt;</code></td><td>A schema node</td></tr>
      <tr><td><code>Shape</code></td><td>A bare object schema</td></tr>
    </tbody></table>
    <h2>Leaves</h2>
    <table><thead><tr><th>Schema</th><th>Output</th><th>Checks</th></tr></thead><tbody>
      <tr><td><code>string</code></td><td><code>string</code></td><td><code>min</code>, <code>max</code>, <code>length</code>, <code>email</code>, <code>url</code>, <code>uuid</code>, <code>datetime</code>, <code>ip</code>, <code>startsWith</code>, <code>endsWith</code>, <code>includes</code>, <code>regex</code></td></tr>
      <tr><td><code>number</code></td><td><code>number</code></td><td><code>min</code>, <code>max</code>, <code>gt</code>, <code>lt</code>, <code>int</code>, <code>finite</code>, <code>positive</code>, <code>nonnegative</code>, <code>multipleOf</code></td></tr>
      <tr><td><code>boolean</code></td><td><code>boolean</code></td><td>—</td></tr>
      <tr><td><code>date</code></td><td><code>Date</code></td><td><code>min</code>, <code>max</code></td></tr>
      <tr><td><code>unknown</code></td><td><code>unknown</code></td><td>—</td></tr>
      <tr><td><code>literal(v)</code></td><td>literal type</td><td>exact value</td></tr>
      <tr><td><code>enum_(values)</code></td><td>value union</td><td>member</td></tr>
    </tbody></table>
    <h2>Every schema node</h2>
    <table><tbody>
      <tr><td><code>.transform(fn)</code></td><td>Map after successful validation</td></tr>
      <tr><td><code>.refine(pred, message)</code></td><td>Add a predicate</td></tr>
      <tr><td><code>.default(value)</code></td><td>Fill when input is <code>undefined</code></td></tr>
      <tr><td><code>.undefinable()</code></td><td>Allow <code>undefined</code></td></tr>
      <tr><td><code>.nullable()</code></td><td>Allow <code>null</code></td></tr>
      <tr><td><code>.nullish()</code></td><td>Allow both</td></tr>
    </tbody></table>
    <h2>Composition</h2>
    <div class="api-list"><code>array</code><code>tuple</code><code>union</code><code>record</code><code>discriminatedUnion</code><code>lazy</code><code>strict</code><code>strip</code><code>partial</code><code>required</code><code>preprocess</code><code>refine</code><code>coerce</code><code>fallback</code><code>describe</code><code>standard</code></div>
    ${code(`const Shape = discriminatedUnion('type',
  { type: literal('circle'), radius: number },
  { type: literal('square'), side: number },
)

const Tree = { value: string, 'children?': array(lazy(() => Tree)) }`)}
    <h2>Errors</h2>
    <p>Every issue is <code>{ path, message, code }</code>. Use <code>flatten</code> for forms, <code>treeify</code> for nested display, or <code>prettify</code> for text.</p>
    <h2>JSON Schema</h2>
    ${code(`import { fromJsonSchema, toJsonSchema } from 'litetype/jsonschema'`)}
    <p>The subpath keeps JSON Schema code out of the main bundle. Transform, refine and preprocess cannot be serialized.</p>`)
})

const zod = page({
  title: 'Move from Zod — litetype',
  description: 'Translate validation jobs from Zod to litetype without copying object-builder ceremony.',
  path: '/docs/zod/',
  active: 'docs',
  body: docs('zod', `
    <p class="eyebrow">Migration</p><h1>Coming from Zod</h1>
    <p class="intro">Map jobs, not methods. Do not reproduce <code>z.object</code> in another spelling.</p>
    <div class="compare-grid doc-compare">
      ${code(`const User = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
})`, 'Zod')}
      ${code(`const User = {
  name: string.min(1),
  'email?': string.email(),
}`, 'litetype')}
    </div>
    <table><thead><tr><th>Job</th><th>Zod</th><th>litetype</th></tr></thead><tbody>
      <tr><td>Object</td><td><code>z.object({…})</code></td><td><code>{…}</code></td></tr>
      <tr><td>Optional key</td><td><code>.optional()</code></td><td><code>'key?'</code></td></tr>
      <tr><td>Undefined value</td><td><code>.optional()</code></td><td><code>.undefinable()</code></td></tr>
      <tr><td>Extend / pick / omit</td><td>Library methods</td><td>Spread / property / rest</td></tr>
      <tr><td>Infer</td><td><code>z.infer</code></td><td><code>Infer</code></td></tr>
      <tr><td>Validate</td><td>Schema methods</td><td><code>parse</code>, <code>safeParse</code>, <code>check</code></td></tr>
      <tr><td>Reject extras</td><td><code>.strict()</code></td><td><code>strict(shape)</code></td></tr>
      <tr><td>Drop extras</td><td>Default</td><td><code>strip(shape)</code></td></tr>
      <tr><td>Coerce</td><td><code>z.coerce.number()</code></td><td><code>coerce.number()</code></td></tr>
      <tr><td>Cross-field check</td><td><code>.refine()</code></td><td><code>refine(shape, pred, message)</code></td></tr>
    </tbody></table>
    <h2>Wrap only at the boundary</h2>
    ${code(`export const User = { name: string.min(1), 'email?': string.email() }
export const UserInput = standard(User)

t.procedure.input(UserInput)`)}
    <p>Do not port every feature. Use transforms for trim and brand, inspect <code>issue.code</code> instead of installing an error-map language, and skip Map, Set and Promise schemas unless your boundary genuinely receives them.</p>`)
})

const integrations = page({
  title: 'Integrations — litetype',
  description: 'Use litetype with tRPC, Hono, React Hook Form, and any Standard Schema consumer.',
  path: '/docs/integrations/',
  active: 'docs',
  body: docs('integrations', `
    <p class="eyebrow">Ecosystem</p><h1>One wrapper, standard tools.</h1>
    <p class="intro">There is no litetype adapter matrix. Keep your schema bare, then call <code>standard(schema)</code> at an integration boundary.</p>
    <h2>tRPC</h2>
    ${code(`import { initTRPC } from '@trpc/server'
import { standard, string } from 'litetype'

const t = initTRPC.create()
const User = standard({ name: string.min(1) })

export const router = t.router({
  user: t.procedure.input(User).query(({ input }) => input),
})`)}
    <h2>Hono</h2>
    ${code(`import { sValidator } from '@hono/standard-validator'
import { Hono } from 'hono'
import { standard, string } from 'litetype'

const app = new Hono()
const User = standard({ name: string.min(1) })

app.post('/users', sValidator('json', User), c =>
  c.json(c.req.valid('json')))`)}
    <h2>React Hook Form</h2>
    ${code(`import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { standard, string } from 'litetype'

const User = { name: string.min(1), 'email?': string.email() }

useForm({ resolver: standardSchemaResolver(standard(User)) })`)}
    <h2>Any Standard Schema consumer</h2>
    <p>The wrapper exposes the Standard Schema V1 contract, including inferred input/output types and structured issues. If a tool accepts Standard Schema, it accepts litetype.</p>`)
})

const benchmarks = page({
  title: 'Benchmarks — litetype',
  description: 'Reproducible performance, bundle size, and TypeScript cost comparisons with Zod, AJV, and ArkType.',
  path: '/benchmarks/',
  active: 'benchmarks',
  body: docs('benchmarks', `
    <p class="eyebrow">Performance</p><h1>Compare contracts first.</h1>
    <p class="intro">litetype requires own properties and plain objects. Default AJV and ArkType accept inherited fields, so their fastest rows validate a weaker object contract.</p>
    <div class="benchmark-callout"><strong>5.00 kB gzip</strong><span>Smallest runtime library in this comparison.</span></div>
    <h2>Runtime throughput</h2>
    <p>Node 22.18.0, Apple M4 Max, 1,024 rotating inputs. Median of seven samples after warmup. Higher is better.</p>
    <div class="table-scroll"><table class="numbers"><thead><tr><th>Case</th><th>litetype</th><th>Zod 4</th><th>AJV default</th><th>AJV own</th><th>ArkType</th></tr></thead><tbody>
      <tr><td>Flat valid</td><td><strong>90.47M</strong></td><td>33.76M</td><td>98.03M</td><td>27.32M</td><td>53.64M</td></tr>
      <tr><td>Flat invalid</td><td>0.44M</td><td>0.21M</td><td>61.29M</td><td>22.87M</td><td>0.59M</td></tr>
      <tr><td>Nested ×10 valid</td><td><strong>8.49M</strong></td><td>2.62M</td><td>22.81M</td><td>5.31M</td><td>23.60M</td></tr>
      <tr><td>Nested ×10 invalid</td><td><strong>0.22M</strong></td><td>0.15M</td><td>6.84M</td><td>3.45M</td><td>0.20M</td></tr>
      <tr><td>Discriminated union</td><td><strong>27.42M</strong></td><td>23.51M</td><td>116.81M</td><td>41.97M</td><td>68.40M</td></tr>
      <tr><td>Cross-field refine</td><td><strong>23.64M</strong></td><td>10.90M</td><td>42.89M</td><td>27.99M</td><td>43.59M</td></tr>
    </tbody></table></div>
    <p><strong>AJV own</strong> enables <code>ownProperties: true</code>, matching litetype's required-key policy more closely. AJV returns a boolean on failure; litetype, Zod and ArkType construct structured errors.</p>
    <h2>Size</h2>
    <div class="table-scroll"><table class="numbers"><thead><tr><th>Runtime</th><th>Minified</th><th>Gzip</th><th>Brotli</th></tr></thead><tbody>
      <tr><td>litetype</td><td>17.80 kB</td><td><strong>5.00 kB</strong></td><td>4.55 kB</td></tr>
      <tr><td>Zod</td><td>327.27 kB</td><td>64.62 kB</td><td>53.93 kB</td></tr>
      <tr><td>AJV runtime</td><td>118.33 kB</td><td>36.35 kB</td><td>32.34 kB</td></tr>
      <tr><td>ArkType</td><td>153.47 kB</td><td>46.89 kB</td><td>41.41 kB</td></tr>
      <tr><td>AJV standalone</td><td>1.97 kB</td><td>0.50 kB</td><td>0.42 kB</td></tr>
    </tbody></table></div>
    <p>AJV standalone moves generation to build time and ships no runtime compiler. If schemas are static and a generation step is acceptable, it is smaller and faster than every runtime-schema library here.</p>
    <h2>Construction and TypeScript</h2>
    <table><tbody>
      <tr><td>Ready validator construction</td><td><strong>3.82 µs</strong></td><td>Zod 22.38 µs · AJV 111.28 µs · ArkType 44.33 µs</td></tr>
      <tr><td>TypeScript instantiations</td><td><strong>341</strong></td><td>CI budget: 10,000</td></tr>
      <tr><td>npm tarball</td><td><strong>30.1 kB</strong></td><td>Zod 759.6 kB · AJV 217.6 kB · ArkType 70.0 kB*</td></tr>
    </tbody></table>
    <h2>Reproduce</h2>
    ${code(`git clone https://github.com/nightsumx/litetype.git
cd litetype
bun install
bun run bench
bun run bench:size
bun run perf:type`, 'Terminal')}
    <p>Absolute values depend on the machine. The fixtures, warmup, samples and object-policy notes live in <a href="https://github.com/nightsumx/litetype/blob/main/BENCH.md">BENCH.md</a>.</p>`)
})

const routes = [
  ['/', home],
  ['/docs/', start],
  ['/docs/api/', api],
  ['/docs/zod/', zod],
  ['/docs/integrations/', integrations],
  ['/benchmarks/', benchmarks],
]

await rm(out, { recursive: true, force: true })

for (const [route, html] of routes) {
  const target = route === '/' ? join(out, 'index.html') : join(out, route.slice(1), 'index.html')
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, html)
}

await cp(join(root, 'style.css'), join(out, 'style.css'))
await cp(join(root, 'site.js'), join(out, 'site.js'))
await cp(join(root, 'icon.svg'), join(out, 'icon.svg'))
await cp(join(root, 'social.svg'), join(out, 'social.svg'))
await cp(join(root, 'social.png'), join(out, 'social.png'))
await writeFile(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://litetype.org/sitemap.xml\n')
await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(([route]) => `  <url><loc>https://litetype.org${route}</loc></url>`).join('\n')}
</urlset>\n`)
await writeFile(join(out, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'

/*.svg
  Cache-Control: public, max-age=604800
`)

console.log(`Built ${routes.length} pages in ${out}`)
