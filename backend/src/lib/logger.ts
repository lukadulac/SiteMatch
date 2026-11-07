// console, as in the rest of the codebase. A logging library can replace this later.
export const logger = {
	info(message: string, context?: Record<string, unknown>) {
		console.info(message, context ?? {});
	},
	error(message: string, context?: Record<string, unknown>) {
		console.error(message, context ?? {});
	},
};
