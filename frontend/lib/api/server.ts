import "server-only";
import { cookies, headers } from "next/headers";
import { applySetCookies } from "./cookies";
import { getInternalSecret } from "./internal";

export type ApiResult<T> =
	| { ok: true; status: number; data: T; message?: string }
	| { ok: false; status: number; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const BACKEND_UNAVAILABLE = "The service is temporarily unavailable. Please try again.";

/**
 * Calls the Express backend from the frontend's server (Server Components, Server Actions),
 * as the signed-in user: the request's cookies go along, and cookies the backend sets come
 * back into this response where Next.js allows it.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
	const cookieStore = await cookies();
	const requestHeaders = await headers();
	const outgoing = new Headers(init.headers);
	outgoing.set("cookie", cookieStore.toString());
	outgoing.set("x-internal-secret", getInternalSecret());
	outgoing.set("x-client-ip", requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown");

	let response: Response;
	try {
		response = await fetch(`${process.env.BACKEND_URL}${path}`, { ...init, headers: outgoing, cache: "no-store" });
	} catch {
		return { ok: false, status: 503, error: BACKEND_UNAVAILABLE };
	}

	await applySetCookies(response.headers.getSetCookie()); // No-op in a Server Component.
	const body = await response.json().catch(() => null);
	return response.ok
		? { ok: true, status: response.status, data: body?.data as T, message: body?.message }
		: { ok: false, status: response.status, error: body?.error ?? "Request failed.", fieldErrors: body?.fieldErrors };
}
