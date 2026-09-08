import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/**
 * Minimal stand-in for a Supabase client.
 *
 * Responses are keyed by `"<table>.<operation>"` (or `"rpc.<function>"`), where the
 * operation is the first verb in the chain, so `.insert(...).select(...).single()`
 * is keyed as `"projects.insert"`. A single response is returned for every matching
 * call; an array is consumed as a queue, which is how a sequence of reads against
 * the same table is expressed.
 *
 * Tests assert on the result the service returns plus the recorded calls
 * (which table, which operation, which payload) — never on column strings.
 */

export type StubResponse = {
	data?: unknown;
	error?: { message: string; code?: string } | null;
	count?: number | null;
};

export type StubResponses = Record<string, StubResponse | StubResponse[]>;

export type RecordedCall = {
	key: string;
	table: string;
	operation: string;
	payload?: unknown;
	filters: Array<{ method: string; args: unknown[] }>;
};

export type AuthStubOptions = {
	user?: Partial<User> | null;
	getSession?: StubResponse;
	signUp?: { data?: unknown; error?: { message: string } | null };
	signInWithPassword?: { error?: { message: string } | null };
};

const CHAIN_METHODS = [
	"eq",
	"neq",
	"in",
	"or",
	"is",
	"lt",
	"lte",
	"gt",
	"gte",
	"like",
	"ilike",
	"match",
	"filter",
	"contains",
	"order",
	"limit",
	"range",
	"not",
	"returns",
	"overrideTypes",
] as const;

const VERB_METHODS = ["select", "insert", "update", "upsert", "delete"] as const;

function describeAvailable(responses: StubResponses) {
	const keys = Object.keys(responses);
	return keys.length > 0 ? keys.join(", ") : "(none)";
}

export function createSupabaseStub(
	responses: StubResponses = {},
	auth: AuthStubOptions = {},
) {
	const calls: RecordedCall[] = [];
	const queues = new Map<string, StubResponse[]>();

	function takeResponse(key: string): StubResponse {
		const configured = responses[key];

		if (configured === undefined) {
			throw new Error(
				`No stubbed Supabase response for "${key}". Stubbed keys: ${describeAvailable(responses)}`,
			);
		}

		if (!Array.isArray(configured)) {
			return configured;
		}

		if (!queues.has(key)) {
			queues.set(key, [...configured]);
		}

		const queue = queues.get(key) as StubResponse[];
		const next = queue.shift();

		if (next === undefined) {
			throw new Error(
				`Stubbed response queue for "${key}" is exhausted (called more times than expected).`,
			);
		}

		return next;
	}

	function createBuilder(table: string) {
		let operation: string | null = null;
		let payload: unknown;
		const filters: Array<{ method: string; args: unknown[] }> = [];

		function resolve() {
			const key = `${table}.${operation ?? "select"}`;
			const response = takeResponse(key);

			calls.push({
				key,
				table,
				operation: operation ?? "select",
				payload,
				filters: [...filters],
			});

			return {
				data: null,
				error: null,
				count: null,
				...response,
			};
		}

		const builder: Record<string, unknown> = {
			then(
				onFulfilled?: (value: unknown) => unknown,
				onRejected?: (reason: unknown) => unknown,
			) {
				return Promise.resolve()
					.then(() => resolve())
					.then(onFulfilled, onRejected);
			},
			single: async () => resolve(),
			maybeSingle: async () => resolve(),
		};

		for (const verb of VERB_METHODS) {
			builder[verb] = (...args: unknown[]) => {
				if (operation === null) {
					operation = verb;

					if (verb !== "select" && verb !== "delete") {
						payload = args[0];
					}
				}

				return builder;
			};
		}

		for (const method of CHAIN_METHODS) {
			builder[method] = (...args: unknown[]) => {
				filters.push({ method, args });
				return builder;
			};
		}

		return builder;
	}

	const client = {
		from: (table: string) => createBuilder(table),
		rpc: (fn: string, args?: unknown) => {
			const key = `rpc.${fn}`;

			return {
				then(
					onFulfilled?: (value: unknown) => unknown,
					onRejected?: (reason: unknown) => unknown,
				) {
					return Promise.resolve()
						.then(() => {
							const response = takeResponse(key);

							calls.push({
								key,
								table: "rpc",
								operation: fn,
								payload: args,
								filters: [],
							});

							return { data: null, error: null, ...response };
						})
						.then(onFulfilled, onRejected);
				},
			};
		},
		auth: {
			getUser: async () => ({
				data: { user: auth.user ?? null },
				error: null,
			}),
			getSession: async () =>
				auth.getSession ?? { data: { session: null }, error: null },
			signUp: async () => {
				calls.push({
					key: "auth.signUp",
					table: "auth",
					operation: "signUp",
					filters: [],
				});

				return auth.signUp ?? { data: { user: null, session: null }, error: null };
			},
			signInWithPassword: async () => {
				calls.push({
					key: "auth.signInWithPassword",
					table: "auth",
					operation: "signInWithPassword",
					filters: [],
				});

				return auth.signInWithPassword ?? { data: {}, error: null };
			},
			signOut: async () => {
				calls.push({
					key: "auth.signOut",
					table: "auth",
					operation: "signOut",
					filters: [],
				});
				return { error: null };
			},
		},
	};

	return {
		client: client as unknown as SupabaseClient<Database>,
		calls,
		/** Every recorded call for a `"<table>.<operation>"` key. */
		callsFor(key: string) {
			return calls.filter((call) => call.key === key);
		},
		/** Keys of every call made, in order — useful for "no write happened" assertions. */
		callKeys() {
			return calls.map((call) => call.key);
		},
	};
}

export type SupabaseStub = ReturnType<typeof createSupabaseStub>;

export function stubUser(overrides: Partial<User> = {}): Partial<User> {
	return {
		id: "user-1",
		email: "user@example.com",
		user_metadata: {},
		...overrides,
	};
}
