import type { Issue } from './error'
import type { Check, CheckMeta, Kind } from './node'
import type { INPUT, Schema, TYPE } from './types'
import { combinators, KIND } from './node'

// check 返回 false = 型错，walker 短路后续 refinement。refinement 只 push issue、继续 collect-all。
export abstract class Leaf<T> {
    declare readonly [TYPE]: T
    declare readonly [INPUT]: T
    readonly [KIND]: Kind
    readonly checks: ReadonlyArray<Check>

    constructor(kind: Kind, checks: ReadonlyArray<Check>, extra?: Record<string, unknown>) {
        this[KIND] = kind
        this.checks = checks
        if (extra)
            Object.assign(this, extra)
        Object.freeze(this)
    }

    protected with(fn: (v: T, path: ReadonlyArray<PropertyKey>, issues: Issue[]) => boolean | void, meta?: CheckMeta): this {
        const extra: Check = (v, path, issues) => fn(v as T, path, issues) !== false
        if (meta)
            extra.meta = meta
        const Ctor = this.constructor as new (kind: Kind, checks: ReadonlyArray<Check>) => this
        return new Ctor(this[KIND], Object.freeze([...this.checks, extra]))
    }
}
export interface Leaf<T> extends Schema<T> {}

Object.assign(Leaf.prototype, combinators)

export function typeCheck(expected: string, label: string): Check {
    return (v, path, issues) => {
        if (typeof v !== expected) {
            issues.push({ path, message: `expected ${label}, got ${v === null ? 'null' : typeof v}`, code: 'invalid_type' })
            return false
        }
        return true
    }
}

// ── string ────────────────────────────────────────────────────────────────

class StringSchema extends Leaf<string> {
    min(n: number, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (v.length < n)
                issues.push({ path, message: message ?? `length must be >= ${n}`, code: 'too_small' })
        }, { keyword: { minLength: n } })
    }

    max(n: number, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (v.length > n)
                issues.push({ path, message: message ?? `length must be <= ${n}`, code: 'too_big' })
        }, { keyword: { maxLength: n } })
    }

    email(message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!isEmail(v))
                issues.push({ path, message: message ?? 'invalid email', code: 'invalid_string' })
        }, { keyword: { format: 'email' } })
    }

    url(message?: string): StringSchema {
        return this.with((v, path, issues) => {
            try {
                void new URL(v)
            }
            catch {
                issues.push({ path, message: message ?? 'invalid url', code: 'invalid_string' })
            }
        }, { keyword: { format: 'uri' } })
    }

    // 唯一允许的正则：校验用户提供的 pattern 对用户数据，不是我们解析结构化文本。
    regex(re: RegExp, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!re.test(v))
                issues.push({ path, message: message ?? `must match ${re}`, code: 'invalid_string' })
        }, { keyword: { pattern: re.source } })
    }

    length(n: number, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (v.length !== n)
                issues.push({ path, message: message ?? `length must be ${n}`, code: 'invalid_string' })
        }, { keyword: { minLength: n, maxLength: n } })
    }

    startsWith(prefix: string, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!v.startsWith(prefix))
                issues.push({ path, message: message ?? `must start with ${JSON.stringify(prefix)}`, code: 'invalid_string' })
        })
    }

    endsWith(suffix: string, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!v.endsWith(suffix))
                issues.push({ path, message: message ?? `must end with ${JSON.stringify(suffix)}`, code: 'invalid_string' })
        })
    }

    includes(substr: string, message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!v.includes(substr))
                issues.push({ path, message: message ?? `must include ${JSON.stringify(substr)}`, code: 'invalid_string' })
        })
    }

    ip(message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!isIpv4(v) && !isIpv6(v))
                issues.push({ path, message: message ?? 'invalid ip', code: 'invalid_string' })
        })
    }

    uuid(message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!isUuid(v))
                issues.push({ path, message: message ?? 'invalid uuid', code: 'invalid_string' })
        }, { keyword: { format: 'uuid' } })
    }

    datetime(message?: string): StringSchema {
        return this.with((v, path, issues) => {
            if (!isIsoDatetime(v))
                issues.push({ path, message: message ?? 'invalid ISO datetime', code: 'invalid_string' })
        }, { keyword: { format: 'date-time' } })
    }
}

function isIpv4(s: string): boolean {
    const parts = s.split('.')
    if (parts.length !== 4)
        return false
    for (const p of parts) {
        if (p.length === 0 || p.length > 3)
            return false
        for (const c of p) {
            if (c < '0' || c > '9')
                return false
        }
        if (p.length > 1 && p[0] === '0')
            return false
        if (Number(p) > 255)
            return false
    }
    return true
}

function isIpv6(s: string): boolean {
    const dbl = s.indexOf('::')
    if (dbl !== s.lastIndexOf('::'))
        return false
    const hasDouble = dbl !== -1
    const groups = s.split(':')
    const last = groups[groups.length - 1]
    const v4Tail = last.includes('.')
    if (v4Tail && !isIpv4(last))
        return false
    const hexGroups = v4Tail ? groups.slice(0, -1) : groups
    let count = 0
    for (const g of hexGroups) {
        if (g === '')
            continue
        if (g.length > 4)
            return false
        for (const c of g) {
            if (!isHex(c))
                return false
        }
        count++
    }
    const need = v4Tail ? 6 : 8
    return hasDouble ? count <= need : count === need
}

function isUuid(s: string): boolean {
    if (s.length !== 36)
        return false
    for (let i = 0; i < 36; i++) {
        const c = s[i]
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            if (c !== '-')
                return false
        }
        else if (!isHex(c)) {
            return false
        }
    }
    return true
}

function isHex(c: string): boolean {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

function isIsoDatetime(s: string): boolean {
    if (s.length < 19 || s[4] !== '-' || s[7] !== '-' || (s[10] !== 'T' && s[10] !== 't') || s[13] !== ':' || s[16] !== ':')
        return false
    return !Number.isNaN(new Date(s).getTime())
}

function isEmail(s: string): boolean {
    const at = s.indexOf('@')
    return at > 0
        && at === s.lastIndexOf('@')
        && at < s.length - 1
        && !hasSpace(s)
        && domainOk(s.slice(at + 1))
}

function hasSpace(s: string): boolean {
    for (const ch of s) {
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r')
            return true
    }
    return false
}

function domainOk(domain: string): boolean {
    const dot = domain.indexOf('.')
    if (dot <= 0 || dot >= domain.length - 1)
        return false
    for (const part of domain.split('.')) {
        if (part.length === 0)
            return false
    }
    return true
}

export const string: StringSchema = new StringSchema('string', Object.freeze([typeCheck('string', 'string')]))

// ── number ────────────────────────────────────────────────────────────────

class NumberSchema extends Leaf<number> {
    min(n: number, message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (v < n)
                issues.push({ path, message: message ?? `must be >= ${n}`, code: 'too_small' })
        }, { keyword: { minimum: n } })
    }

    max(n: number, message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (v > n)
                issues.push({ path, message: message ?? `must be <= ${n}`, code: 'too_big' })
        }, { keyword: { maximum: n } })
    }

    gt(n: number, message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (v <= n)
                issues.push({ path, message: message ?? `must be > ${n}`, code: 'too_small' })
        }, { keyword: { exclusiveMinimum: n } })
    }

    lt(n: number, message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (v >= n)
                issues.push({ path, message: message ?? `must be < ${n}`, code: 'too_big' })
        }, { keyword: { exclusiveMaximum: n } })
    }

    int(message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (!Number.isInteger(v))
                issues.push({ path, message: message ?? 'must be an integer', code: 'invalid_type' })
        }, { keyword: { type: 'integer' } })
    }

    finite(message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (!Number.isFinite(v))
                issues.push({ path, message: message ?? 'must be finite', code: 'invalid_type' })
        })
    }

    positive(message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (v <= 0)
                issues.push({ path, message: message ?? 'must be positive', code: 'too_small' })
        }, { keyword: { exclusiveMinimum: 0 } })
    }

    nonnegative(message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (v < 0)
                issues.push({ path, message: message ?? 'must be >= 0', code: 'too_small' })
        }, { keyword: { minimum: 0 } })
    }

    multipleOf(n: number, message?: string): NumberSchema {
        return this.with((v, path, issues) => {
            if (!isMultipleOf(v, n))
                issues.push({ path, message: message ?? `must be a multiple of ${n}`, code: 'not_multiple_of' })
        }, { keyword: { multipleOf: n } })
    }
}

function decimals(x: number): number {
    if (Number.isInteger(x))
        return 0
    const s = String(x)
    const e = s.indexOf('e-')
    if (e !== -1)
        return Number(s.slice(e + 2)) + (s.slice(0, e).split('.')[1]?.length ?? 0)
    return s.split('.')[1]?.length ?? 0
}

function isMultipleOf(v: number, n: number): boolean {
    const scale = 10 ** Math.max(decimals(v), decimals(n))
    return Math.round(v * scale) % Math.round(n * scale) === 0
}

export const number: NumberSchema = new NumberSchema('number', Object.freeze([
    (v, path, issues) => {
        if (typeof v !== 'number' || Number.isNaN(v)) {
            issues.push({ path, message: `expected number, got ${typeof v === 'number' ? 'NaN' : typeof v}`, code: 'invalid_type' })
            return false
        }
        return true
    },
]))

// ── boolean / unknown / date ──────────────────────────────────────────────

class BooleanSchema extends Leaf<boolean> {}
class UnknownSchema extends Leaf<unknown> {}

class DateSchema extends Leaf<Date> {
    min(d: Date, message?: string): DateSchema {
        return this.with((v, path, issues) => {
            if (v.getTime() < d.getTime())
                issues.push({ path, message: message ?? `must be >= ${d.toISOString()}`, code: 'too_small' })
        })
    }

    max(d: Date, message?: string): DateSchema {
        return this.with((v, path, issues) => {
            if (v.getTime() > d.getTime())
                issues.push({ path, message: message ?? `must be <= ${d.toISOString()}`, code: 'too_big' })
        })
    }
}

export const boolean: BooleanSchema = new BooleanSchema('boolean', Object.freeze([typeCheck('boolean', 'boolean')]))
export const unknown: UnknownSchema = new UnknownSchema('unknown', Object.freeze([]))
export const date: DateSchema = new DateSchema('date', Object.freeze([
    (v, path, issues) => {
        if (!(v instanceof Date) || Number.isNaN(v.getTime())) {
            issues.push({ path, message: 'expected Date', code: 'invalid_type' })
            return false
        }
        return true
    },
]))

// ── literal / enum ────────────────────────────────────────────────────────

class LiteralSchema<V extends string | number | boolean | null> extends Leaf<V> {
    declare readonly value: V
}
class EnumSchema<V extends string | number> extends Leaf<V> {
    declare readonly values: readonly V[]
}

export function literal<const V extends string | number | boolean | null>(value: V): LiteralSchema<V> {
    return new LiteralSchema<V>('literal', Object.freeze([
        (v, path, issues) => {
            if (!Object.is(v, value)) {
                issues.push({ path, message: `expected literal ${format(value)}, got ${format(v)}`, code: 'invalid_value' })
                return false
            }
            return true
        },
    ]), { value })
}

export function enum_<const V extends readonly (string | number)[]>(values: V): EnumSchema<V[number]> {
    const set = new Set<unknown>(values)
    return new EnumSchema<V[number]>('enum', Object.freeze([
        (v, path, issues) => {
            if (!set.has(v)) {
                issues.push({ path, message: `expected one of [${values.map(format).join(', ')}], got ${format(v)}`, code: 'invalid_value' })
                return false
            }
            return true
        },
    ]), { values })
}

function format(v: unknown): string {
    if (typeof v === 'string')
        return JSON.stringify(v)
    if (v === null)
        return 'null'
    return String(v)
}
