export function deserializeError({ message, stack }) {
	const error = new Error(message)
	error.stack = stack
	return error
}

export function serializeError(error) {
	return { message: error.message, stack: error.stack }
}
