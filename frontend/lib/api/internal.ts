/** The first secret of INTERNAL_API_SECRET (the backend accepts a list during rotation). */
export function getInternalSecret() {
	return process.env.INTERNAL_API_SECRET?.split(",")[0]?.trim() ?? "";
}
