import { DeferredPromise } from "./helpers/DeferredPromise"
import { deserializeError, serializeError } from "./helpers/errorHelpers"
import { createFunctionProxy } from "./helpers/proxyHelpers"
import {
	Answerer,
	AnyFunction,
	AnyFunctionMap,
	Caller,
} from "./helpers/typeHelpers"

type RPCRequestMessage = {
	type: "request"
	fn: string
	id: string
	args: any[]
}

type RPCResponseMessage = {
	type: "response"
	fn: string
	id: string
	data?: any
	error?: any
}

export type RPCMessage = RPCRequestMessage | RPCResponseMessage

export class PeerRPC<
	CallAPI extends AnyFunctionMap = AnyFunctionMap,
	AnswerAPI extends AnyFunctionMap = AnyFunctionMap
> {
	constructor(
		private config: {
			send(message: RPCMessage): Promise<void> | void
			listen(callback: (message: RPCMessage) => void): () => void
		}
	) {
		this.startListeners()
	}

	private stopListeners: AnyFunction | undefined
	private startListeners() {
		this.stopListeners = this.config.listen(async (message) => {
			if (message.type === "request") return this.handleRequest(message)
			if (message.type === "response") return this.handleResponse(message)
		})
	}

	private async handleRequest(message: RPCRequestMessage) {
		const answerer = this.answer[message.fn] as any
		if (!answerer) throw new Error("No answerer for " + message.fn)
		try {
			const data = await answerer(...message.args)
			const response: RPCResponseMessage = {
				type: "response",
				id: message.id,
				fn: message.fn,
				data,
			}
			await this.config.send(response)
		} catch (error) {
			const response: RPCResponseMessage = {
				type: "response",
				id: message.id,
				fn: message.fn,
				error: serializeError(error),
			}
			await this.config.send(response)
		}
	}

	private handleResponse(message: RPCResponseMessage) {
		const response = this.requests[message.id]
		if (!response)
			throw new Error("No responses for " + message.fn + ":" + message.id)
		response.resolve(message)
	}

	private requests: Record<string, DeferredPromise<RPCResponseMessage>> = {}

	private async sendRequest(request: RPCRequestMessage) {
		const deferred = new DeferredPromise<RPCResponseMessage>()
		this.requests[request.id] = deferred
		this.config.send(request)

		const response = await deferred.promise
		delete this.requests[request.id]

		return response
	}

	async callFn(fn: string, ...args: any[]) {
		const request: RPCRequestMessage = {
			type: "request",
			id: `${fn}-${Math.random()}`,
			fn,
			args: args,
		}

		const response = await this.sendRequest(request)

		if (response.error) {
			const localError = new Error(fn)
			const remoteError = response.error as Error
			const combinedError = deserializeError({
				message: [localError.message, response.error.message].join(" > "),
				stack: [localError.stack, remoteError.stack].join("\n"),
			})

			throw combinedError
		}

		return response.data
	}

	call = createFunctionProxy<Caller<CallAPI>>((fn: any, ...args: any) =>
		this.callFn(fn, ...args)
	)

	answer: Partial<Answerer<AnswerAPI>> = {}

	destroy() {
		this.answer = {}
		if (this.stopListeners) this.stopListeners()
	}
}
