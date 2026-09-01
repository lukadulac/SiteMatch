import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type AuthRateLimitScope = "login_email_ip" | "login_ip" | "register_ip";

type AuthRateLimitResult = {
	allowed: boolean;
	retryAfterSeconds: number;
};

type AuthRateLimitRpcRow = {
	allowed: boolean;
	retry_after_seconds: number;
};

type SupabaseClientWithAuthRateLimitRpc = SupabaseClient<Database> & {
	rpc(
		fn: "auth_rate_limit_check",
		args: {
			target_scope: string;
			target_key_hash: string;
		},
	): Promise<{
		data: AuthRateLimitRpcRow[] | null;
		error: { message: string } | null;
	}>;
	rpc(
		fn: "auth_rate_limit_record_attempt",
		args: {
			target_scope: string;
			target_key_hash: string;
			max_attempts: number;
			window_seconds: number;
			block_seconds: number;
		},
	): Promise<{
		data: AuthRateLimitRpcRow[] | null;
		error: { message: string } | null;
	}>;
	rpc(
		fn: "auth_rate_limit_reset",
		args: {
			target_scope: string;
			target_key_hash: string;
		},
	): Promise<{
		data: null;
		error: { message: string } | null;
	}>;
};

export const AUTH_RATE_LIMITS = {
	loginEmailIp: {
		scope: "login_email_ip",
		maxAttempts: 5,
		windowSeconds: 15 * 60,
		blockSeconds: 15 * 60,
	},
	loginIp: {
		scope: "login_ip",
		maxAttempts: 30,
		windowSeconds: 15 * 60,
		blockSeconds: 15 * 60,
	},
	registerIp: {
		scope: "register_ip",
		maxAttempts: 5,
		windowSeconds: 60 * 60,
		blockSeconds: 60 * 60,
	},
} as const;

export function normalizeRateLimitEmail(email: string) {
	return email.trim().toLowerCase();
}

export function getRequestIp(headersList: Headers) {
	const forwardedFor = headersList.get("x-forwarded-for");
	const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

	return (
		firstForwardedIp ||
		headersList.get("x-real-ip")?.trim() ||
		headersList.get("cf-connecting-ip")?.trim() ||
		"unknown"
	);
}

export function createRateLimitKey(parts: string[]) {
	const secret = process.env.AUTH_RATE_LIMIT_SECRET;

	if (!secret && process.env.NODE_ENV === "production") {
		throw new Error("Missing AUTH_RATE_LIMIT_SECRET.");
	}

	return createHmac("sha256", secret ?? "development-rate-limit-secret")
		.update(parts.join("|"))
		.digest("hex");
}

export async function checkAuthRateLimit(
	supabase: SupabaseClient<Database>,
	scope: AuthRateLimitScope,
	keyHash: string,
): Promise<AuthRateLimitResult> {
	const { data, error } = await (
		supabase as SupabaseClientWithAuthRateLimitRpc
	).rpc("auth_rate_limit_check", {
		target_scope: scope,
		target_key_hash: keyHash,
	});

	if (error) {
		console.error("Auth rate limit check failed", error);
		return { allowed: false, retryAfterSeconds: 0 };
	}

	const result = data?.[0];

	return {
		allowed: result?.allowed ?? true,
		retryAfterSeconds: result?.retry_after_seconds ?? 0,
	};
}

export async function recordAuthRateLimitAttempt(
	supabase: SupabaseClient<Database>,
	config: {
		scope: AuthRateLimitScope;
		maxAttempts: number;
		windowSeconds: number;
		blockSeconds: number;
	},
	keyHash: string,
): Promise<AuthRateLimitResult> {
	const { data, error } = await (
		supabase as SupabaseClientWithAuthRateLimitRpc
	).rpc("auth_rate_limit_record_attempt", {
		target_scope: config.scope,
		target_key_hash: keyHash,
		max_attempts: config.maxAttempts,
		window_seconds: config.windowSeconds,
		block_seconds: config.blockSeconds,
	});

	if (error) {
		console.error("Auth rate limit attempt failed", error);
		return { allowed: false, retryAfterSeconds: 0 };
	}

	const result = data?.[0];

	return {
		allowed: result?.allowed ?? true,
		retryAfterSeconds: result?.retry_after_seconds ?? 0,
	};
}

export async function resetAuthRateLimit(
	supabase: SupabaseClient<Database>,
	scope: AuthRateLimitScope,
	keyHash: string,
) {
	const { error } = await (supabase as SupabaseClientWithAuthRateLimitRpc).rpc(
		"auth_rate_limit_reset",
		{
			target_scope: scope,
			target_key_hash: keyHash,
		},
	);

	if (error) {
		console.error("Auth rate limit reset failed", error);
	}
}
