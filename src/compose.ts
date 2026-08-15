import type { ArraySchema, CatchSchema, DescribedSchema, DiscriminatedUnionSchema, Infer, InferInput, LazySchema, PreprocessSchema, RecordSchema, RefinedSchema, SchemaValue, Shape, StrictSchema, StripSchema, TupleSchema, TYPE, TransformSchema, UnionSchema } from './types'
import { boolean, date, number, string } from './leaf'
import { isSchema, KIND, node } from './node'

type Spec = SchemaValue<any, any> | Shape

export function fallback<S extends Spec>(schema: S, value: Infer<S>): CatchSchema<S> {
    return node({ [KIND]: 'catch', inner: schema, value })
}

export function array<E extends Spec>(element: E): ArraySchema<E> {
    return node({ [KIND]: 'array', element })
}

export function tuple<M extends readonly Spec[]>(...items: [...M]): TupleSchema<M> {
    return node({ [KIND]: 'tuple', items: Object.freeze([...items]) })
}

export function record<V extends Spec>(value: V): RecordSchema<V, never>
export function record<K extends { readonly [TYPE]: string | number }, V extends Spec>(key: K, value: V): RecordSchema<V, K>
export function record(keyOrValue: Spec, value?: Spec): RecordSchema<Spec, Spec> {
    return value === undefined
        ? node({ [KIND]: 'record', value: keyOrValue })
        : node({ [KIND]: 'record', value, key: keyOrValue })
}

export function union<M extends readonly Spec[]>(...members: [...M]): UnionSchema<M> {
    return node({ [KIND]: 'union', members: Object.freeze([...members]) })
}

export function discriminatedUnion<K extends string, M extends readonly Shape[]>(key: K, ...members: [...M]): DiscriminatedUnionSchema<M> {
    const map = new Map<unknown, unknown>()
    for (const member of members) {
        const field = member[key]
        if (!isSchema(field) || field[KIND] !== 'literal')
            throw new Error(`[schema] discriminatedUnion: member missing literal at discriminator key "${key}"`)
        if (map.has(field.value))
            throw new Error(`[schema] discriminatedUnion: duplicate discriminator value ${JSON.stringify(field.value)}`)
        map.set(field.value, member)
    }
    return node({ [KIND]: 'discriminated', key, map: Object.freeze(map), members: Object.freeze([...members]) })
}

export function lazy<N extends Spec>(resolve: () => N): LazySchema<Infer<N>, InferInput<N>> {
    let cached: unknown
    let resolved = false
    const thunk = () => {
        if (!resolved) {
            cached = resolve()
            resolved = true
        }
        return cached
    }
    return node<LazySchema<Infer<N>, InferInput<N>>>({ [KIND]: 'lazy', resolve: thunk })
}

export function transform<S extends Spec, O>(inner: S, fn: (value: Infer<S>) => O): TransformSchema<S, O, InferInput<S>> {
    return node({ [KIND]: 'transform', inner, fn })
}

export function refine<S extends Spec>(inner: S, pred: (value: Infer<S>) => boolean, message: string): RefinedSchema<S> {
    return node({ [KIND]: 'refine', inner, pred, message })
}

export function strict<S extends Shape>(shape: S): StrictSchema<S> {
    return node({ [KIND]: 'strict', shape })
}

export function strip<S extends Shape>(shape: S): StripSchema<S> {
    return node({ [KIND]: 'strip', shape })
}

export function preprocess<S extends Spec>(fn: (value: unknown) => unknown, inner: S): PreprocessSchema<S> {
    return node({ [KIND]: 'preprocess', inner, fn })
}

export function describe<S extends Spec>(inner: S, description: string): DescribedSchema<S> {
    return node({ [KIND]: 'describe', inner, description })
}

export function descriptionOf(schema: unknown): string | undefined {
    return isSchema(schema) && schema[KIND] === 'describe' ? schema.description : undefined
}

function coerceValue(target: 'number' | 'boolean' | 'date' | 'string', v: unknown): unknown {
    switch (target) {
        case 'number': return typeof v === 'number' ? v : Number(v)
        case 'boolean': return typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : v
        case 'date': return v instanceof Date ? v : new Date(v as string | number)
        case 'string': return typeof v === 'string' ? v : String(v)
    }
}

export const coerce = {
    number: (inner: SchemaValue<number> = number) => node<PreprocessSchema<SchemaValue<number>>>(
        { [KIND]: 'preprocess', inner, fn: (v: unknown) => coerceValue('number', v) },
    ),
    boolean: (inner: SchemaValue<boolean> = boolean) => node<PreprocessSchema<SchemaValue<boolean>>>(
        { [KIND]: 'preprocess', inner, fn: (v: unknown) => coerceValue('boolean', v) },
    ),
    date: (inner: SchemaValue<Date> = date) => node<PreprocessSchema<SchemaValue<Date>>>(
        { [KIND]: 'preprocess', inner, fn: (v: unknown) => coerceValue('date', v) },
    ),
    string: (inner: SchemaValue<string> = string) => node<PreprocessSchema<SchemaValue<string>>>(
        { [KIND]: 'preprocess', inner, fn: (v: unknown) => coerceValue('string', v) },
    ),
}

type AddQ<K extends PropertyKey> = K extends string ? (K extends `${string}?` ? K : `${K}?`) : K
type StripQ<K extends PropertyKey> = K extends `${infer N}?` ? N : K

export function partial<S extends Shape>(shape: S): { [K in keyof S as AddQ<K>]: S[K] } {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(shape)) {
        const target = k.endsWith('?') ? k : `${k}?`
        if (Object.hasOwn(out, target))
            throw new Error(`[schema] duplicate field after optional marker: "${target.slice(0, -1)}"`)
        out[target] = shape[k]
    }
    return out as { [K in keyof S as AddQ<K>]: S[K] }
}

export function required<S extends Shape>(shape: S): { [K in keyof S as StripQ<K>]: S[K] } {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(shape)) {
        const target = k.endsWith('?') ? k.slice(0, -1) : k
        if (Object.hasOwn(out, target))
            throw new Error(`[schema] duplicate field after optional marker: "${target}"`)
        out[target] = shape[k]
    }
    return out as { [K in keyof S as StripQ<K>]: S[K] }
}
