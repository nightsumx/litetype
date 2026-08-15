export type IssueCode =
    | 'invalid_type'
    | 'invalid_value'
    | 'too_small'
    | 'too_big'
    | 'not_multiple_of'
    | 'invalid_string'
    | 'unrecognized_key'
    | 'invalid_union'
    | 'custom'

export interface Issue {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
    readonly code: IssueCode
}

function summarize(issues: ReadonlyArray<Issue>): string {
    if (issues.length === 0)
        return 'validation failed'
    const head = issues.slice(0, 3).map((i) => {
        const at = i.path.length ? i.path.map(String).join('.') : '<root>'
        return `${at}: ${i.message}`
    })
    const more = issues.length > 3 ? ` (+${issues.length - 3} more)` : ''
    return `${issues.length} issue(s): ${head.join('; ')}${more}`
}

export class SchemaError extends Error {
    readonly issues: ReadonlyArray<Issue>
    constructor(issues: ReadonlyArray<Issue>) {
        super(summarize(issues))
        this.name = 'SchemaError'
        this.issues = issues
    }
}

export type SafeParseResult<T> =
    | { readonly success: true, readonly data: T }
    | { readonly success: false, readonly error: SchemaError }

function issuesOf(e: SchemaError | ReadonlyArray<Issue>): ReadonlyArray<Issue> {
    return e instanceof SchemaError ? e.issues : e
}

export interface FlatErrors {
    readonly formErrors: string[]
    readonly fieldErrors: Record<string, string[]>
}

export function flatten(e: SchemaError | ReadonlyArray<Issue>): FlatErrors {
    const formErrors: string[] = []
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of issuesOf(e)) {
        if (issue.path.length === 0) {
            formErrors.push(issue.message)
            continue
        }
        const key = String(issue.path[0])
        ;(fieldErrors[key] ??= []).push(issue.message)
    }
    return { formErrors, fieldErrors }
}

export interface ErrorTree {
    errors: string[]
    properties?: Record<string, ErrorTree>
    items?: (ErrorTree | undefined)[]
}

export function treeify(e: SchemaError | ReadonlyArray<Issue>): ErrorTree {
    const root: ErrorTree = { errors: [] }
    for (const issue of issuesOf(e)) {
        let node = root
        for (const seg of issue.path) {
            if (typeof seg === 'number') {
                const items = (node.items ??= [])
                node = items[seg] ??= { errors: [] }
            }
            else {
                const props = (node.properties ??= {})
                node = props[String(seg)] ??= { errors: [] }
            }
        }
        node.errors.push(issue.message)
    }
    return root
}

export function prettify(e: SchemaError | ReadonlyArray<Issue>): string {
    return issuesOf(e)
        .map((issue) => {
            const at = issue.path.length ? issue.path.map(String).join('.') : undefined
            return at ? `✖ ${issue.message}\n  → at ${at}` : `✖ ${issue.message}`
        })
        .join('\n')
}
