import type { Issue } from './error'
import { isSchema, KIND } from './node'

// 型错打 FATAL，供外层 refine 跳过谓词；兄弟 refinement 失败不跳。消费者看不见这个 key。
const FATAL = Symbol('schema.fatal')
function pushFatal(issues: Issue[], issue: Issue): void {
    issues.push(Object.assign(issue, { [FATAL]: true }))
}
function hasFatalSince(issues: Issue[], before: number): boolean {
    for (let i = before; i < issues.length; i++) {
        if (FATAL in issues[i])
            return true
    }
    return false
}

export function validateInto(
    schema: unknown,
    data: unknown,
    path: ReadonlyArray<PropertyKey>,
    issues: Issue[],
): unknown {
    if (isSchema(schema)) {
        switch (schema[KIND]) {
            case 'string':
            case 'number':
            case 'boolean':
            case 'date':
            case 'unknown':
            case 'literal':
            case 'enum':
                runChecks(schema.checks, data, path, issues)
                return data
            case 'array': {
                if (!Array.isArray(data)) {
                    pushFatal(issues, { path, message: `expected array, got ${describe(data)}`, code: 'invalid_type' })
                    return data
                }
                return mapPreserve(data, (el, i) => validateInto(schema.element, el, [...path, i], issues))
            }
            case 'tuple': {
                if (!Array.isArray(data)) {
                    pushFatal(issues, { path, message: `expected array, got ${describe(data)}`, code: 'invalid_type' })
                    return data
                }
                if (data.length !== schema.items.length) {
                    pushFatal(issues, { path, message: `expected tuple of length ${schema.items.length}, got ${data.length}`, code: 'invalid_type' })
                    return data
                }
                return mapPreserve(data, (el, i) => validateInto(schema.items[i], el, [...path, i], issues))
            }
            case 'record': {
                if (!isPlainObject(data)) {
                    pushFatal(issues, { path, message: `expected object, got ${describe(data)}`, code: 'invalid_type' })
                    return data
                }
                let out: Record<string, unknown> | undefined
                for (const k of Object.keys(data)) {
                    if (schema.key !== undefined)
                        validateInto(schema.key, k, [...path, k], issues)
                    const v = validateInto(schema.value, data[k], [...path, k], issues)
                    if (v !== data[k])
                        (out ??= { ...data })[k] = v
                }
                return out ?? data
            }
            case 'union': {
                const branches: string[] = []
                for (let i = 0; i < schema.members.length; i++) {
                    const trial: Issue[] = []
                    const out = validateInto(schema.members[i], data, [], trial)
                    if (trial.length === 0)
                        return out
                    for (const t of trial) {
                        const at = t.path.length ? t.path.map(String).join('.') : '·'
                        branches.push(`  member ${i} @ ${at}: ${t.message}`)
                    }
                }
                const body = branches.length ? `\n${branches.join('\n')}` : ''
                issues.push({ path, message: `no union member matched${body}`, code: 'invalid_union' })
                return data
            }
            case 'discriminated': {
                if (!isPlainObject(data)) {
                    pushFatal(issues, { path, message: `expected object, got ${describe(data)}`, code: 'invalid_type' })
                    return data
                }
                const tag = data[schema.key]
                const member = schema.map.get(tag)
                if (member === undefined) {
                    pushFatal(issues, { path: [...path, schema.key], message: `invalid discriminator value ${tag === undefined ? 'undefined' : JSON.stringify(tag)}`, code: 'invalid_value' })
                    return data
                }
                return validateInto(member, data, path, issues)
            }
            case 'lazy':
                return validateInto(schema.resolve(), data, path, issues)
            case 'describe':
                return validateInto(schema.inner, data, path, issues)
            case 'strict':
                return validateShape(schema.shape, data, path, issues, 'strict')
            case 'strip':
                return validateShape(schema.shape, data, path, issues, 'strip')
            case 'transform': {
                const before = issues.length
                const validated = validateInto(schema.inner, data, path, issues)
                if (issues.length > before)
                    return data
                try {
                    return schema.fn(validated)
                }
                catch (e) {
                    pushFatal(issues, { path, message: e instanceof Error ? e.message : String(e), code: 'custom' })
                    return data
                }
            }
            case 'default':
                return data === undefined ? schema.value : validateInto(schema.inner, data, path, issues)
            case 'catch': {
                const trial: Issue[] = []
                const out = validateInto(schema.inner, data, path, trial)
                return trial.length ? schema.value : out
            }
            case 'undefinable':
                return data === undefined ? data : validateInto(schema.inner, data, path, issues)
            case 'nullable':
                return data === null ? data : validateInto(schema.inner, data, path, issues)
            case 'nullish':
                return data === undefined || data === null ? data : validateInto(schema.inner, data, path, issues)
            case 'preprocess': {
                let next: unknown
                try {
                    next = schema.fn(data)
                }
                catch (e) {
                    pushFatal(issues, { path, message: e instanceof Error ? e.message : String(e), code: 'custom' })
                    return data
                }
                return validateInto(schema.inner, next, path, issues)
            }
            case 'refine': {
                const before = issues.length
                const out = validateInto(schema.inner, data, path, issues)
                if (hasFatalSince(issues, before))
                    return out
                let ok: boolean
                try {
                    ok = schema.pred(out)
                }
                catch (e) {
                    pushFatal(issues, { path, message: e instanceof Error ? e.message : String(e), code: 'custom' })
                    return out
                }
                if (!ok)
                    issues.push({ path, message: schema.message, code: 'custom' })
                return out
            }
            default:
                throw new Error(`[schema] unhandled kind: ${String((schema as { [KIND]: string })[KIND])}`)
        }
    }

    return validateShape(schema as Record<string, unknown>, data, path, issues, 'pass')
}

// 无字段被变换则回传原引用；有变才浅拷贝。pass 透传多余 key，strict 报错，strip 剥掉。
function validateShape(
    shape: Record<string, unknown>,
    data: unknown,
    path: ReadonlyArray<PropertyKey>,
    issues: Issue[],
    mode: 'pass' | 'strict' | 'strip',
): unknown {
    if (!isPlainObject(data)) {
        pushFatal(issues, { path, message: `expected object, got ${describe(data)}`, code: 'invalid_type' })
        return data
    }
    let out: Record<string, unknown> | undefined
    const known = new Set<string>()
    const rawKeys = Object.keys(shape)
    for (const rawKey of rawKeys) {
        if (rawKey.endsWith('?') && Object.hasOwn(shape, rawKey.slice(0, -1)))
            throw new Error(`[schema] duplicate field after optional marker: "${rawKey.slice(0, -1)}"`)
    }
    for (const rawKey of rawKeys) {
        const optional = rawKey.endsWith('?')
        const key = optional ? rawKey.slice(0, -1) : rawKey
        known.add(key)
        if (!Object.hasOwn(data, key)) {
            let missingSchema = shape[rawKey]
            while (isSchema(missingSchema) && missingSchema[KIND] === 'refine')
                missingSchema = missingSchema.inner
            if (isSchema(missingSchema) && missingSchema[KIND] === 'default') {
                (out ??= { ...data })[key] = validateInto(shape[rawKey], undefined, [...path, key], issues)
                continue
            }
            if (!optional)
                issues.push({ path: [...path, key], message: 'missing required key', code: 'invalid_type' })
            continue
        }
        const value = validateInto(shape[rawKey], data[key], [...path, key], issues)
        if (value !== data[key])
            (out ??= { ...data })[key] = value
    }
    if (mode === 'strict') {
        for (const key of Object.keys(data)) {
            if (!known.has(key))
                issues.push({ path: [...path, key], message: 'unexpected key', code: 'unrecognized_key' })
        }
    }
    else if (mode === 'strip') {
        let extra = false
        for (const key of Object.keys(data)) {
            if (!known.has(key)) {
                extra = true
                break
            }
        }
        if (extra) {
            const src = out ?? data
            const slim: Record<string, unknown> = {}
            for (const key of known) {
                if (Object.hasOwn(src, key))
                    slim[key] = src[key]
            }
            return slim
        }
    }
    return out ?? data
}

function mapPreserve(arr: readonly unknown[], fn: (el: unknown, i: number) => unknown): unknown[] | readonly unknown[] {
    let out: unknown[] | undefined
    for (let i = 0; i < arr.length; i++) {
        const v = fn(arr[i], i)
        if (v !== arr[i])
            (out ??= arr.slice())[i] = v
    }
    return out ?? arr
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    if (typeof v !== 'object' || v === null || Array.isArray(v))
        return false
    const proto = Object.getPrototypeOf(v)
    return proto === Object.prototype || proto === null
}

function describe(v: unknown): string {
    if (v === null)
        return 'null'
    if (Array.isArray(v))
        return 'array'
    return typeof v
}

function runChecks(
    checks: ReadonlyArray<(v: unknown, path: ReadonlyArray<PropertyKey>, issues: Issue[]) => boolean>,
    data: unknown,
    path: ReadonlyArray<PropertyKey>,
    issues: Issue[],
): void {
    for (const check of checks) {
        if (check(data, path, issues) === false) {
            const last = issues[issues.length - 1]
            if (last)
                Object.assign(last, { [FATAL]: true })
            break
        }
    }
}
