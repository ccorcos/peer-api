/**
 * A Promise utility that lets you specify the resolve/reject after the promise is made
 * (or outside of the Promise constructor)
 */
export class DeferredPromise<T = void> {
	resolve!: (value: T) => void
	reject!: (error: any) => void
	promise: Promise<T>
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}
}
