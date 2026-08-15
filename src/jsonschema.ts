import type { SchemaValue, Shape } from './types'
import { array, describe, lazy, record, refine, strict, tuple, union } from './compose'
import { boolean, enum_, literal, number, string as str, unknown } from './leaf'
import { isSchema, KIND, node } from './node'

export interface JsonSchema {
    $ref?: string
    $defs?: Record<string, JsonSchema>
    definitions?: Record<string, JsonSchema>
    type?: string | string[]
    const?: unknown
    enum?: unknown[]
    description?: string
    oneOf?: JsonSchema[]
    anyOf?: JsonSchema[]
    items?: JsonSchema | JsonSchema[]
    properties?: Record<string, JsonSchema>
    required?: string[]
    additionalProperties?: boolean | JsonSchema
    minLength?: number
    maxLength?: number
    format?: string
    pattern?: string
    minimum?: number
    maximum?: number
    exclusiveMinimum?: number
    exclusiveMaximum?: number
    multipleOf?: number
    minItems?: number
    maxItems?: number
    allOf?: unknown
    if?: unknown
    patternProperties?: unknown
}

export function fromJsonSchema(doc: JsonSchema): SchemaValue<unknown> | Shape {
    return convert(doc, doc.$defs ?? doc.definitions ?? {})
}

function convert(s: JsonSchema, defs: Record<string, JsonSchema>): SchemaValue<any, any> | Shape {
    if (s.allOf !== undefined)
        throw new Error('[jsonschema] unsupported: allOf (交集无对应节点)')
    if (s.if !== undefined)
        throw new Error('[jsonschema] unsupported: if/then/else')
    if (s.patternProperties !== undefined)
        throw new Error('[jsonschema] unsupported: patternProperties')

    if (s.$ref) {
        const name = refName(s.$ref)
        const target = defs[name]
        if (!target)
            throw new Error(`[jsonschema] unresolved $ref: ${s.$ref}`)
        return lazy(() => convert(target, defs))
    }
    if (s.const !== undefined)
        return literal(s.const as string | number | boolean | null)
    if (s.enum)
        return enum_(s.enum as (string | number)[])
    if (s.oneOf || s.anyOf)
        return union(...(s.oneOf ?? s.anyOf!).map(m => convert(m, defs)))

    const nullable = Array.isArray(s.type) && s.type.includes('null')
    const type = Array.isArray(s.type) ? s.type.find(t => t !== 'null') : s.type
    const built = byType(type, s, defs)
    const wrapped = nullable && isSchema(built)
        ? node<SchemaValue<any, any>>({ [KIND]: 'nullable', inner: built })
        : built
    if (s.description !== undefined && isSchema(wrapped))
        return describe(wrapped, s.description)
    return wrapped
}

function byType(type: string | undefined, s: JsonSchema, defs: Record<string, JsonSchema>): SchemaValue<any, any> | Shape {
    switch (type) {
        case 'string': return stringFrom(s)
        case 'integer': return numberFrom(s, true)
        case 'number': return numberFrom(s, false)
        case 'boolean': return boolean
        case 'array': return arrayFrom(s, defs)
        case 'object': return objectFrom(s, defs)
        default: throw new Error(`[jsonschema] unsupported type: ${String(s.type)}`)
    }
}

function stringFrom(s: JsonSchema): SchemaValue<string> {
    let out = str
    if (s.minLength !== undefined)
        out = out.min(s.minLength)
    if (s.maxLength !== undefined)
        out = out.max(s.maxLength)
    if (s.format === 'email')
        out = out.email()
    else if (s.format === 'uri')
        out = out.url()
    else if (s.format === 'uuid')
        out = out.uuid()
    else if (s.format === 'date-time')
        out = out.datetime()
    if (s.pattern)
        out = out.regex(new RegExp(s.pattern))
    return out
}

function numberFrom(s: JsonSchema, int: boolean): SchemaValue<number> {
    let out = number
    if (int)
        out = out.int()
    if (s.minimum !== undefined)
        out = out.min(s.minimum)
    if (s.maximum !== undefined)
        out = out.max(s.maximum)
    if (s.exclusiveMinimum !== undefined)
        out = out.gt(s.exclusiveMinimum)
    if (s.exclusiveMaximum !== undefined)
        out = out.lt(s.exclusiveMaximum)
    if (s.multipleOf !== undefined)
        out = out.multipleOf(s.multipleOf)
    return out
}

function arrayFrom(s: JsonSchema, defs: Record<string, JsonSchema>): SchemaValue<any, any> {
    if (Array.isArray(s.items))
        return tuple(...s.items.map(i => convert(i, defs)))
    let out: SchemaValue<any, any> = array(s.items ? convert(s.items, defs) : unknown)
    const lo = s.minItems
    const hi = s.maxItems
    if (lo !== undefined)
        out = refine(out, v => Array.isArray(v) && v.length >= lo, `must have at least ${lo} items`)
    if (hi !== undefined)
        out = refine(out, v => Array.isArray(v) && v.length <= hi, `must have at most ${hi} items`)
    return out
}

function objectFrom(s: JsonSchema, defs: Record<string, JsonSchema>): SchemaValue<any, any> | Shape {
    const hasProps = s.properties && Object.keys(s.properties).length > 0
    const apObject = s.additionalProperties && typeof s.additionalProperties === 'object'
    if (hasProps && apObject)
        throw new Error('[jsonschema] unsupported: properties + additionalProperties schema (无 catchall 节点)')
    if (apObject)
        return record(convert(s.additionalProperties as JsonSchema, defs))
    const required = new Set(s.required ?? [])
    const shape: Record<string, SchemaValue<any, any> | Shape> = {}
    for (const [key, prop] of Object.entries(s.properties ?? {})) {
        if (required.has(key) && key.endsWith('?'))
            throw new Error(`[jsonschema] unsupported required property ending in ?: ${JSON.stringify(key)}`)
        shape[required.has(key) ? key : `${key}?`] = convert(prop, defs)
    }
    return s.additionalProperties === false ? strict(shape) : shape
}

function refName(ref: string): string {
    const parts = ref.split('/')
    return parts[parts.length - 1]
}

export function toJsonSchema(schema: SchemaValue<unknown, unknown> | Shape): JsonSchema {
    return serialize(schema)
}

function serialize(schema: unknown): JsonSchema {
    if (!isSchema(schema))
        return shapeToJson(schema as Record<string, unknown>)

    switch (schema[KIND]) {
        case 'string': return withChecks({ type: 'string' }, schema)
        case 'number': return withChecks({ type: 'number' }, schema)
        case 'boolean': return { type: 'boolean' }
        case 'unknown': return {}
        case 'date': return { type: 'string', format: 'date-time' }
        case 'literal': return { const: schema.value }
        case 'enum': return { enum: [...schema.values] }
        case 'array': return { type: 'array', items: serialize(schema.element) }
        case 'tuple': {
            const items = schema.items.map(serialize)
            return { type: 'array', items, minItems: items.length, maxItems: items.length }
        }
        case 'record': return { type: 'object', additionalProperties: serialize(schema.value) }
        case 'union': return { anyOf: schema.members.map(serialize) }
        case 'discriminated': return { oneOf: schema.members.map(serialize) }
        case 'strict': return { ...shapeToJson(schema.shape), additionalProperties: false }
        case 'strip': return shapeToJson(schema.shape)
        case 'nullable': {
            const inner = serialize(schema.inner)
            const t = inner.type
            if (Array.isArray(t))
                return inner
            return { ...inner, type: t ? [t, 'null'] : 'null' }
        }
        case 'undefinable':
        case 'nullish':
        case 'default':
            return serialize(schema.inner)
        case 'lazy':
            return serialize(schema.resolve())
        case 'describe':
            return { ...serialize(schema.inner), description: schema.description }
        case 'transform': throw new Error('[jsonschema] cannot serialize transform (运行时变换无 JSON Schema 对应)')
        case 'refine': throw new Error('[jsonschema] cannot serialize refine (运行时谓词无 JSON Schema 对应)')
        case 'preprocess': throw new Error('[jsonschema] cannot serialize preprocess (运行时掰值无 JSON Schema 对应)')
        default: throw new Error(`[jsonschema] cannot serialize kind: ${String((schema as { [KIND]: string })[KIND])}`)
    }
}

function withChecks(base: JsonSchema, node: { checks: ReadonlyArray<{ meta?: { keyword: Record<string, unknown> } }> }): JsonSchema {
    let out = base
    for (const c of node.checks) {
        if (c.meta)
            out = { ...out, ...c.meta.keyword }
    }
    return out
}

function shapeToJson(shape: Record<string, unknown>): JsonSchema {
    const properties: Record<string, JsonSchema> = {}
    const required: string[] = []
    const rawKeys = Object.keys(shape)
    for (const rawKey of rawKeys) {
        if (rawKey.endsWith('?') && Object.hasOwn(shape, rawKey.slice(0, -1)))
            throw new Error(`[schema] duplicate field after optional marker: "${rawKey.slice(0, -1)}"`)
    }
    for (const rawKey of rawKeys) {
        const optional = rawKey.endsWith('?')
        const key = optional ? rawKey.slice(0, -1) : rawKey
        properties[key] = serialize(shape[rawKey])
        if (!optional)
            required.push(key)
    }
    const out: JsonSchema = { type: 'object', properties }
    if (required.length)
        out.required = required
    return out
}
