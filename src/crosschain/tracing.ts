import type { Attributes, Span } from '@opentelemetry/api'
import { SpanStatusCode, trace } from '@opentelemetry/api'

export function withSpan<R>(
    name: string,
    attributes: Attributes,
    fn: (span: Span) => Promise<R>,
    successAttrs?: (result: R) => Attributes
): Promise<R> {
    const tracer = trace.getTracer('symbiosis-sdk')
    return tracer.startActiveSpan(name, { attributes }, async (span: Span) => {
        try {
            const result = await fn(span)
            span.setStatus({ code: SpanStatusCode.OK })
            if (successAttrs) span.setAttributes(successAttrs(result))
            return result
        } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR })
            if (err instanceof Error) span.recordException(err)
            throw err
        } finally {
            span.end()
        }
    })
}

export function withSyncSpan<R>(
    name: string,
    attributes: Attributes,
    fn: (span: Span) => R,
    successAttrs?: (result: R) => Attributes
): R {
    const tracer = trace.getTracer('symbiosis-sdk')
    return tracer.startActiveSpan(name, { attributes }, (span: Span) => {
        try {
            const result = fn(span)
            span.setStatus({ code: SpanStatusCode.OK })
            if (successAttrs) span.setAttributes(successAttrs(result))
            return result
        } catch (err) {
            span.setStatus({ code: SpanStatusCode.ERROR })
            if (err instanceof Error) span.recordException(err)
            throw err
        } finally {
            span.end()
        }
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wrapToSpan<F extends (...args: any) => any>(
    spanName: string,
    before: ((...args: Parameters<F>) => Attributes) | null,
    after: (result: Awaited<ReturnType<F>>) => Attributes,
    func: F
): (...args: Parameters<F>) => Promise<ReturnType<F>> {
    return async (...args: Parameters<F>) => {
        return await withSpan(spanName, before ? before(...args) : {}, () => func(...args), after)
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyArgs = any[]

export type AsyncMethod<This, Args extends AnyArgs, Return> = (this: This, ...args: Args) => Promise<Return>

export interface DecoratorOptions<Args extends AnyArgs, Return> {
    name?: string
    onCall?: (...args: Args) => Attributes
    onReturn?: (result: Return) => Attributes
}

export function withTracing<This, Args extends AnyArgs, Return, F extends AsyncMethod<This, Args, Return>>(
    options?: DecoratorOptions<Args, Return>
) {
    return function (originalMethod: F | undefined, context: ClassMethodDecoratorContext) {
        return (
            originalMethod &&
            (async function (this: This, ...args: Parameters<F>): Promise<Return> {
                return await withSpan(
                    options?.name ?? context.name.toString(),
                    options?.onCall ? options.onCall(...args) : {},
                    () => originalMethod.apply(this, args),
                    options?.onReturn
                )
            } as F)
        )
    }
}

/**
 * @description Combines members of an intersection into a readable type.
 *
 * @see {@link https://twitter.com/mattpocockuk/status/1622730173446557697?s=20&t=NdpAcmEFXY01xkqU3KO0Mg}
 * @example
 * Prettify<{ a: string } & { b: string } & { c: number, d: bigint }>
 * => { a: string, b: string, c: number, d: bigint }
 */
export type Prettify<T> = {
    [K in keyof T]: T[K]
} & object

export type OneOf<
    union extends object,
    fallback extends object | undefined = undefined,
    ///
    keys extends KeyofUnion<union> = KeyofUnion<union>,
> = union extends infer item
    ? Prettify<
          item & {
              [key in Exclude<keys, keyof item>]?: fallback extends object
                  ? key extends keyof fallback
                      ? fallback[key]
                      : undefined
                  : undefined
          }
      >
    : never
type KeyofUnion<type> = type extends type ? keyof type : never

type Primitive = string | number | boolean

// Utility to determine if a value should be flattened or kept as is
type FlattenValue<T> = T extends bigint
    ? string
    : T extends (infer U)[]
      ? U extends Primitive
          ? T
          : never // Keep arrays of primitives
      : T

// Recursive type to generate the flattened object structure
type FlattenObject<T, Prefix extends string = ''> = {
    [K in keyof T & (string | number)]: T[K] extends Primitive | Primitive[]
        ? { [P in `${Prefix}${K}`]: FlattenValue<T[K]> }
        : T[K] extends object
          ? FlattenObject<T[K], `${Prefix}${K}.`>
          : never
}[keyof T & (string | number)]

// Helper to collapse the union into a single object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never

type Flattened<T> = Prettify<UnionToIntersection<FlattenObject<T>>>

function convertScalar(v: number | bigint | string | boolean | object): Primitive {
    if (v === undefined || v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')
        return v
    else return v.toString() // nested arrays are not supported
}

/**
 * Converts nested objects to a plain object with dot-notated keys.
 * BigInts are converted to strings; arrays of primitives are preserved.
 */
export function flatten<T extends object>(obj: T, prefix = ''): Flattened<T> {
    return Object.entries(obj).reduce((acc, [key, value]) => {
        const newKey = prefix ? `${prefix}.${key}` : key

        let newValues
        if (Array.isArray(value)) {
            newValues = { [newKey]: value.map((v) => convertScalar(v)) }
        } else if (typeof value === 'object' && value.constructor.name === 'object') {
            // Recursive call for nested objects
            // @ts-expect-error recursion could be too deep
            newValues = flatten(value, newKey)
        } else {
            newValues = { [newKey]: convertScalar(value) }
        }
        Object.assign(acc, newValues)
        return acc
    }, {} as Flattened<T>)
}
