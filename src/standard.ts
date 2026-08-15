import type { Infer, InferInput, SchemaValue, Shape } from './types'
import { run } from './parse'

export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

export namespace StandardSchemaV1 {
    export interface Props<Input = unknown, Output = Input> {
        readonly version: 1
        readonly vendor: string
        readonly validate: (value: unknown) => Result<Output>
        readonly types?: Types<Input, Output>
    }
    export type Result<Output> = SuccessResult<Output> | FailureResult
    export interface SuccessResult<Output> { readonly value: Output, readonly issues?: undefined }
    export interface FailureResult { readonly issues: ReadonlyArray<Issue> }
    export interface Issue { readonly message: string, readonly path?: ReadonlyArray<PropertyKey> }
    export interface Types<Input, Output> { readonly input: Input, readonly output: Output }
}

const STD = '~standard'

type Standardized<S> = S & StandardSchemaV1<InferInput<S>, Infer<S>>

export function standard<S extends SchemaValue<any, any> | Shape>(schema: S): Standardized<S> {
    if (typeof schema === 'object' && schema !== null && STD in schema)
        return schema as Standardized<S>

    const props: StandardSchemaV1.Props<InferInput<S>, Infer<S>> = {
        version: 1,
        vendor: 'litetype',
        validate(input) {
            const { issues, value } = run(schema, input)
            if (issues.length === 0)
                return { value: value as Infer<S> }
            return { issues: issues.map(i => ({ message: i.message, path: i.path })) }
        },
    }
    return Object.assign(Object.create(schema as object), { [STD]: props }) as Standardized<S>
}
