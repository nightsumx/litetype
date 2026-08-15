import type { Issue, SafeParseResult } from './error'
import type { Infer } from './types'
import { compileSchema } from './compile'
import { SchemaError } from './error'
import { validateInto } from './walker'

export function run(schema: unknown, data: unknown): { issues: Issue[], value: unknown } {
    const issues: Issue[] = []
    const value = validateInto(schema, data, [], issues)
    return { issues, value }
}

export function compile<S>(schema: S): (data: unknown) => data is Infer<S>
export function compile(schema: unknown): (data: unknown) => boolean {
    return compileSchema(schema).allows
}

export function parse<S>(schema: S, data: unknown): Infer<S> {
    const compiled = compileSchema(schema)
    if (compiled.identity && compiled.allows(data))
        return data as Infer<S>
    const { issues, value } = run(schema, data)
    if (issues.length)
        throw new SchemaError(issues)
    return value as Infer<S>
}

export function safeParse<S>(schema: S, data: unknown): SafeParseResult<Infer<S>> {
    const compiled = compileSchema(schema)
    if (compiled.identity && compiled.allows(data))
        return { success: true, data: data as Infer<S> }
    const { issues, value } = run(schema, data)
    return issues.length
        ? { success: false, error: new SchemaError(issues) }
        : { success: true, data: value as Infer<S> }
}

export function check<S>(schema: S, data: unknown): data is Infer<S> {
    return compileSchema(schema).allows(data)
}
