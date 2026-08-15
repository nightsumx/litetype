// Parse-throughput benchmark: litetype vs zod vs valibot.
// Throwaway harness — plain ESM, no test framework. Run: node bench/bench.mjs
//
// Each case defines a semantically-equivalent schema in all three libs and
// runs the same input through each lib's safeParse equivalent. We measure
// ops/sec via performance.now() over a fixed iteration budget, after warmup.

import { string, number, array, safeParse as ltSafeParse } from '../dist/index.js'
import { z } from 'zod'
import * as v from 'valibot'

// ---------- schemas ----------

// (a)/(b) flat: 3 strings + 1 number
const lt_flat = { name: string, email: string, city: string, age: number }
const z_flat = z.object({ name: z.string(), email: z.string(), city: z.string(), age: z.number() })
const v_flat = v.object({ name: v.string(), email: v.string(), city: v.string(), age: v.number() })

// (c) nested: object with array of 10 objects
const lt_item = { id: number, label: string }
const lt_nested = { id: number, title: string, items: array(lt_item) }
const z_item = z.object({ id: z.number(), label: z.string() })
const z_nested = z.object({ id: z.number(), title: z.string(), items: z.array(z_item) })
const v_item = v.object({ id: v.number(), label: v.string() })
const v_nested = v.object({ id: v.number(), title: v.string(), items: v.array(v_item) })

// (d) string with email + min length
const lt_email = string.email().min(5)
const z_email = z.string().email().min(5)
const v_email = v.pipe(v.string(), v.email(), v.minLength(5))

// ---------- inputs ----------

const flatValid = { name: 'Ada Lovelace', email: 'ada@example.com', city: 'London', age: 36 }
const flatInvalid = { name: 'Ada', email: 'ada@example.com', city: 'London', age: 'thirty-six' } // age wrong type

const nestedValid = {
  id: 1,
  title: 'list',
  items: Array.from({ length: 10 }, (_, i) => ({ id: i, label: 'item-' + i })),
}

const emailValid = 'ada@example.com'

// ---------- runners (each returns a result object, never throws) ----------

const cases = [
  {
    name: '(a) flat object, valid',
    runners: {
      litetype: () => ltSafeParse(lt_flat, flatValid),
      zod: () => z_flat.safeParse(flatValid),
      valibot: () => v.safeParse(v_flat, flatValid),
    },
    ok: r => r.success === true,
  },
  {
    name: '(b) flat object, INVALID (error path)',
    runners: {
      litetype: () => ltSafeParse(lt_flat, flatInvalid),
      zod: () => z_flat.safeParse(flatInvalid),
      valibot: () => v.safeParse(v_flat, flatInvalid),
    },
    ok: r => r.success === false,
  },
  {
    name: '(c) nested object + array of 10, valid',
    runners: {
      litetype: () => ltSafeParse(lt_nested, nestedValid),
      zod: () => z_nested.safeParse(nestedValid),
      valibot: () => v.safeParse(v_nested, nestedValid),
    },
    ok: r => r.success === true,
  },
  {
    name: '(d) string .email().min(5), valid',
    runners: {
      litetype: () => ltSafeParse(lt_email, emailValid),
      zod: () => z_email.safeParse(emailValid),
      valibot: () => v.safeParse(v_email, emailValid),
    },
    ok: r => r.success === true,
  },
]

const LIBS = ['litetype', 'zod', 'valibot']

// ---------- sanity: print one result per (case, lib) so we know it's not a no-op ----------

console.log('=== sanity check (one safeParse result per case/lib) ===\n')
for (const c of cases) {
  console.log(c.name)
  for (const lib of LIBS) {
    const r = c.runners[lib]()
    const pass = c.ok(r)
    const issues = r.success ? 0 : (r.error?.issues?.length ?? r.issues?.length ?? '?')
    console.log(`  ${lib.padEnd(9)} success=${String(r.success).padEnd(5)} expectedOK=${pass}  issues=${issues}`)
    if (!pass) {
      console.error(`  !! ${lib} did NOT behave as expected for "${c.name}" — aborting`)
      process.exit(1)
    }
  }
  console.log('')
}

// ---------- timing ----------

const WARMUP = 50_000
const ITERS = 500_000

function bench(fn) {
  // warmup
  for (let i = 0; i < WARMUP; i++) fn()
  // measure
  const t0 = performance.now()
  for (let i = 0; i < ITERS; i++) fn()
  const t1 = performance.now()
  const ms = t1 - t0
  const opsPerSec = (ITERS / ms) * 1000
  const nsPerOp = (ms * 1e6) / ITERS
  return { opsPerSec, nsPerOp }
}

console.log(`=== timing: ${ITERS.toLocaleString()} iters/case (warmup ${WARMUP.toLocaleString()}) ===\n`)

const results = []
for (const c of cases) {
  const row = { case: c.name, libs: {} }
  for (const lib of LIBS) {
    const { opsPerSec, nsPerOp } = bench(c.runners[lib])
    row.libs[lib] = { opsPerSec, nsPerOp }
    console.log(`${c.name}\n  ${lib.padEnd(9)} ${Math.round(opsPerSec).toLocaleString().padStart(14)} ops/s   ${nsPerOp.toFixed(1).padStart(8)} ns/op`)
  }
  console.log('')
  results.push(row)
}

// ---------- machine-readable dump (for building BENCH.md) ----------

console.log('=== JSON ===')
console.log(JSON.stringify({ node: process.version, warmup: WARMUP, iters: ITERS, results }, null, 2))
