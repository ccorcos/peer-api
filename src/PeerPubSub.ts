import { createFunctionProxy } from "./helpers/proxyHelpers"
import { Answerer, AnyFunction } from "./helpers/typeHelpers"
import { PeerRPC } from "./PeerRPC"

type PubSubApi = {
	__subscribe(id: string, fn: string, subscribeArgs: SubscribeArgs): void
	__unsubscribe(id: string): void
	__emit(id: string, callback: number, callbackArgs: any[]): void
}

export type VoidFunction = () => void
export type PublishFunction = (...args: any[]) => VoidFunction
export type PublishFunctionMap = { [key: string]: PublishFunction }

export type Subscriber<T extends PublishFunctionMap> = {
	[K in keyof T]: (...args: Parameters<T[K]>) => Promise<() => Promise<void>>
}

export class PeerPubSub<
	SubscribeApi extends PublishFunctionMap = PublishFunctionMap,
	PublishApi extends PublishFunctionMap = PublishFunctionMap
> {
	private rpc: PeerRPC<PubSubApi, PubSubApi>

	constructor(rpc: PeerRPC) {
		this.rpc = rpc as any

		// "Server"
		this.rpc.answer.__subscribe = this.handleSubscribe
		this.rpc.answer.__unsubscribe = this.handleUnsubscribe

		// "Client"
		this.rpc.answer.__emit = this.handleEmit
	}

	// "Server"
	publish: Partial<Answerer<PublishApi>> = {}

	private publications: Record<string, VoidFunction> = {}

	private handleSubscribe = async (
		id: string,
		fn: string,
		subscribeArgs: SubscribeArgs
	) => {
		const publisher = this.publish[fn]
		if (!publisher) throw new Error("No publisher for " + fn)

		const args = fromSubscribeArgs(subscribeArgs, (callback, callbackArgs) => {
			return this.rpc.call.__emit(id, callback, callbackArgs)
		})
		// @ts-ignore
		const unsubscribe = await publisher(...args)
		this.publications[id] = unsubscribe
	}

	private handleUnsubscribe = async (id: string) => {
		if (!this.publications[id]) return
		await this.publications[id]()
		delete this.publications[id]
	}

	// "Client"
	private subscriptions: Record<string, any[]> = {}

	private async subscribeFn(fn: string, ...args: any[]) {
		const id = `subscribe-${fn}-${Math.random()}`
		this.subscriptions[id] = args

		const subscribeArgs = toSubscribeArgs(args)
		await this.rpc.call.__subscribe(id, fn, subscribeArgs)

		return async () => {
			delete this.subscriptions[id]
			await this.rpc.call.__unsubscribe(id)
		}
	}

	subscribe = createFunctionProxy<Subscriber<SubscribeApi>>(
		(fn: any, ...args: any) => this.subscribeFn(fn, ...args)
	)

	private handleEmit = async (
		id: string,
		callback: number,
		callbackArgs: any[]
	) => {
		const subscription = this.subscriptions[id]
		if (!subscription) throw new Error("Missing subscription " + id)
		return subscription[callback](...callbackArgs)
	}

	destroy() {
		for (const publication of Object.values(this.publications)) {
			publication()
			// TODO: maybe this should tell the other side that this subscription was terminated.
		}
		this.publications = {}
		this.rpc.destroy()
	}
}

function isFunction(f: unknown): f is AnyFunction {
	return typeof f === "function"
}

type SubscribeArgs = { args: any[]; callbacks: number[] }

function toSubscribeArgs(args: any[]) {
	const callbacks: number[] = []
	args = args.map((arg, i) => {
		if (isFunction(arg)) {
			callbacks.push(i)
			return null
		}
		return arg
	})
	return { args, callbacks }
}

type Emit = (callback: number, callbackArgs: any[]) => void | Promise<void>

function fromSubscribeArgs(subscribeArgs: SubscribeArgs, emit: Emit) {
	const args = [...subscribeArgs.args]
	for (const callback of subscribeArgs.callbacks) {
		args[callback] = async (...callbackArgs: any[]) =>
			emit(callback, callbackArgs)
	}
	return args
}
