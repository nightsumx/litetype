import type { Issue, SafeParseResult } from './error'
import type { Infer } from './types'
import { SchemaError } from './error'
import { validateInto } from './walker'

export function run(schema: unknown, data: unknown): { issues: Issue[], value: unknown } {
    const issues: Issue[] = []
    const value = validateInto(schema, data, [], issues)
    return { issues, value }
}

export function parse<S>(schema: S, data: unknown): Infer<S> {
    const { issues, value } = run(schema, data)
    if (issues.length)
        throw new SchemaError(issues)
    return value as Infer<S>
}

export function safeParse<S>(schema: S, data: unknown): SafeParseResult<Infer<S>> {
    const { issues, value } = run(schema, data)
    return issues.length
        ? { success: false, error: new SchemaError(issues) }
        : { success: true, data: value as Infer<S> }
}

export function check<S>(schema: S, data: unknown): data is Infer<S> {
    return run(schema, data).issues.length === 0
}
