import { expect, test } from 'vitest'
import { check, compile, safeParse } from '../src/parse'
import { number, string } from '../src/leaf'
import { array, fallback, preprocess, record, refine, strict, strip, tuple, union } from '../src/compose'
import { boolean, literal } from '../src/leaf'

test('first validation freezes compiled shapes', () => {
    const Item = { id: number, label: string }
    const List = { title: string, items: array(Item) }

    expect(check(List, { title: 'x', items: [{ id: 1, label: 'a' }] })).toBe(true)
    expect(Object.isFrozen(List)).toBe(true)
    expect(Object.isFrozen(Item)).toBe(true)
    expect(() => Object.assign(List, { title: number })).toThrow()
})

test('compiled validation keeps constraints and refinement semantics', () => {
    const Signup = refine(
        { password: string.min(8), confirm: string },
        value => value.password === value.confirm,
        'passwords do not match',
    )

    expect(check(Signup, { password: 'abcdefgh', confirm: 'abcdefgh' })).toBe(true)
    expect(check(Signup, { password: 'short', confirm: 'short' })).toBe(false)
    expect(check(Signup, { password: 'abcdefgh', confirm: 'abcdefgi' })).toBe(false)

    const failed = safeParse(Signup, { password: 'abcdefgh', confirm: 'abcdefgi' })
    expect(failed.success).toBe(false)
    if (!failed.success)
        expect(failed.error.issues).toEqual([{ path: [], message: 'passwords do not match', code: 'custom' }])
})

test('compile returns a memoized type predicate', () => {
    const User = { name: string, age: number }
    const allows = compile(User)

    expect(allows).toBe(compile(User))
    expect(allows({ name: 'Ada', age: 36 })).toBe(true)
    expect(allows({ name: 'Ada', age: '36' })).toBe(false)
})

test('compiled predicates agree with full validation', () => {
    const cases: [unknown, unknown][] = [
        [string.min(2), 'a'],
        [array(number), [1, 2]],
        [tuple(string, number), ['x', 1]],
        [record(boolean), { a: true, b: false }],
        [union(literal('x'), number), false],
        [strict({ name: string }), { name: 'x', extra: true }],
        [strip({ name: string }), { name: 'x', extra: true }],
        [string.default('x'), undefined],
        [{ value: refine(string.default('x'), () => false, 'bad default') }, {}],
        [fallback(number, 0), 'bad'],
        [preprocess(value => Number(value), number), '1'],
        [string.nullish(), null],
    ]

    for (const [schema, value] of cases)
        expect(compile(schema)(value)).toBe(safeParse(schema, value).success)
})

test('dynamic-code failure falls back to the interpreter', () => {
    const native = globalThis.Function
    Object.defineProperty(globalThis, 'Function', { configurable: true, value() { throw new Error('blocked') } })
    try {
        const Feature = { enabled: boolean }
        expect(check(Feature, { enabled: true })).toBe(true)
        expect(check(Feature, { enabled: 'yes' })).toBe(false)
    }
    finally {
        Object.defineProperty(globalThis, 'Function', { configurable: true, writable: true, value: native })
    }
})
