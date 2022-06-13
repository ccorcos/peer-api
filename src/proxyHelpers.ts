import { AnyFunction } from "./typeHelpers"

/** Warning: this is not soundly typed. */
export function createProxy<K extends { [key: string]: AnyFunction }>(
	fn: (key: keyof K, ...args: any[]) => any
) {
	return new Proxy(
		{},
		{
			get(target, prop: any) {
				return (...args: any[]) => {
					return (fn as any)(prop, ...args)
				}
			},
		}
	) as K
}
