# Peer Api

This library helps you create typed abstraction for RPC and Pub/Sub on top of a socket or event-emitter.

## Getting Started

```sh
npm install peer-api
```

Suppose you have two processes, A and B, and you have a socket between them. It's quite cumbersome to write event-based code to emit and listen. This code quickly turns into spaghetti.

However, remote procedure calls (RPC) and publish-subscribe (pub/sub) semantics are really convenient for interacting between processes.

This library allows you to define RPC and Pub/Sub interface using TypeScript types and implements all of the messaging under the hood.

So long as you can send an event and listen for events, you can use this library.

```ts
import { PeerApi } from "peer-api"

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


// Define the APIs.
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

// Test it out.
await a.call.rpcB(10)
const unsubscribeB = a.subscribe.subscribeB((value) => {
	// callback
})

await b.call.rpcA("hello")
const unsubscribeA = b.subscribe.subscribeA((value) => {
	// callback
})
```

## Future Work

If this were implemented over a UDP socket or some other kind of lossy network, then we'd need to add some retries and backoffs.
