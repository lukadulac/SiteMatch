import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as GET_CONVERSATIONS } from "@/app/api/conversations/route";
import {
	GET as GET_CONVERSATION,
	PATCH as PATCH_CONVERSATION,
} from "@/app/api/conversations/[id]/route";
import { POST as POST_MESSAGE } from "@/app/api/conversations/[id]/messages/route";
import { GET as GET_META } from "@/app/api/projects/meta/route";
import {
	getConversationById,
	getUserConversations,
	markConversationAsRead,
	sendConversationMessage,
} from "@/lib/messaging/service";
import { getProjectFormMeta } from "@/lib/projects/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/messaging/service", () => ({
	getConversationById: vi.fn(),
	getUserConversations: vi.fn(),
	markConversationAsRead: vi.fn(),
	sendConversationMessage: vi.fn(),
}));

vi.mock("@/lib/projects/queries", () => ({
	getProjectFormMeta: vi.fn(),
}));

const CONVERSATION_ID = "conversation-1";
const context = { params: Promise.resolve({ id: CONVERSATION_ID }) };

function signIn(userId: string | null) {
	const stub = createSupabaseStub(
		{},
		{ user: userId ? stubUser({ id: userId }) : null },
	);

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

function conversationRequest(query = "") {
	return new Request(
		`http://localhost/api/conversations/${CONVERSATION_ID}${query}`,
	);
}

function messageRequest(body: unknown) {
	return new Request(
		`http://localhost/api/conversations/${CONVERSATION_ID}/messages`,
		{
			method: "POST",
			body: typeof body === "string" ? body : JSON.stringify(body),
		},
	);
}

/** The `limit` the handler forwarded to the service for a given query string. */
function forwardedLimit() {
	return vi.mocked(getConversationById).mock.calls[0]?.[3]?.limit;
}

beforeEach(() => {
	signIn("client-1");
	vi.mocked(getConversationById).mockResolvedValue({
		data: { id: CONVERSATION_ID },
	} as never);
});

describe("GET /api/conversations", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		expect((await GET_CONVERSATIONS()).status).toBe(401);
		expect(getUserConversations).not.toHaveBeenCalled();
	});

	it("returns the caller's conversations", async () => {
		vi.mocked(getUserConversations).mockResolvedValue({
			data: [{ id: CONVERSATION_ID }],
		} as never);

		const response = await GET_CONVERSATIONS();

		expect(response.status).toBe(200);
		expect((await response.json()).data).toHaveLength(1);
	});

	it("answers 400 on a service failure", async () => {
		vi.mocked(getUserConversations).mockResolvedValue({ error: "connection lost" });

		expect((await GET_CONVERSATIONS()).status).toBe(400);
	});
});

describe("GET /api/conversations/[id]", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await GET_CONVERSATION(conversationRequest(), context);

		expect(response.status).toBe(401);
		expect(getConversationById).not.toHaveBeenCalled();
	});

	it("defaults to a page of 50 messages", async () => {
		await GET_CONVERSATION(conversationRequest(), context);

		expect(forwardedLimit()).toBe(50);
	});

	it("clamps the requested page size to the supported range", async () => {
		const cases = [
			{ query: "?limit=0", expected: 1 },
			{ query: "?limit=1", expected: 1 },
			{ query: "?limit=25", expected: 25 },
			{ query: "?limit=500", expected: 100 },
			{ query: "?limit=-10", expected: 1 },
		];

		for (const { query, expected } of cases) {
			vi.mocked(getConversationById).mockClear();

			await GET_CONVERSATION(conversationRequest(query), context);

			expect(forwardedLimit(), query).toBe(expected);
		}
	});

	it("rejects a page size that is not a whole number", async () => {
		for (const query of ["?limit=abc", "?limit=2.5", "?limit="]) {
			const response = await GET_CONVERSATION(conversationRequest(query), context);

			if (query === "?limit=") {
				// An empty value falls back to the default page size.
				expect(response.status).toBe(200);
				continue;
			}

			expect(response.status, query).toBe(400);
			expect(await response.json()).toEqual({
				error: "Message limit must be a whole number.",
			});
		}
	});

	it("rejects a cursor that is not a timestamp", async () => {
		const response = await GET_CONVERSATION(
			conversationRequest("?before=yesterday"),
			context,
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Message cursor must be a valid timestamp.",
		});
		expect(getConversationById).not.toHaveBeenCalled();
	});

	it("forwards a valid cursor", async () => {
		await GET_CONVERSATION(
			conversationRequest("?before=2026-01-01T00%3A00%3A00.000Z"),
			context,
		);

		expect(vi.mocked(getConversationById).mock.calls[0]?.[3]?.before).toBe(
			"2026-01-01T00:00:00.000Z",
		);
	});

	it("answers 404 for a conversation the caller cannot see", async () => {
		vi.mocked(getConversationById).mockResolvedValue({
			error: "Conversation not found.",
		});

		const response = await GET_CONVERSATION(conversationRequest(), context);

		expect(response.status).toBe(404);
	});

	it("answers 400 for any other failure", async () => {
		vi.mocked(getConversationById).mockResolvedValue({ error: "connection lost" });

		expect((await GET_CONVERSATION(conversationRequest(), context)).status).toBe(400);
	});
});

describe("PATCH /api/conversations/[id]", () => {
	it("rejects an anonymous request", async () => {
		signIn(null);

		const response = await PATCH_CONVERSATION(conversationRequest(), context);

		expect(response.status).toBe(401);
		expect(markConversationAsRead).not.toHaveBeenCalled();
	});

	it("marks the thread as read", async () => {
		vi.mocked(markConversationAsRead).mockResolvedValue({
			data: { conversation_id: CONVERSATION_ID, updated_count: 3 },
		});

		const response = await PATCH_CONVERSATION(conversationRequest(), context);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.data.updated_count).toBe(3);
		expect(body.message).toBeTruthy();
	});

	it("answers 404 for a conversation the caller cannot see", async () => {
		vi.mocked(markConversationAsRead).mockResolvedValue({
			error: "Conversation not found.",
		});

		expect(
			(await PATCH_CONVERSATION(conversationRequest(), context)).status,
		).toBe(404);
	});
});

describe("POST /api/conversations/[id]/messages", () => {
	it("rejects an anonymous request before parsing the body", async () => {
		signIn(null);

		const response = await POST_MESSAGE(messageRequest({ message_text: "Hi" }), context);

		expect(response.status).toBe(401);
		expect(sendConversationMessage).not.toHaveBeenCalled();
	});

	it("rejects a body that is not JSON", async () => {
		const response = await POST_MESSAGE(messageRequest("not json"), context);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must be valid JSON.",
		});
	});

	it("rejects an empty or whitespace-only message", async () => {
		for (const message_text of ["", "   "]) {
			const response = await POST_MESSAGE(messageRequest({ message_text }), context);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.fieldErrors).toHaveProperty("message_text");
		}

		expect(sendConversationMessage).not.toHaveBeenCalled();
	});

	it("rejects a message over the length limit", async () => {
		const response = await POST_MESSAGE(
			messageRequest({ message_text: "a".repeat(4001) }),
			context,
		);

		expect(response.status).toBe(400);
	});

	it("stores the message and answers 201", async () => {
		vi.mocked(sendConversationMessage).mockResolvedValue({
			data: { id: "message-1" },
		} as never);

		const response = await POST_MESSAGE(
			messageRequest({ message_text: "  Hello   there  " }),
			context,
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body.data.id).toBe("message-1");
		expect(vi.mocked(sendConversationMessage).mock.calls[0]?.[3]).toEqual({
			message_text: "Hello there",
		});
	});

	it("answers 404 for a conversation the caller cannot see", async () => {
		vi.mocked(sendConversationMessage).mockResolvedValue({
			error: "Conversation not found.",
		});

		const response = await POST_MESSAGE(
			messageRequest({ message_text: "Hello" }),
			context,
		);

		expect(response.status).toBe(404);
	});

	it("answers 400 when the application is closed for messaging", async () => {
		vi.mocked(sendConversationMessage).mockResolvedValue({
			error: "This application is no longer open for messaging.",
		});

		const response = await POST_MESSAGE(
			messageRequest({ message_text: "Hello" }),
			context,
		);

		expect(response.status).toBe(400);
	});
});

describe("GET /api/projects/meta", () => {
	it("serves the lookup lists without requiring a session", async () => {
		signIn(null);
		vi.mocked(getProjectFormMeta).mockResolvedValue({
			data: {
				serviceTypes: [],
				businessDomains: [],
				projectGoals: [],
				featureTags: [],
			},
		} as never);

		const response = await GET_META();

		expect(response.status).toBe(200);
		expect(await response.json()).toHaveProperty("data.serviceTypes");
	});

	it("answers 400 on a lookup failure", async () => {
		vi.mocked(getProjectFormMeta).mockResolvedValue({ error: "relation missing" });

		expect((await GET_META()).status).toBe(400);
	});
});
