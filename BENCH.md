# Performance and size

Current litetype compiles a schema on first use into a specialized predicate. The result is
not “fastest under every contract”:

- It is 2.7x faster than Zod on a flat valid object and 3.2x faster with ten nested items.
- It is 3.3x/1.6x faster than AJV with its matching own-property setting.
- AJV and ArkType remain faster with their default, weaker object contract.
- It is still the smallest runtime library here: 5.00 kB min+gzip.

The semantic distinction matters. A required litetype field must be an own property and an
object must have `Object.prototype` or `null` as its prototype. Zod, ArkType, and default AJV
accept this value:

```js
const input = Object.create({ name: 'Ada', age: 36 })
```

AJV's matching required-key setting is `ownProperties: true` (litetype additionally rejects
class instances). Removing litetype's checks makes a different, less defensive validator; it
is not a valid optimization of the same contract.

## Summary

Node 22.18.0 on an Apple M4 Max, rotating 1,024 real inputs:

| Metric | litetype | Zod 4.4.3 | AJV 8.20 default | AJV own properties | ArkType 2.2.3 |
|---|---:|---:|---:|---:|---:|
| Flat object, valid | **90.47M** | 33.76M | 98.03M | 27.32M | 53.64M |
| Nested array x10, valid | **8.49M** | 2.62M | 22.81M | 5.31M | 23.60M |
| Compiled flat predicate | **80.58M** | 31.58M | 107.07M | 28.98M | 163.72M |
| Ready validator construction | **3.82 us** | 22.38 us | 111.28 us | — | 44.33 us |
| Browser bundle, min+gzip | **5.00 kB** | 64.62 kB | 36.35 kB | same | 46.89 kB |
| npm tarball | **30.1 kB** | 759.6 kB | 217.6 kB | same | 70.0 kB* |
| TypeScript instantiations | **341** | — | — | — | — |

\* ArkType's npm tarball excludes dependencies; its browser bundle includes them.

“Flat” has four required fields. “Nested” has an outer object and an array of ten two-field
objects. The normal litetype rows use `safeParse`; the predicate row uses `compile(schema)`.
AJV returns a boolean in every row, so its failure cost is not an error-object comparison.

## Runtime throughput

Higher is better, in operations per second. These are medians of seven timed samples after
warmup.

| Case | litetype | Zod | AJV default | AJV own | ArkType |
|---|---:|---:|---:|---:|---:|
| Flat valid | **90.47M** | 33.76M | 98.03M | 27.32M | 53.64M |
| Flat invalid | 0.44M | 0.21M | 61.29M | 22.87M | 0.59M |
| Nested x10 valid | **8.49M** | 2.62M | 22.81M | 5.31M | 23.60M |
| Nested x10 invalid | **0.22M** | 0.15M | 6.84M | 3.45M | 0.20M |
| Discriminated union valid | **27.42M** | 23.51M | 116.81M | 41.97M | 68.40M |
| Cross-field refine valid | **23.64M** | 10.90M | 42.89M | 27.99M | 43.59M |
| Compiled flat predicate | **80.58M** | 31.58M | 107.07M | 28.98M | 163.72M |

Bold litetype values mean it leads Zod and AJV under the matching own-property setting,
not that it leads every column.

On invalid data, litetype and Zod `safeParse` allocate structured errors. ArkType constructs
`ArkErrors`. AJV returns a boolean and mutates `validator.errors`. Those rows describe normal
API cost, but do not isolate validation logic.

`compile(schema)` returns the predicate already cached by `check`, `parse`, and `safeParse`:

```ts
const allowsUser = compile(User)
for (const value of values) {
  if (allowsUser(value)) consume(value)
}
```

Use it only for a hot loop. The ordinary verbs already compile automatically.
The compiler uses dynamic function generation. Under a strict CSP it falls back to the original
interpreter, preserving behavior but not the throughput in this table.

## Size

The browser fixture exports one four-field object validator. esbuild 0.27 bundles ESM for the
browser with tree-shaking and minification; gzip uses level 9.

| Deployment | Minified | Gzip | Brotli |
|---|---:|---:|---:|
| litetype runtime schema + compiler | **17.80 kB** | **5.00 kB** | **4.55 kB** |
| Zod runtime schema | 327.27 kB | 64.62 kB | 53.93 kB |
| AJV runtime compiler | 118.33 kB | 36.35 kB | 32.34 kB |
| ArkType runtime schema | 153.47 kB | 46.89 kB | 41.41 kB |
| AJV standalone generated validator | **1.97 kB** | **0.50 kB** | **0.42 kB** |

AJV standalone is a different deployment model: generation happens at build time and no
runtime schema compiler ships. If schemas are static and a generation step is acceptable, it
is both smaller and faster than every runtime-schema library in this table.

## TypeScript cost

`Infer` reads two symbol tags instead of structurally expanding every chainable schema method.
The committed fixture now needs 341 type instantiations; CI rejects regressions above 10,000.
The previous implementation needed about 1.2 million.

```sh
bun run perf:type
```

This budget is a regression gate, not a cross-library ranking: each library exposes a different
amount of type machinery in an equivalent-looking fixture.

## Method

- Machine: Apple M4 Max, macOS arm64.
- Runtime: Node 22.18.0.
- Inputs: 1,024 rotating objects per case; no repeated constant-object benchmark.
- Warmup: up to 50,000 calls before measurement.
- Samples: median of seven; schema construction excluded from throughput.
- Required fields: own properties for litetype and AJV-own; inherited values accepted by the
  other three default configurations.
- Extra enumerable properties: allowed in these runtime cases.
- AJV: `allErrors: true`, `discriminator: true`, `$data: true`, `strict: false`.

Reproduce:

```bash
bun install
bun run bench
bun run bench:size
bun run perf:type
```

Absolute values depend on the machine. Compare contracts first, then repeated relative order.
