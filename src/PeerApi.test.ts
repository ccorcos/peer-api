import { strict as assert } from "assert"
import EventEmitter from "events"
import { describe, it } from "mocha"
import { sleep } from "./helpers/sleep"
import { AnyFunctionMap } from "./helpers/typeHelpers"
import { PeerApi } from "./PeerApi"

function setupPeers<
	A2B extends AnyFunctionMap = AnyFunctionMap,
	B2A extends AnyFunctionMap = AnyFunctionMap
>() {
	const aEvents = new EventEmitter()
	const bEvents = new EventEmitter()

	const a = new PeerApi<A2B, B2A>({
		send: (message) => {
			bEvents.emit("event", message)
		},
		listen: (callback) => {
			aEvents.on("event", callback)
			return () => aEvents.off("event", callback)
		},
	})

	const b = new PeerApi<B2A, A2B>({
		send: (message) => {
			aEvents.emit("event", message)
		},
		listen: (callback) => {
			bEvents.on("event", callback)
			return () => bEvents.off("event", callback)
		},
	})

	return { a, b }
}

describe("PeerApi", () => {
	it("works", async () => {
		type A = {
			add(a: number, b: number): number
			increment(n: number, cb: (count: number) => void): () => void
		}

		type B = {
			double(a: number): number
			decrement(n: number, cb: (count: number) => void): () => void
		}

		const { a, b } = setupPeers<A, B>()

		b.answer.add = (a, b) => a + b
		b.publish.increment = (initialCount, cb) => {
			let n = initialCount
			const timerId = setInterval(() => cb(++n), 1)
			return () => clearInterval(timerId)
		}

		a.answer.double = (a) => a + a
		a.publish.decrement = (initialCount, cb) => {
			let n = initialCount
			const timerId = setInterval(() => cb(--n), 1)
			return () => clearInterval(timerId)
		}

		assert.equal(await a.call.add(10, 2), 12)

		const incs: number[] = []
		const unsubInc = await a.subscribe.increment(12, (n) => incs.push(n))
		await sleep(10)
		await unsubInc()
		assert.deepEqual(incs.slice(0, 5), [13, 14, 15, 16, 17])

		assert.equal(await b.call.double(10), 20)
		const decs: number[] = []
		const unsubDec = await b.subscribe.decrement(12, (n) => decs.push(n))
		await sleep(10)
		await unsubDec()
		assert.deepEqual(decs.slice(0, 5), [11, 10, 9, 8, 7])
	})
})

// Process A wants to be able to call rpcB and subscribeB in process B.
type A = {
	rpcB(arg: number): number

	// A subscription is defined as a function with a callback and a returned function
	// for unsubscribing.
	subscribeB(cb: (value: number) => void): () => void
}

// Process B wants to be able to call rpcA and subscribeA in process A.
type B = {
	rpcA(arg: string): string
	subscribeA(cb: (value: string) => void): () => void
}

// Wire up each process to communicate with each other.
// We'll use EventEmitter to simulate an actual socket.
const aEvents = new EventEmitter()
const bEvents = new EventEmitter()

const a = new PeerApi<A, B>({
	send: (message) => {
		bEvents.emit("event", message)
	},
	listen: (callback) => {
		aEvents.on("event", callback)
		return () => aEvents.off("event", callback)
	},
})

const b = new PeerApi<B, A>({
	send: (message) => {
		aEvents.emit("event", message)
	},
	listen: (callback) => {
		bEvents.on("event", callback)
		return () => bEvents.off("event", callback)
	},
})

b.answer.rpcB = (x) => x + x
b.publish.subscribeB = (cb) => {
	const timerId = setInterval(() => cb(0), 1)
	return () => clearInterval(timerId)
}

a.answer.rpcA = (x) => x + a
a.publish.subscribeA = (cb) => {
	const timerId = setInterval(() => cb("hello"), 1)
	return () => clearInterval(timerId)
}
