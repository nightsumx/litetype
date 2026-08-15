import type { Issue } from './error'
import type { DefaultSchema, NullableSchema, NullishSchema, Schema, Shape, TransformSchema, UndefinableSchema } from './types'

// Symbol.for：跨 realm / 重复打包仍是同一个判别器。
export const KIND = Symbol.for('schema.kind')

export type Kind =
    | 'string' | 'number' | 'boolean' | 'date' | 'unknown'
    | 'literal' | 'enum'
    | 'array' | 'tuple' | 'record' | 'union' | 'discriminated' | 'lazy' | 'strict' | 'strip' | 'transform' | 'default' | 'refine'
    | 'undefinable' | 'nullable' | 'nullish' | 'preprocess' | 'catch'
    | 'describe'

export interface CheckMeta {
    readonly keyword: Record<string, unknown>
}
export interface Check {
    (v: unknown, path: ReadonlyArray<PropertyKey>, issues: Issue[]): boolean
    meta?: CheckMeta
}

export interface ChecksNode {
    readonly [KIND]: 'string' | 'number' | 'boolean' | 'date' | 'unknown'
    readonly checks: ReadonlyArray<Check>
}
export interface LiteralNode {
    readonly [KIND]: 'literal'
    readonly checks: ReadonlyArray<Check>
    readonly value: unknown
}
export interface EnumNode {
    readonly [KIND]: 'enum'
    readonly checks: ReadonlyArray<Check>
    readonly values: readonly unknown[]
}
export interface ArrayNode { readonly [KIND]: 'array', readonly element: unknown }
export interface TupleNode { readonly [KIND]: 'tuple', readonly items: readonly unknown[] }
export interface RecordNode { readonly [KIND]: 'record', readonly value: unknown, readonly key?: unknown }
export interface UnionNode { readonly [KIND]: 'union', readonly members: readonly unknown[] }
export interface LazyNode { readonly [KIND]: 'lazy', readonly resolve: () => unknown }
export interface CatchNode { readonly [KIND]: 'catch', readonly inner: unknown, readonly value: unknown }
export interface DiscriminatedNode { readonly [KIND]: 'discriminated', readonly key: string, readonly map: ReadonlyMap<unknown, unknown>, readonly members: readonly unknown[] }
export interface TransformNode { readonly [KIND]: 'transform', readonly inner: unknown, readonly fn: (value: any) => unknown }
export interface PreprocessNode { readonly [KIND]: 'preprocess', readonly inner: unknown, readonly fn: (value: unknown) => unknown }
export interface DescribeNode { readonly [KIND]: 'describe', readonly inner: unknown, readonly description: string }
export interface StrictNode { readonly [KIND]: 'strict', readonly shape: Shape }
export interface StripNode { readonly [KIND]: 'strip', readonly shape: Shape }
export interface DefaultNode { readonly [KIND]: 'default', readonly inner: unknown, readonly value: unknown }
export interface RefineNode { readonly [KIND]: 'refine', readonly inner: unknown, readonly pred: (v: unknown) => boolean, readonly message: string }
export interface UndefinableNode { readonly [KIND]: 'undefinable', readonly inner: unknown }
export interface NullableNode { readonly [KIND]: 'nullable', readonly inner: unknown }
export interface NullishNode { readonly [KIND]: 'nullish', readonly inner: unknown }

export type RuntimeNode =
    | ChecksNode | LiteralNode | EnumNode
    | ArrayNode | TupleNode | RecordNode | UnionNode | LazyNode
    | CatchNode | DiscriminatedNode | TransformNode | PreprocessNode
    | DescribeNode | StrictNode | StripNode | DefaultNode | RefineNode
    | UndefinableNode | NullableNode | NullishNode

export function isSchema(x: unknown): x is RuntimeNode {
    return typeof x === 'object' && x !== null && KIND in x
}

export function node<T>(payload: object): T {
    return Object.freeze(Object.assign(Object.create(combinators), payload)) as unknown as T
}

export const combinators = {
    transform<O>(this: Schema<unknown, unknown>, fn: (value: unknown) => O): TransformSchema<typeof this, O, unknown> {
        return node({ [KIND]: 'transform', inner: this, fn })
    },
    refine(this: Schema<unknown>, pred: (value: unknown) => boolean, message: string): typeof this {
        return node({ [KIND]: 'refine', inner: this, pred, message })
    },
    default(this: Schema<unknown>, value: unknown): DefaultSchema<typeof this> {
        return node({ [KIND]: 'default', inner: this, value })
    },
    undefinable(this: Schema<unknown>): UndefinableSchema<typeof this> {
        return node({ [KIND]: 'undefinable', inner: this })
    },
    nullable(this: Schema<unknown>): NullableSchema<typeof this> {
        return node({ [KIND]: 'nullable', inner: this })
    },
    nullish(this: Schema<unknown>): NullishSchema<typeof this> {
        return node({ [KIND]: 'nullish', inner: this })
    },
}
