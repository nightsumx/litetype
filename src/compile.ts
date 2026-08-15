import type { Issue } from './error'
import type { Check } from './node'
import { isSchema, KIND } from './node'
import { validateInto } from './walker'

export interface Compiled {
    readonly allows: (value: unknown) => boolean
    readonly identity: boolean
}

const cache = new WeakMap<object, Compiled>()
let recentSchema: object | undefined
let recentCompiled: Compiled | undefined

export function compileSchema(schema: unknown): Compiled {
    if (typeof schema !== 'object' || schema === null)
        return fallback(schema)
    if (schema === recentSchema)
        return recentCompiled!
    const hit = cache.get(schema)
    if (hit) {
        recentSchema = schema
        recentCompiled = hit
        return hit
    }

    freezeSchema(schema, new WeakSet())
    let compiled: Compiled
    try {
        const refs: unknown[] = []
        const lines: string[] = []
        const state = { refs, lines, next: 0 }
        emit(schema, 'v', state)
        lines.push('return true')
        const factory = Function('r', `"use strict";return function(v){${lines.join(';')}}`)
        compiled = { allows: factory(refs), identity: identity(schema, new WeakSet()) }
    }
    catch {
        compiled = fallback(schema)
    }
    cache.set(schema, compiled)
    recentSchema = schema
    recentCompiled = compiled
    return compiled
}

function emit(schema: unknown, value: string, state: { refs: unknown[], lines: string[], next: number }): void {
    if (!isSchema(schema)) {
        if (typeof schema !== 'object' || schema === null) {
            emitFallback(schema, value, state)
            return
        }
        emitShape(schema, value, state, false)
        return
    }

    switch (schema[KIND]) {
        case 'string':
            state.lines.push(`if(typeof ${value}!=="string")return false`)
            emitChecks(schema.checks, 1, value, state)
            return
        case 'number':
            state.lines.push(`if(typeof ${value}!=="number"||${value}!==${value})return false`)
            emitChecks(schema.checks, 1, value, state)
            return
        case 'boolean':
            state.lines.push(`if(typeof ${value}!=="boolean")return false`)
            emitChecks(schema.checks, 1, value, state)
            return
        case 'date':
            state.lines.push(`if(!(${value} instanceof Date)||${value}.getTime()!==${value}.getTime())return false`)
            emitChecks(schema.checks, 1, value, state)
            return
        case 'unknown':
            emitChecks(schema.checks, 0, value, state)
            return
        case 'literal': {
            if (typeof schema.value === 'string')
                state.lines.push(`if(${value}!==${JSON.stringify(schema.value)})return false`)
            else if (schema.value === null || typeof schema.value === 'boolean')
                state.lines.push(`if(${value}!==${String(schema.value)})return false`)
            else {
                const ref = addRef(schema.value, state)
                state.lines.push(`if(!Object.is(${value},r[${ref}]))return false`)
            }
            return
        }
        case 'enum': {
            const ref = addRef(new Set(schema.values), state)
            state.lines.push(`if(!r[${ref}].has(${value}))return false`)
            return
        }
        case 'array': {
            state.lines.push(`if(!Array.isArray(${value}))return false`)
            const index = name('i', state)
            const child = name('v', state)
            state.lines.push(`for(let ${index}=0;${index}<${value}.length;${index}++){const ${child}=${value}[${index}]`)
            emit(schema.element, child, state)
            state.lines.push('}')
            return
        }
        case 'tuple': {
            state.lines.push(`if(!Array.isArray(${value})||${value}.length!==${schema.items.length})return false`)
            for (let i = 0; i < schema.items.length; i++) {
                const child = name('v', state)
                state.lines.push(`const ${child}=${value}[${i}]`)
                emit(schema.items[i], child, state)
            }
            return
        }
        case 'record': {
            emitObjectGuard(value, state)
            const key = name('k', state)
            state.lines.push(`for(const ${key} in ${value}){if(!Object.hasOwn(${value},${key}))continue`)
            if (schema.key !== undefined)
                emit(schema.key, key, state)
            const child = name('v', state)
            state.lines.push(`const ${child}=${value}[${key}]`)
            emit(schema.value, child, state)
            state.lines.push('}')
            return
        }
        case 'union': {
            if (schema.members.length === 0) {
                state.lines.push('return false')
                return
            }
            const predicates = schema.members.map(member => addRef(compileSchema(member).allows, state))
            state.lines.push(`if(!(${predicates.map(ref => `r[${ref}](${value})`).join('||')}))return false`)
            return
        }
        case 'discriminated': {
            emitObjectGuard(value, state)
            const ref = addRef((input: unknown) => {
                const member = schema.map.get(Reflect.get(Object(input), schema.key))
                return member !== undefined && compileSchema(member).allows(input)
            }, state)
            state.lines.push(`if(!r[${ref}](${value}))return false`)
            return
        }
        case 'lazy': {
            const ref = addRef((input: unknown) => compileSchema(schema.resolve()).allows(input), state)
            state.lines.push(`if(!r[${ref}](${value}))return false`)
            return
        }
        case 'strict':
            emitShape(schema.shape, value, state, true)
            return
        case 'strip':
            emitShape(schema.shape, value, state, false)
            return
        case 'describe':
            emit(schema.inner, value, state)
            return
        case 'default':
            state.lines.push(`if(${value}!==undefined){`)
            emit(schema.inner, value, state)
            state.lines.push('}')
            return
        case 'catch':
            return
        case 'undefinable':
            state.lines.push(`if(${value}!==undefined){`)
            emit(schema.inner, value, state)
            state.lines.push('}')
            return
        case 'nullable':
            state.lines.push(`if(${value}!==null){`)
            emit(schema.inner, value, state)
            state.lines.push('}')
            return
        case 'nullish':
            state.lines.push(`if(${value}!==null&&${value}!==undefined){`)
            emit(schema.inner, value, state)
            state.lines.push('}')
            return
        case 'refine': {
            if (!identity(schema.inner, new WeakSet())) {
                emitFallback(schema, value, state)
                return
            }
            emit(schema.inner, value, state)
            const ref = addRef((input: unknown) => {
                try {
                    return schema.pred(input)
                }
                catch {
                    return false
                }
            }, state)
            state.lines.push(`if(!r[${ref}](${value}))return false`)
            return
        }
        case 'transform':
        case 'preprocess':
            emitFallback(schema, value, state)
            return
        default:
            throw new Error(`[schema] unhandled kind: ${String(Reflect.get(schema, KIND))}`)
    }
}

function emitShape(
    shape: object,
    value: string,
    state: { refs: unknown[], lines: string[], next: number },
    strict: boolean,
): void {
    state.lines.push(`if(typeof ${value}!=="object"||${value}===null)return false`)
    const proto = name('p', state)
    state.lines.push(`const ${proto}=Object.getPrototypeOf(${value})`)
    state.lines.push(`if(${proto}!==Object.prototype&&${proto}!==null)return false`)
    const rawKeys = Object.keys(shape)
    const keys: string[] = []
    for (const rawKey of rawKeys) {
        if (rawKey.endsWith('?') && Object.hasOwn(shape, rawKey.slice(0, -1)))
            throw new Error(`[schema] duplicate field after optional marker: "${rawKey.slice(0, -1)}"`)
    }
    for (const rawKey of rawKeys) {
        const optional = rawKey.endsWith('?')
        const key = optional ? rawKey.slice(0, -1) : rawKey
        keys.push(key)
        const encoded = JSON.stringify(key)
        if (optional) {
            state.lines.push(`if(Object.hasOwn(${value},${encoded})){`)
            const child = name('v', state)
            state.lines.push(`const ${child}=${value}[${encoded}]`)
            emit(Reflect.get(shape, rawKey), child, state)
            state.lines.push('}')
            continue
        }
        const childSchema = Reflect.get(shape, rawKey)
        const child = name('v', state)
        state.lines.push(`const ${child}=${value}[${encoded}]`)
        if (hasDefault(childSchema)) {
            state.lines.push(`if(Object.hasOwn(${value},${encoded})){`)
            emit(childSchema, child, state)
            state.lines.push('}else{')
            emitFallback(childSchema, 'undefined', state)
            state.lines.push('}')
            continue
        }
        const inherited = Reflect.get(Object.prototype, key)
        if (inherited === undefined)
            state.lines.push(`if(${child}===undefined&&!Object.hasOwn(${value},${encoded}))return false`)
        else {
            const ref = addRef(inherited, state)
            state.lines.push(`if(${child}===r[${ref}]&&!Object.hasOwn(${value},${encoded}))return false`)
        }
        emit(childSchema, child, state)
    }
    if (strict) {
        const key = name('k', state)
        const known = keys.map(item => `${key}===${JSON.stringify(item)}`).join('||') || 'false'
        state.lines.push(`for(const ${key} in ${value})if(Object.hasOwn(${value},${key})&&!(${known}))return false`)
    }
}

function emitObjectGuard(value: string, state: { lines: string[], next: number }): void {
    state.lines.push(`if(typeof ${value}!=="object"||${value}===null)return false`)
    const proto = name('p', state)
    state.lines.push(`const ${proto}=Object.getPrototypeOf(${value})`)
    state.lines.push(`if(${proto}!==Object.prototype&&${proto}!==null)return false`)
}

function emitChecks(
    checks: ReadonlyArray<Check>,
    from: number,
    value: string,
    state: { refs: unknown[], lines: string[], next: number },
): void {
    if (checks.length <= from)
        return
    const sink: Issue[] = []
    const predicate = (input: unknown) => {
        sink.length = 0
        for (let i = from; i < checks.length; i++) {
            if (checks[i](input, [], sink) === false)
                return false
        }
        return sink.length === 0
    }
    const ref = addRef(predicate, state)
    state.lines.push(`if(!r[${ref}](${value}))return false`)
}

function emitFallback(schema: unknown, value: string, state: { refs: unknown[], lines: string[], next: number }): void {
    const ref = addRef(fallback(schema).allows, state)
    state.lines.push(`if(!r[${ref}](${value}))return false`)
}

function addRef(value: unknown, state: { refs: unknown[] }): number {
    return state.refs.push(value) - 1
}

function name(prefix: string, state: { next: number }): string {
    return `${prefix}${state.next++}`
}

function fallback(schema: unknown): Compiled {
    return {
        allows(value) {
            const issues: Issue[] = []
            validateInto(schema, value, [], issues)
            return issues.length === 0
        },
        identity: false,
    }
}

function hasDefault(schema: unknown): boolean {
    while (isSchema(schema) && schema[KIND] === 'refine')
        schema = schema.inner
    return isSchema(schema) && schema[KIND] === 'default'
}

function identity(schema: unknown, seen: WeakSet<object>): boolean {
    if (typeof schema !== 'object' || schema === null)
        return false
    if (seen.has(schema))
        return false
    seen.add(schema)
    let result: boolean
    if (!isSchema(schema)) {
        result = true
        for (const key of Object.keys(schema)) {
            if (!identity(Reflect.get(schema, key), seen)) {
                result = false
                break
            }
        }
    }
    else {
        switch (schema[KIND]) {
            case 'transform':
            case 'preprocess':
            case 'default':
            case 'catch':
            case 'strip':
                result = false
                break
            case 'array': result = identity(schema.element, seen); break
            case 'tuple': result = schema.items.every(item => identity(item, seen)); break
            case 'record': result = (schema.key === undefined || identity(schema.key, seen)) && identity(schema.value, seen); break
            case 'union': result = schema.members.every(member => identity(member, seen)); break
            case 'discriminated': result = schema.members.every(member => identity(member, seen)); break
            case 'lazy': result = identity(schema.resolve(), seen); break
            case 'strict': result = identity(schema.shape, seen); break
            case 'describe':
            case 'refine':
            case 'undefinable':
            case 'nullable':
            case 'nullish':
                result = identity(schema.inner, seen)
                break
            default:
                result = true
        }
    }
    seen.delete(schema)
    return result
}

function freezeSchema(schema: unknown, seen: WeakSet<object>): void {
    if (typeof schema !== 'object' || schema === null || seen.has(schema))
        return
    seen.add(schema)
    if (!isSchema(schema)) {
        for (const key of Object.keys(schema))
            freezeSchema(Reflect.get(schema, key), seen)
        Object.freeze(schema)
        return
    }
    const node = schema
    switch (node[KIND]) {
        case 'array': freezeSchema(node.element, seen); return
        case 'tuple': for (const item of node.items) freezeSchema(item, seen); return
        case 'record':
            if (node.key !== undefined) freezeSchema(node.key, seen)
            freezeSchema(node.value, seen)
            return
        case 'union': for (const member of node.members) freezeSchema(member, seen); return
        case 'discriminated': for (const member of node.members) freezeSchema(member, seen); return
        case 'lazy': freezeSchema(node.resolve(), seen); return
        case 'strict':
        case 'strip': freezeSchema(node.shape, seen); return
        case 'catch':
        case 'transform':
        case 'preprocess':
        case 'describe':
        case 'default':
        case 'refine':
        case 'undefinable':
        case 'nullable':
        case 'nullish': freezeSchema(node.inner, seen); return
    }
}
