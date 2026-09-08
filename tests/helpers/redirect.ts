/**
 * Server actions signal navigation by throwing from `redirect()`. Test files
 * mock `next/navigation` with:
 *
 *   vi.mock("next/navigation", () => ({
 *     redirect: (path: string) => {
 *       throw new Error(`NEXT_REDIRECT:${path}`);
 *     },
 *   }));
 *
 * and use these helpers to read the target back out.
 */

const PREFIX = "NEXT_REDIRECT:";

/** Runs an action expected to redirect and returns the target path. */
export async function expectRedirect(action: Promise<unknown>) {
	try {
		await action;
	} catch (error) {
		const message = error instanceof Error ? error.message : "";

		if (message.startsWith(PREFIX)) {
			return message.slice(PREFIX.length);
		}

		throw error;
	}

	throw new Error("expected the action to redirect");
}

/** Splits a redirect target into its pathname and query parameters. */
export async function expectRedirectTo(action: Promise<unknown>) {
	const target = await expectRedirect(action);
	const url = new URL(target, "http://localhost");

	return { pathname: url.pathname, params: url.searchParams };
}
