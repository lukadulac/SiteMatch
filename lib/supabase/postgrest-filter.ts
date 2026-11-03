/**
 * Builds a PostgREST `or` filter that matches `term` as plain text in any of `columns`.
 * User input is escaped twice: LIKE wildcards (`%`, `_`, `\`) so they match literally,
 * then the whole pattern is double-quoted so commas, dots and parentheses cannot end the
 * value and inject another condition.
 */
export function ilikeAnyColumn(columns: readonly string[], term: string) {
	const likePattern = `%${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
	const quoted = `"${likePattern.replace(/[\\"]/g, (character) => `\\${character}`)}"`;

	return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}
