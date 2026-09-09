import { describe, expect, it } from "vitest";
import {
	ensureConversationForApplication,
	getConversationById,
	getUserConversations,
	markConversationAsRead,
	sendConversationMessage,
} from "@/lib/messaging/service";
import { createSupabaseStub, type StubResponses } from "../helpers/supabase-stub";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";
const OUTSIDER_ID = "outsider-1";
const PROJECT_ID = "project-1";
const APPLICATION_ID = "application-1";
const CONVERSATION_ID = "conversation-1";

function applicationRow(overrides: Record<string, unknown> = {}) {
	return {
		id: APPLICATION_ID,
		project_id: PROJECT_ID,
		provider_id: PROVIDER_ID,
		status: "pending",
		project: { client_id: CLIENT_ID, status: "published" },
		...overrides,
	};
}

function conversationRow(overrides: Record<string, unknown> = {}) {
	return {
		id: CONVERSATION_ID,
		application_id: APPLICATION_ID,
		client_id: CLIENT_ID,
		provider_id: PROVIDER_ID,
		project_id: PROJECT_ID,
		created_at: "2026-01-01T00:00:00.000Z",
		updated_at: "2026-01-02T00:00:00.000Z",
		project: { id: PROJECT_ID, title: "Landing page", slug: "landing", status: "in_discussion" },
		application: { id: APPLICATION_ID, status: "pending", proposed_price: null, estimated_delivery_days: null },
		client: { id: CLIENT_ID, full_name: "Client" },
		provider: { id: PROVIDER_ID, full_name: "Provider" },
		...overrides,
	};
}

function message(overrides: Record<string, unknown> = {}) {
	return {
		id: "message-1",
		conversation_id: CONVERSATION_ID,
		message_text: "Hello",
		sender_id: PROVIDER_ID,
		created_at: "2026-01-02T00:00:00.000Z",
		is_read: false,
		...overrides,
	};
}

/** The three `messages` reads `getConversationById` performs, in order. */
function conversationReadStubs(
	messages: unknown[],
	unreadCount = 0,
	conversation = conversationRow(),
): StubResponses {
	return {
		"conversations.select": { data: conversation },
		"messages.select": [
			{ data: messages },
			{ data: messages.slice(-1) },
			{ count: unreadCount },
		],
	};
}

describe("ensureConversationForApplication", () => {
	it("refuses a user who is neither the listing owner nor the applicant", async () => {
		const stub = createSupabaseStub({
			"applications.select": { data: applicationRow() },
		});

		const result = await ensureConversationForApplication(
			stub.client,
			OUTSIDER_ID,
			APPLICATION_ID,
		);

		expect(result.error).toBe("Application not found.");
		expect(stub.callKeys()).not.toContain("conversations.insert");
	});

	it("reports a missing application", async () => {
		const stub = createSupabaseStub({ "applications.select": { data: null } });

		expect(
			(await ensureConversationForApplication(stub.client, CLIENT_ID, APPLICATION_ID))
				.error,
		).toBe("Application not found.");
	});

	it("refuses to open messaging on a closed application", async () => {
		for (const status of ["rejected", "withdrawn"]) {
			const stub = createSupabaseStub({
				"applications.select": { data: applicationRow({ status }) },
			});

			const result = await ensureConversationForApplication(
				stub.client,
				CLIENT_ID,
				APPLICATION_ID,
			);

			expect(result.error).toBe("This application is no longer open for messaging.");
			expect(stub.callKeys()).not.toContain("conversations.insert");
		}
	});

	it("moves the listing into discussion when the client opens the thread", async () => {
		const stub = createSupabaseStub({
			"applications.select": { data: applicationRow() },
			"projects.update": {},
			"conversations.select": { data: [] },
			"conversations.insert": { data: { id: CONVERSATION_ID } },
		});

		await ensureConversationForApplication(stub.client, CLIENT_ID, APPLICATION_ID);

		expect(stub.callsFor("projects.update")[0]?.payload).toEqual({
			status: "in_discussion",
		});
	});

	it("does not change the listing status when the provider opens the thread", async () => {
		const stub = createSupabaseStub({
			"applications.select": { data: applicationRow() },
			"conversations.select": { data: [] },
			"conversations.insert": { data: { id: CONVERSATION_ID } },
		});

		await ensureConversationForApplication(stub.client, PROVIDER_ID, APPLICATION_ID);

		expect(stub.callKeys()).not.toContain("projects.update");
	});

	it("does not touch a listing that is already in discussion", async () => {
		const stub = createSupabaseStub({
			"applications.select": {
				data: applicationRow({
					project: { client_id: CLIENT_ID, status: "in_discussion" },
				}),
			},
			"conversations.select": { data: [] },
			"conversations.insert": { data: { id: CONVERSATION_ID } },
		});

		await ensureConversationForApplication(stub.client, CLIENT_ID, APPLICATION_ID);

		expect(stub.callKeys()).not.toContain("projects.update");
	});

	it("reuses the existing conversation instead of creating a second one", async () => {
		const stub = createSupabaseStub({
			"applications.select": {
				data: applicationRow({
					project: { client_id: CLIENT_ID, status: "in_discussion" },
				}),
			},
			"conversations.select": { data: [{ id: CONVERSATION_ID }] },
		});

		const result = await ensureConversationForApplication(
			stub.client,
			PROVIDER_ID,
			APPLICATION_ID,
		);

		expect(result.data).toEqual({ id: CONVERSATION_ID });
		expect(stub.callKeys()).not.toContain("conversations.insert");
	});

	it("creates the conversation with both participants and the listing", async () => {
		const stub = createSupabaseStub({
			"applications.select": {
				data: applicationRow({
					project: { client_id: CLIENT_ID, status: "in_discussion" },
				}),
			},
			"conversations.select": { data: [] },
			"conversations.insert": { data: { id: CONVERSATION_ID } },
		});

		await ensureConversationForApplication(stub.client, PROVIDER_ID, APPLICATION_ID);

		expect(stub.callsFor("conversations.insert")[0]?.payload).toEqual({
			application_id: APPLICATION_ID,
			project_id: PROJECT_ID,
			client_id: CLIENT_ID,
			provider_id: PROVIDER_ID,
		});
	});

	it("recovers the winner's conversation when two requests race", async () => {
		const stub = createSupabaseStub({
			"applications.select": {
				data: applicationRow({
					project: { client_id: CLIENT_ID, status: "in_discussion" },
				}),
			},
			"conversations.select": [{ data: [] }, { data: [{ id: CONVERSATION_ID }] }],
			"conversations.insert": {
				error: { message: "duplicate key value", code: "23505" },
			},
		});

		const result = await ensureConversationForApplication(
			stub.client,
			PROVIDER_ID,
			APPLICATION_ID,
		);

		expect(result.data).toEqual({ id: CONVERSATION_ID });
	});

	it("surfaces an insert error that is not a duplicate", async () => {
		const stub = createSupabaseStub({
			"applications.select": {
				data: applicationRow({
					project: { client_id: CLIENT_ID, status: "in_discussion" },
				}),
			},
			"conversations.select": { data: [] },
			"conversations.insert": { error: { message: "permission denied" } },
		});

		expect(
			(await ensureConversationForApplication(stub.client, PROVIDER_ID, APPLICATION_ID))
				.error,
		).toBe("permission denied");
	});
});

describe("getConversationById", () => {
	it("hides a conversation from a non-participant", async () => {
		const stub = createSupabaseStub({
			"conversations.select": { data: conversationRow() },
		});

		const result = await getConversationById(
			stub.client,
			OUTSIDER_ID,
			CONVERSATION_ID,
		);

		expect(result.error).toBe("Conversation not found.");
		expect(stub.callKeys()).not.toContain("messages.select");
	});

	it("serves the conversation to either participant", async () => {
		for (const userId of [CLIENT_ID, PROVIDER_ID]) {
			const stub = createSupabaseStub(conversationReadStubs([message()]));

			const result = await getConversationById(stub.client, userId, CONVERSATION_ID);

			expect(result.data?.id).toBe(CONVERSATION_ID);
		}
	});

	it("returns messages oldest first", async () => {
		const newestFirst = [
			message({ id: "m3", created_at: "2026-01-03T00:00:00.000Z" }),
			message({ id: "m2", created_at: "2026-01-02T00:00:00.000Z" }),
			message({ id: "m1", created_at: "2026-01-01T00:00:00.000Z" }),
		];
		const stub = createSupabaseStub(conversationReadStubs(newestFirst));

		const result = await getConversationById(stub.client, CLIENT_ID, CONVERSATION_ID);

		expect(result.data?.messages.map((item) => item.id)).toEqual([
			"m1",
			"m2",
			"m3",
		]);
	});

	it("flags older messages only when the page overflows", async () => {
		const overflow = [message({ id: "m1" }), message({ id: "m2" })];
		const overflowStub = createSupabaseStub(conversationReadStubs(overflow));

		const overflowResult = await getConversationById(
			overflowStub.client,
			CLIENT_ID,
			CONVERSATION_ID,
			{ limit: 1 },
		);

		expect(overflowResult.data?.has_older_messages).toBe(true);
		expect(overflowResult.data?.messages).toHaveLength(1);

		const exactStub = createSupabaseStub(conversationReadStubs([message({ id: "m1" })]));

		const exactResult = await getConversationById(
			exactStub.client,
			CLIENT_ID,
			CONVERSATION_ID,
			{ limit: 1 },
		);

		expect(exactResult.data?.has_older_messages).toBe(false);
	});

	it("clamps the page size to the supported range", async () => {
		const limitArg = async (limit: number) => {
			const stub = createSupabaseStub(conversationReadStubs([message()]));
			await getConversationById(stub.client, CLIENT_ID, CONVERSATION_ID, { limit });

			return stub
				.callsFor("messages.select")[0]
				?.filters.find((filter) => filter.method === "limit")?.args[0];
		};

		// The service fetches one extra row to detect a further page.
		expect(await limitArg(0)).toBe(2);
		expect(await limitArg(500)).toBe(101);
		expect(await limitArg(25)).toBe(26);
	});

	it("returns the oldest loaded message as the pagination cursor", async () => {
		const stub = createSupabaseStub(
			conversationReadStubs([
				message({ id: "m2", created_at: "2026-01-02T00:00:00.000Z" }),
				message({ id: "m1", created_at: "2026-01-01T00:00:00.000Z" }),
			]),
		);

		const result = await getConversationById(stub.client, CLIENT_ID, CONVERSATION_ID);

		expect(result.data?.oldest_message_cursor).toBe("2026-01-01T00:00:00.000Z");
	});

	it("passes the cursor to the query when paging backwards", async () => {
		const stub = createSupabaseStub(conversationReadStubs([message()]));

		await getConversationById(stub.client, CLIENT_ID, CONVERSATION_ID, {
			before: "2026-01-01T00:00:00.000Z",
		});

		const cursorFilter = stub
			.callsFor("messages.select")[0]
			?.filters.find((filter) => filter.method === "lt");

		expect(cursorFilter?.args).toEqual(["created_at", "2026-01-01T00:00:00.000Z"]);
	});

	it("reports the unread count for the reader", async () => {
		const stub = createSupabaseStub(conversationReadStubs([message()], 4));

		const result = await getConversationById(stub.client, CLIENT_ID, CONVERSATION_ID);

		expect(result.data?.unread_count).toBe(4);
	});

	it("reports no messages as an empty thread rather than an error", async () => {
		const stub = createSupabaseStub(conversationReadStubs([]));

		const result = await getConversationById(stub.client, CLIENT_ID, CONVERSATION_ID);

		expect(result.data?.messages).toEqual([]);
		expect(result.data?.last_message).toBeNull();
		expect(result.data?.oldest_message_cursor).toBeNull();
	});
});

describe("sendConversationMessage", () => {
	it("refuses a non-participant", async () => {
		const stub = createSupabaseStub({
			"conversations.select": { data: conversationRow() },
		});

		const result = await sendConversationMessage(
			stub.client,
			OUTSIDER_ID,
			CONVERSATION_ID,
			{ message_text: "Hello" },
		);

		expect(result.error).toBe("Conversation not found.");
		expect(stub.callKeys()).not.toContain("messages.insert");
	});

	it("refuses to post to a closed application", async () => {
		for (const status of ["rejected", "withdrawn"]) {
			const stub = createSupabaseStub(
				conversationReadStubs(
					[message()],
					0,
					conversationRow({
						application: { id: APPLICATION_ID, status },
					}),
				),
			);

			const result = await sendConversationMessage(
				stub.client,
				CLIENT_ID,
				CONVERSATION_ID,
				{ message_text: "Hello" },
			);

			expect(result.error).toBe("This application is no longer open for messaging.");
			expect(stub.callKeys()).not.toContain("messages.insert");
		}
	});

	it("stores the message against the sender and bumps the conversation", async () => {
		const stub = createSupabaseStub({
			...conversationReadStubs([message()]),
			"messages.insert": { data: message({ id: "new-message" }) },
			"conversations.update": {},
		});

		const result = await sendConversationMessage(
			stub.client,
			CLIENT_ID,
			CONVERSATION_ID,
			{ message_text: "Hello there" },
		);

		expect(result.data?.id).toBe("new-message");
		expect(stub.callsFor("messages.insert")[0]?.payload).toEqual({
			conversation_id: CONVERSATION_ID,
			sender_id: CLIENT_ID,
			message_text: "Hello there",
		});
		expect(stub.callsFor("conversations.update")[0]?.payload).toHaveProperty(
			"updated_at",
		);
	});
});

describe("markConversationAsRead", () => {
	it("refuses a non-participant", async () => {
		const stub = createSupabaseStub({
			"conversations.select": { data: conversationRow() },
		});

		const result = await markConversationAsRead(
			stub.client,
			OUTSIDER_ID,
			CONVERSATION_ID,
		);

		expect(result.error).toBe("Conversation not found.");
		expect(stub.callKeys()).not.toContain("messages.update");
	});

	it("marks only unread messages from the other participant", async () => {
		const stub = createSupabaseStub({
			...conversationReadStubs([message()]),
			"messages.update": { data: [{ id: "m1" }, { id: "m2" }] },
		});

		const result = await markConversationAsRead(
			stub.client,
			CLIENT_ID,
			CONVERSATION_ID,
		);

		expect(result.data).toEqual({
			conversation_id: CONVERSATION_ID,
			updated_count: 2,
		});

		const updateCall = stub.callsFor("messages.update")[0];

		expect(updateCall?.payload).toEqual({ is_read: true });
		expect(updateCall?.filters).toEqual(
			expect.arrayContaining([
				{ method: "neq", args: ["sender_id", CLIENT_ID] },
				{ method: "eq", args: ["is_read", false] },
			]),
		);
	});

	it("reports zero when there was nothing to mark", async () => {
		const stub = createSupabaseStub({
			...conversationReadStubs([message()]),
			"messages.update": { data: null },
		});

		const result = await markConversationAsRead(
			stub.client,
			CLIENT_ID,
			CONVERSATION_ID,
		);

		expect(result.data?.updated_count).toBe(0);
	});
});

describe("getUserConversations", () => {
	it("returns an empty list without querying messages", async () => {
		const stub = createSupabaseStub({ "conversations.select": { data: [] } });

		expect(await getUserConversations(stub.client, CLIENT_ID)).toEqual({ data: [] });
		expect(stub.callKeys()).not.toContain("messages.select");
	});

	it("attaches the newest message to each conversation", async () => {
		const stub = createSupabaseStub({
			"conversations.select": { data: [conversationRow()] },
			"messages.select": {
				data: [
					message({ id: "newest", created_at: "2026-01-03T00:00:00.000Z" }),
					message({ id: "older", created_at: "2026-01-01T00:00:00.000Z" }),
				],
			},
		});

		const result = await getUserConversations(stub.client, CLIENT_ID);

		expect(result.data?.[0]?.last_message?.id).toBe("newest");
	});

	it("counts only unread messages sent by the other participant", async () => {
		const stub = createSupabaseStub({
			"conversations.select": { data: [conversationRow()] },
			"messages.select": {
				data: [
					message({ id: "theirs-unread", sender_id: PROVIDER_ID, is_read: false }),
					message({ id: "theirs-read", sender_id: PROVIDER_ID, is_read: true }),
					message({ id: "mine-unread", sender_id: CLIENT_ID, is_read: false }),
				],
			},
		});

		const result = await getUserConversations(stub.client, CLIENT_ID);

		expect(result.data?.[0]?.unread_count).toBe(1);
	});

	it("reports zero unread and no last message for a fresh conversation", async () => {
		const stub = createSupabaseStub({
			"conversations.select": { data: [conversationRow()] },
			"messages.select": { data: [] },
		});

		const result = await getUserConversations(stub.client, CLIENT_ID);

		expect(result.data?.[0]?.unread_count).toBe(0);
		expect(result.data?.[0]?.last_message).toBeNull();
	});

	it("flattens the embedded project, application, and participant rows", async () => {
		const stub = createSupabaseStub({
			"conversations.select": {
				data: [
					conversationRow({
						project: [{ id: PROJECT_ID, title: "Landing page" }],
						client: [{ id: CLIENT_ID, full_name: "Client" }],
					}),
				],
			},
			"messages.select": { data: [] },
		});

		const result = await getUserConversations(stub.client, CLIENT_ID);

		expect(result.data?.[0]?.project).toEqual({
			id: PROJECT_ID,
			title: "Landing page",
		});
		expect(result.data?.[0]?.client).toEqual({
			id: CLIENT_ID,
			full_name: "Client",
		});
	});
});
