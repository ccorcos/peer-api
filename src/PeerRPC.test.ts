import { strict as assert } from "assert"
import EventEmitter from "events"
import { after, describe, it } from "mocha"
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

		after(b.answerFn("add", (x, y) => x + y))
		after(a.answerFn("double", (x) => x + x))

		assert.equal(await a.callFn("add", 10, 2), 12)
		assert.equal(await b.callFn("double", 10), 20)
	})

	it.skip("Stop listening works", async () => {})
	it.skip("Destroy works", async () => {})

	it("Works with proxy types", async () => {
		type A = {
			add(x: number, y: number): number
		}

		type B = {
			double(x: number): number
		}

		const { a, b } = setupPeers<A, B>()

		const stopB = b.answer.add((x, y) => x + y)
		const stopA = a.answer.double((x) => x + x)

		assert.equal(await a.call.add(10, 2), 12)
		assert.equal(await b.call.double(10), 20)
	})

	it.skip("Throws an error if you try to answer more than once", async () => {})

	it("Deserializes error with combined stack traces.", async () => {
		type A = {
			doSomething(): void
		}

		type B = {}

		const { a, b } = setupPeers<A, B>()

		function somethingHelper() {
			throw new Error("error")
		}

		const stopB = b.answer.doSomething(() => {
			somethingHelper()
		})
		after(stopB)

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

	it("Rethrows error", async () => {
		type A = {
			doSomething(): void
		}

		type B = {}

		const { a, b } = setupPeers<A, B>()
		const stopB = b.answer.doSomething(() => {
			throw new Error("error")
		})
		after(stopB)

		await assert.rejects(() => a.call.doSomething())
	})
})
