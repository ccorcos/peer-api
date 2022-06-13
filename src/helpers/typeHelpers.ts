export type AnyFunction = (...args: any[]) => any

export type AnyFunctionMap = { [key: string]: AnyFunction }

export type Asyncify<F extends AnyFunction> = ReturnType<F> extends Promise<any>
	? F
	: (...args: Parameters<F>) => Promise<ReturnType<F>>

export type Syncify<F extends AnyFunction> = ReturnType<F> extends Promise<any>
	? (...args: Parameters<F>) => Awaited<ReturnType<F>>
	: F

export type Caller<T extends AnyFunctionMap> = {
	[K in keyof T]: (...args: Parameters<T[K]>) => ReturnType<Asyncify<T[K]>>
}

export type Answerer<T extends AnyFunctionMap> = {
	[K in keyof T]: Syncify<T[K]> | Asyncify<T[K]>
}

export type Answerer2<T extends AnyFunctionMap> = {
	[K in keyof T]: (fn: Syncify<T[K]> | Asyncify<T[K]>) => () => void
}
