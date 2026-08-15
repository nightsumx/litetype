// `"email?"` → 真可选 `email?: T`。靠映射类型 `?`，与 exactOptionalPropertyTypes 无关。
export declare const TYPE: unique symbol
export declare const INPUT: unique symbol
declare const DEFAULTED: unique symbol

export interface SchemaValue<Output = unknown, Input = Output> {
    readonly [TYPE]: Output
    readonly [INPUT]: Input
}

export interface Schema<Output, Input = Output> extends SchemaValue<Output, Input> {
    transform: <O>(fn: (value: Output) => O) => TransformSchema<this, O, Input>
    refine: (pred: (value: Output) => boolean, message: string) => this
    default: (value: Output) => DefaultSchema<this>
    undefinable: () => UndefinableSchema<this>
    nullable: () => NullableSchema<this>
    nullish: () => NullishSchema<this>
}

export interface Shape { [k: string]: SchemaValue<any, any> | Shape }

export type Infer<S> =
    S extends object ?
        typeof TYPE extends keyof S ? S[typeof TYPE] : InferObject<S>
        : never

export type InferInput<S> =
    S extends object ?
        typeof INPUT extends keyof S ? S[typeof INPUT] : InferInputObject<S>
        : never

type StripQ<K> = K extends `${infer N}?` ? N : K
type Prettify<T> = { [K in keyof T]: T[K] } & {}

// 只认 `"key?"` 字符串。读字段 [TYPE] / Infer 会物化叶子方法返回类型，与 InferObject 互递归坍成 never。
type OptionalKey<F> = { [K in keyof F]: K extends `${string}?` ? K : never }[keyof F]
type RequiredKey<F> = Exclude<keyof F, OptionalKey<F>>

type InputOptionalKey<F> = { [K in keyof F]: K extends `${string}?` ? K : F[K] extends { readonly [DEFAULTED]: true } ? K : never }[keyof F]
type InputRequiredKey<F> = Exclude<keyof F, InputOptionalKey<F>>

type InferObject<F> = Prettify<
    & { [K in RequiredKey<F>]: Infer<F[K]> }
    & { [K in OptionalKey<F> as StripQ<K>]?: Infer<F[K]> }
>

type InferInputObject<F> = Prettify<
    & { [K in InputRequiredKey<F>]: InferInput<F[K]> }
    & { [K in InputOptionalKey<F> as StripQ<K>]?: InferInput<F[K]> }
>

export interface ArraySchema<E> extends Schema<Infer<E>[], InferInput<E>[]> {}
export interface UnionSchema<M extends readonly any[]> extends Schema<Infer<M[number]>, InferInput<M[number]>> {}
export interface TupleSchema<M extends readonly any[]> extends Schema<{ [I in keyof M]: Infer<M[I]> }, { [I in keyof M]: InferInput<M[I]> }> {}
export interface RecordSchema<V, K = never> extends Schema<
    Record<[K] extends [never] ? string : Infer<K> & PropertyKey, Infer<V>>,
    Record<[K] extends [never] ? string : InferInput<K> & PropertyKey, InferInput<V>>
> {}
export interface EnumSchema<V extends readonly (string | number)[]> extends Schema<V[number]> {}
export interface LazySchema<O, I = O> extends Schema<O, I> {}
export interface LiteralSchema<V> extends Schema<V> {}
export interface StrictSchema<S> extends Schema<Infer<S>, InferInput<S>> {}
export interface StripSchema<S> extends Schema<Infer<S>, InferInput<S>> {}
export interface PreprocessSchema<S> extends Schema<Infer<S>, unknown> {}
export interface TransformSchema<S, O, I = InferInput<S>> extends Schema<O, I> {}
export interface DefaultSchema<S> extends Schema<Infer<S>, InferInput<S> | undefined> { readonly [DEFAULTED]: true }
export interface RefinedSchema<S> extends Schema<Infer<S>, InferInput<S>> {}
export interface UndefinableSchema<S> extends Schema<Infer<S> | undefined, InferInput<S> | undefined> {}
export interface NullableSchema<S> extends Schema<Infer<S> | null, InferInput<S> | null> {}
export interface NullishSchema<S> extends Schema<Infer<S> | null | undefined, InferInput<S> | null | undefined> {}
export interface CatchSchema<S> extends Schema<Infer<S>, unknown> {}
export interface DescribedSchema<S> extends Schema<Infer<S>, InferInput<S>> {}
export interface DiscriminatedUnionSchema<M extends readonly any[]> extends Schema<Infer<M[number]>, InferInput<M[number]>> {}
