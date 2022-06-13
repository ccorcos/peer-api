import { strict as assert } from "assert"
import EventEmitter from "events"
import { describe, it } from "mocha"
import { AnyFunctionMap } from "./helpers/typeHelpers"
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

	const b = new PeerRPC<B2A, A2B>({
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

describe("PeerRPC", () => {
	it("works", async () => {
		const { a, b } = setupPeers()

		b.answer.add = (x, y) => x + y
		a.answer.double = (x) => x + x

		assert.equal(await a.callFn("add", 10, 2), 12)
		assert.equal(await b.callFn("double", 10), 20)
	})

	it("works with proxies too", async () => {
		const { a, b } = setupPeers()

		b.answer.add = (x, y) => x + y
		a.answer.double = (x) => x + x

		assert.equal(await a.call.add(10, 2), 12)
		assert.equal(await b.call.double(10), 20)
	})

	it("works with proxy types", async () => {
		type A = {
			add(x: number, y: number): number
		}

		type B = {
			double(x: number): number
		}

		const { a, b } = setupPeers<A, B>()

		b.answer.add = (x, y) => x + y
		a.answer.double = (x) => x + x

		assert.equal(await a.call.add(10, 2), 12)
		assert.equal(await b.call.double(10), 20)
	})

	it("throw an error if there are no listeners", async () => {
		const { a, b } = setupPeers()
		b.answer.add = (x, y) => x + y
		assert.equal(await a.call.add(10, 2), 12)
		await assert.rejects(() => a.call.double(10))
	})

	it("stop listening works", async () => {
		const { a, b } = setupPeers()
		b.answer.add = (x, y) => x + y
		assert.equal(await a.call.add(10, 2), 12)

		delete b.answer.add
		await assert.rejects(() => a.call.add(10, 2))
	})

	it("rethrows error", async () => {
		const { a, b } = setupPeers()

		b.answer.doSomething = () => {
			throw new Error("error")
		}

		await assert.rejects(() => a.call.doSomething())
	})

	it("deserializes error with combined stack traces.", async () => {
		const { a, b } = setupPeers()

		function somethingHelper() {
			throw new Error("error")
		}

		b.answer.doSomething = () => {
			somethingHelper()
		}

		try {
			await a.call.doSomething()
			assert.fail()
		} catch (error) {
			const stack = error.stack as string

			assert.ok(
				stack.includes("doSomething"),
				"Record local stack trace to the doSomething() call."
			)
			assert.ok(
				stack.includes("somethingHelper"),
				"Record remote stack trace to the somethingHelper() call."
			)
		}
	})

	it.skip("destroy works", async () => {})
})
