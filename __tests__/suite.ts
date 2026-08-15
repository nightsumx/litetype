import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

type Run<T> = (input: T, opts: unknown, ctx: { inputs: Record<string, unknown>, name: string }) => string | Promise<string>

function read(path: string): string {
    let value = readFileSync(path, 'utf8')
    while (value.endsWith('\n') || value.endsWith('\r'))
        value = value.slice(0, -1)
    return value
}

export function createSuite(testDir: string) {
    return function snapshotSuite<T = unknown>(name: string, run: Run<T>): void {
        const root = join(testDir, '__fixtures__', name)
        for (const dir of readdirSync(root, { withFileTypes: true })) {
            if (!dir.isDirectory())
                continue
            test(dir.name, async () => {
                const caseDir = join(root, dir.name)
                const inputs: Record<string, unknown> = {}
                for (const file of readdirSync(caseDir)) {
                    if (file === 'out.txt' || file === 'opts.json')
                        continue
                    const dot = file.lastIndexOf('.')
                    const key = dot < 0 ? file : file.slice(0, dot)
                    const raw = read(join(caseDir, file))
                    inputs[key] = file.endsWith('.json') ? JSON.parse(raw) : raw
                }
                const keys = Object.keys(inputs)
                const input = (keys.length === 1 ? inputs[keys[0]] : keys.length ? inputs : undefined) as T
                const optsPath = join(caseDir, 'opts.json')
                const opts = existsSync(optsPath) ? JSON.parse(read(optsPath)) : undefined
                const actual = await run(input, opts, { inputs, name: dir.name })
                expect(actual).toBe(read(join(caseDir, 'out.txt')))
            })
        }
    }
}

export function law(name: string, fn: (...args: never[]) => unknown, invariants: Array<(out: unknown, ...args: never[]) => boolean>, options: { inputs: unknown[][] }): void {
    for (const invariant of invariants) {
        test(`${name} · ${invariant.name || 'predicate'}`, () => {
            for (const args of options.inputs) {
                const call = fn as unknown as (...values: unknown[]) => unknown
                const check = invariant as unknown as (out: unknown, ...values: unknown[]) => boolean
                expect(check(call(...args), ...args)).toBe(true)
            }
        })
    }
}

export function roundtrip<A extends unknown[], B>(name: string, encode: (...args: A) => B, decode: (encoded: B) => A[0], options: { inputs: unknown[][] }): void {
    test(`${name} · roundtrip · predicate`, () => {
        for (const args of options.inputs) {
            const input = args as A
            const output = decode(encode(...input))
            expect(output === input[0] || (typeof output === 'number' && typeof input[0] === 'number' && Number.isNaN(output) && Number.isNaN(input[0]))).toBe(true)
        }
    })
}
