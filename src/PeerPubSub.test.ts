import { strict as assert } from "assert"
import EventEmitter from "events"
import { describe, it } from "mocha"
import { sleep } from "./helpers/sleep"
import { AnyFunctionMap } from "./helpers/typeHelpers"
import { PeerPubSub } from "./PeerPubSub"
import { PeerRPC } from "./PeerRPC"

function setupPeers<
	A2B extends AnyFunctionMap = AnyFunctionMap,
	B2A extends AnyFunctionMap = AnyFunctionMap
>() {
	const aEvents = new EventEmitter()
	const bEvents = new EventEmitter()

	const a = new PeerRPC<A2B, B2A>({
		send: (message) => {
			bEvents.emit("event", message)
		},
		listen: (callback) => {
			aEvents.on("event", callback)
			return () => aEvents.off("event", callback)
		},
	})

	const ap = new PeerPubSub<A2B, B2A>(a)

	const b = new PeerRPC<B2A, A2B>({
		send: (message) => {
			aEvents.emit("event", message)
		},
		listen: (callback) => {
			bEvents.on("event", callback)
			return () => bEvents.off("event", callback)
		},
	})

	const bp = new PeerPubSub<B2A, A2B>(b)

	return { a: ap, b: bp }
}

describe("PeerPubSub", () => {
	it("works", async () => {
		type A = {
			count(n: number, cb: (count: number) => void): () => void
		}

		type B = {}

		const { a, b } = setupPeers<A, B>()

		b.publish.count = (initialCount, cb) => {
			let n = initialCount
			const timerId = setInterval(() => cb(++n), 1)
			return () => clearInterval(timerId)
		}

		const results: number[] = []
		const unsub = await a.subscribe.count(12, (n) => {
			results.push(n)
		})
		await sleep(10)
		await unsub()

		const len = results.length
		assert.deepEqual(results.slice(0, 5), [13, 14, 15, 16, 17])
		await sleep(10)

		assert.equal(len, results.length)
	})
})
