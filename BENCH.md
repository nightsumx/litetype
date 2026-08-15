# litetype parse-throughput benchmark

litetype vs [zod](https://zod.dev) vs [valibot](https://valibot.dev), parse throughput
on four representative cases. Higher ops/sec is faster.

> Numbers are machine-dependent and vary run-to-run (JIT, GC, thermal). Treat the
> **relative multipliers** as the signal, not the absolute ops/sec. Reproduce on your
> own hardware before citing (see bottom).

## Setup

- Versions: `litetype@0.1.0` (built `dist/`), `zod@4.4.3`, `valibot@1.4.1`
- Node `v22.18.0`
- Each lib uses its safeParse equivalent (no throwing): litetype `safeParse(schema, x)`,
  zod `schema.safeParse(x)`, valibot `v.safeParse(schema, x)`.
- 500,000 iterations per case, 50,000-iteration warmup, timed with `performance.now()`.
- Schemas are validated against one input before timing (printed by the harness) so we're
  measuring real validation, not a no-op.

## Results

Representative single run (Apple Silicon, macOS). ops/sec, rounded.

| Case | litetype | zod | valibot | litetype vs zod | litetype vs valibot |
|------|---------:|----:|--------:|:---------------:|:------------:|
| (a) flat object, valid (hot path) | 3,566,403 | 35,313,019 | 5,447,454 | **0.10× (zod 9.9× faster)** | 0.65× (valibot 1.5× faster) |
| (b) flat object, INVALID (error path) | 393,211 | 186,781 | 3,851,260 | **2.11× faster than zod** | 0.10× (valibot 9.8× faster) |
| (c) nested object + array of 10, valid | 455,099 | 2,623,648 | 866,866 | 0.17× (zod 5.8× faster) | 0.53× (valibot 1.9× faster) |
| (d) string `.email().min(5)`, valid | 5,727,098 | 11,442,771 | 16,555,424 | 0.50× (zod 2.0× faster) | 0.35× (valibot 2.9× faster) |

### Honest read

litetype is **not** the throughput leader here. zod 4 and valibot both precompile/specialize
their validators; litetype interprets a bare object-literal schema by walking it on every
call, which costs more per parse.

- **(a) hot path:** litetype is the slowest — ~10× behind zod 4 and ~1.5× behind valibot.
  zod 4's compiled fast-path on a flat valid object is in a different class (~28 ns/op).
- **(b) error path:** litetype's one genuine win over zod — ~2.1× faster, because litetype
  collects issues without building zod's heavier error machinery. valibot is still far ahead.
- **(c) nested + array:** litetype slowest again; the per-element interpreter overhead
  compounds across the 10-element array.
- **(d) email + min:** litetype mid-pack — ~2× behind zod, ~3× behind valibot.

litetype's pitch is ergonomics (bare-literal schemas, zero deps, external verbs), not raw
parse speed. On these cases it trails zod 4 and valibot on the valid hot paths and wins only
the zod error-path comparison. Cite accordingly.

### Run-to-run variance

Absolute numbers move ±10–40% between runs (and case (c)/(d) ratios shift more when the
machine is loaded), but the ordering is stable: on valid paths litetype < valibot < zod, and
on the error path litetype > zod. Re-run a few times and report a representative run rather
than a single sample.

## How to reproduce

```bash
cd packages/litetype
bun run build                 # build dist/ that the harness imports
bun add -d zod valibot        # zod@4.x, valibot@1.x
node bench/bench.mjs          # prints sanity check + timings + a JSON dump
```

- Node used for the table above: `v22.18.0`. Print yours with `node --version`.
- The harness aborts if any schema doesn't validate as intended, so a clean run means the
  numbers reflect real parsing.
- Numbers are machine-dependent (CPU, Node/V8 version, thermal state, background load). Close
  other work and run 3+ times.
