import { AnyFunctionMap } from "./helpers/typeHelpers"
import { PeerPubSub } from "./PeerPubSub"
import { PeerRPC, RPCMessage } from "./PeerRPC"

type PubSubApi<T extends AnyFunctionMap> = Pick<
	T,
	{
		[K in keyof T]: ReturnType<T[K]> extends VoidFunction ? K : never
	}[keyof T]
>

type RpcApi<T extends AnyFunctionMap> = Pick<
	T,
	{
		[K in keyof T]: ReturnType<T[K]> extends VoidFunction ? never : K
	}[keyof T]
>

export class PeerApi<
	CallAPI extends AnyFunctionMap = AnyFunctionMap,
	AnswerAPI extends AnyFunctionMap = AnyFunctionMap
> {
	private rpc: PeerRPC<RpcApi<CallAPI>, RpcApi<AnswerAPI>>
	private pubsub: PeerPubSub<PubSubApi<CallAPI>, PubSubApi<AnswerAPI>>

	constructor(config: {
		send(message: RPCMessage): Promise<void> | void
		listen(callback: (message: RPCMessage) => void): () => void
	}) {
		this.rpc = new PeerRPC(config)
		this.pubsub = new PeerPubSub(this.rpc)
	}

	get call() {
		return this.rpc.call
	}
	get answer() {
		return this.rpc.answer
	}
	get subscribe() {
		return this.pubsub.subscribe
	}
	get publish() {
		return this.pubsub.publish
	}
}
