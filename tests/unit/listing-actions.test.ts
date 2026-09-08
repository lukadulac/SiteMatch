import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createClientProjectAction,
	openApplicationConversationAction,
	reviewApplicationAction,
	updateClientApplicationStatusAction,
} from "@/app/oglasi/actions";
import {
	applyToProjectAction,
	openProviderApplicationConversationAction,
	withdrawProviderApplicationFromJobAction,
} from "@/app/jobs/actions";
import { ensureConversationForApplication } from "@/lib/messaging/service";
import {
	createProject,
	createProjectApplication,
	markProjectApplicationViewedForClient,
	updateProjectApplicationStatusForClient,
	withdrawProjectApplicationForProvider,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFormData } from "../helpers/form-data";
import { expectRedirect, expectRedirectTo } from "../helpers/redirect";
import { createSupabaseStub, stubUser } from "../helpers/supabase-stub";

vi.mock("next/navigation", () => ({
	redirect: (path: string) => {
		throw new Error(`NEXT_REDIRECT:${path}`);
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/messaging/service", () => ({
	ensureConversationForApplication: vi.fn(),
}));

vi.mock("@/lib/projects/service", () => ({
	createProject: vi.fn(),
	createProjectApplication: vi.fn(),
	markProjectApplicationViewedForClient: vi.fn(),
	updateProjectApplicationStatusForClient: vi.fn(),
	withdrawProjectApplicationForProvider: vi.fn(),
}));

const UUID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "project-1";
const APPLICATION_ID = "application-1";
const CONVERSATION_ID = "conversation-1";
const EMPTY_STATE = { fieldErrors: {}, fields: {} };

function signIn(userId: string | null) {
	const stub = createSupabaseStub(
		{},
		{ user: userId ? stubUser({ id: userId }) : null },
	);

	vi.mocked(createSupabaseServerClient).mockResolvedValue(stub.client);

	return stub;
}

function listingForm(overrides: Record<string, string | string[] | undefined> = {}) {
	return buildFormData({
		title: "Landing page redesign",
		description: "A".repeat(60),
		service_type_id: UUID,
		business_domain_id: UUID,
		what_do_you_need_text: "We need a brand new marketing site.",
		budget_type: "range",
		budget_min: "500",
		budget_max: "1500",
		deadline_type: "flexible",
		status: "published",
		...overrides,
	});
}

function applicationForm(overrides: Record<string, string | undefined> = {}) {
	return buildFormData({
		cover_message: "I would love to build this for you.",
		...overrides,
	});
}

beforeEach(() => {
	signIn("client-1");
});

describe("createClientProjectAction", () => {
	it("refuses an anonymous submission", async () => {
		signIn(null);

		const state = await createClientProjectAction(EMPTY_STATE, listingForm());

		expect(state.formError).toMatch(/signed in/i);
		expect(createProject).not.toHaveBeenCalled();
	});

	it("treats a checked box as true and an absent box as false", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: PROJECT_ID, slug: "x", status: "draft" },
		});

		await expectRedirect(
			createClientProjectAction(
				EMPTY_STATE,
				listingForm({
					needs_seo: "on",
					has_existing_website: "on",
					existing_website_url: "https://example.com",
				}),
			),
		);

		const input = vi.mocked(createProject).mock.calls[0]?.[2];

		expect(input).toMatchObject({
			needs_seo: true,
			has_existing_website: true,
			needs_design: false,
			needs_content_writing: false,
			is_remote_friendly: false,
		});
	});

	it("turns an empty numeric field into null", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: PROJECT_ID, slug: "x", status: "draft" },
		});

		await expectRedirect(
			createClientProjectAction(
				EMPTY_STATE,
				listingForm({ budget_max: "", estimated_pages: "" }),
			),
		);

		const input = vi.mocked(createProject).mock.calls[0]?.[2];

		expect(input?.budget_max).toBeNull();
		expect(input?.estimated_pages).toBeNull();
	});

	it("rejects a numeric field that is not a number", async () => {
		const state = await createClientProjectAction(
			EMPTY_STATE,
			listingForm({ budget_min: "a lot" }),
		);

		expect(state.fieldErrors).toHaveProperty("budget_min");
		expect(createProject).not.toHaveBeenCalled();
	});

	it("collects every selected goal and feature", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: PROJECT_ID, slug: "x", status: "draft" },
		});

		await expectRedirect(
			createClientProjectAction(
				EMPTY_STATE,
				listingForm({ goal_ids: [UUID, UUID], feature_ids: [UUID] }),
			),
		);

		const input = vi.mocked(createProject).mock.calls[0]?.[2];

		expect(input?.goal_ids).toHaveLength(2);
		expect(input?.feature_ids).toHaveLength(1);
	});

	it("defaults a missing status to draft", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: PROJECT_ID, slug: "x", status: "draft" },
		});

		await expectRedirect(
			createClientProjectAction(EMPTY_STATE, listingForm({ status: undefined })),
		);

		expect(vi.mocked(createProject).mock.calls[0]?.[2]?.status).toBe("draft");
	});

	it("returns to the listing board on success", async () => {
		vi.mocked(createProject).mockResolvedValue({
			data: { id: PROJECT_ID, slug: "x", status: "published" },
		});

		const path = await expectRedirect(
			createClientProjectAction(EMPTY_STATE, listingForm()),
		);

		expect(path).toBe("/oglasi");
	});

	it("surfaces a service refusal and keeps the submitted values", async () => {
		vi.mocked(createProject).mockResolvedValue({
			error: "Complete your client profile before managing listings.",
		});

		const state = await createClientProjectAction(EMPTY_STATE, listingForm());

		expect(state.formError).toBe(
			"Complete your client profile before managing listings.",
		);
		expect(state.fields?.title).toBe("Landing page redesign");
	});
});

describe("updateClientApplicationStatusAction", () => {
	it("sends an anonymous caller to the login page", async () => {
		signIn(null);

		const path = await expectRedirect(
			updateClientApplicationStatusAction(PROJECT_ID, APPLICATION_ID, "accepted"),
		);

		expect(path).toBe("/login");
		expect(updateProjectApplicationStatusForClient).not.toHaveBeenCalled();
	});

	it("rejects a status outside the allowed set", async () => {
		await expect(
			updateClientApplicationStatusAction(
				PROJECT_ID,
				APPLICATION_ID,
				"withdrawn" as "accepted",
			),
		).rejects.toThrow("Invalid application status.");
		expect(updateProjectApplicationStatusForClient).not.toHaveBeenCalled();
	});

	it("reports a refusal back on the listing page", async () => {
		vi.mocked(updateProjectApplicationStatusForClient).mockResolvedValue({
			error: "This application can no longer be updated.",
		});

		const { pathname, params } = await expectRedirectTo(
			updateClientApplicationStatusAction(PROJECT_ID, APPLICATION_ID, "accepted"),
		);

		expect(pathname).toBe(`/oglasi/${PROJECT_ID}`);
		expect(params.get("applicationError")).toBe(
			"This application can no longer be updated.",
		);
	});

	it("confirms each successful status change", async () => {
		const cases = [
			{ status: "accepted", message: "Application accepted." },
			{ status: "shortlisted", message: "Application shortlisted." },
			{ status: "rejected", message: "Application rejected." },
		] as const;

		for (const { status, message } of cases) {
			vi.mocked(updateProjectApplicationStatusForClient).mockResolvedValue({
				data: { id: APPLICATION_ID, status },
			});

			const { pathname, params } = await expectRedirectTo(
				updateClientApplicationStatusAction(PROJECT_ID, APPLICATION_ID, status),
			);

			expect(pathname).toBe(`/oglasi/${PROJECT_ID}`);
			expect(params.get("applicationStatus")).toBe(message);
		}
	});
});

describe("reviewApplicationAction", () => {
	it("confirms a newly viewed application", async () => {
		vi.mocked(markProjectApplicationViewedForClient).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "viewed" },
		});

		const { params } = await expectRedirectTo(
			reviewApplicationAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(params.get("applicationStatus")).toBe("Application marked as viewed.");
	});

	it("reports an application that was already reviewed", async () => {
		vi.mocked(markProjectApplicationViewedForClient).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "shortlisted" },
		});

		const { params } = await expectRedirectTo(
			reviewApplicationAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(params.get("applicationStatus")).toBe("Application already reviewed.");
	});

	it("reports a refusal back on the listing page", async () => {
		vi.mocked(markProjectApplicationViewedForClient).mockResolvedValue({
			error: "Application not found.",
		});

		const { params } = await expectRedirectTo(
			reviewApplicationAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(params.get("applicationError")).toBe("Application not found.");
	});
});

describe("openApplicationConversationAction", () => {
	it("opens the thread in the client's inbox", async () => {
		vi.mocked(ensureConversationForApplication).mockResolvedValue({
			data: { id: CONVERSATION_ID },
		});

		const { pathname, params } = await expectRedirectTo(
			openApplicationConversationAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(pathname).toBe("/dashboard/messages");
		expect(params.get("conversation")).toBe(CONVERSATION_ID);
	});

	it("raises the service refusal", async () => {
		vi.mocked(ensureConversationForApplication).mockResolvedValue({
			error: "This application is no longer open for messaging.",
		});

		await expect(
			openApplicationConversationAction(PROJECT_ID, APPLICATION_ID),
		).rejects.toThrow("This application is no longer open for messaging.");
	});
});

describe("applyToProjectAction", () => {
	it("refuses an anonymous submission", async () => {
		signIn(null);

		const state = await applyToProjectAction(PROJECT_ID, {}, applicationForm());

		expect(state.formError).toMatch(/signed in/i);
		expect(createProjectApplication).not.toHaveBeenCalled();
	});

	it("reports a cover message that is too short", async () => {
		const state = await applyToProjectAction(
			PROJECT_ID,
			{},
			applicationForm({ cover_message: "Hi" }),
		);

		expect(state.fieldErrors?.cover_message).toBeTruthy();
		expect(createProjectApplication).not.toHaveBeenCalled();
	});

	it("turns empty optional numbers into null", async () => {
		vi.mocked(createProjectApplication).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "pending" },
		});

		await expectRedirect(
			applyToProjectAction(
				PROJECT_ID,
				{},
				applicationForm({ proposed_price: "", estimated_delivery_days: "" }),
			),
		);

		expect(vi.mocked(createProjectApplication).mock.calls[0]?.[3]).toMatchObject({
			proposed_price: null,
			estimated_delivery_days: null,
		});
	});

	it("rejects a price that is not a number", async () => {
		const state = await applyToProjectAction(
			PROJECT_ID,
			{},
			applicationForm({ proposed_price: "negotiable" }),
		);

		expect(state.fieldErrors?.proposed_price).toBeTruthy();
		expect(createProjectApplication).not.toHaveBeenCalled();
	});

	it("lands the provider on their dashboard after applying", async () => {
		vi.mocked(createProjectApplication).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "pending" },
		});

		const path = await expectRedirect(
			applyToProjectAction(PROJECT_ID, {}, applicationForm()),
		);

		expect(path).toBe("/dashboard/provider");
	});

	it("surfaces a duplicate application without losing the draft", async () => {
		vi.mocked(createProjectApplication).mockResolvedValue({
			error: "You have already applied to this project.",
		});

		const state = await applyToProjectAction(PROJECT_ID, {}, applicationForm());

		expect(state.formError).toBe("You have already applied to this project.");
		expect(state.fields?.cover_message).toBe("I would love to build this for you.");
	});
});

describe("withdrawProviderApplicationFromJobAction", () => {
	it("confirms the withdrawal on the job page", async () => {
		vi.mocked(withdrawProjectApplicationForProvider).mockResolvedValue({
			data: { id: APPLICATION_ID, status: "withdrawn" },
		});

		const { pathname, params } = await expectRedirectTo(
			withdrawProviderApplicationFromJobAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(pathname).toBe(`/jobs/${PROJECT_ID}`);
		expect(params.get("applicationStatus")).toBe("Proposal withdrawn.");
	});

	it("reports a refusal on the job page", async () => {
		vi.mocked(withdrawProjectApplicationForProvider).mockResolvedValue({
			error: "Application could not be withdrawn.",
		});

		const { params } = await expectRedirectTo(
			withdrawProviderApplicationFromJobAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(params.get("applicationError")).toBe(
			"Application could not be withdrawn.",
		);
	});
});

describe("openProviderApplicationConversationAction", () => {
	it("opens the thread in the provider's inbox", async () => {
		vi.mocked(ensureConversationForApplication).mockResolvedValue({
			data: { id: CONVERSATION_ID },
		});

		const path = await expectRedirect(
			openProviderApplicationConversationAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(path).toBe(`/dashboard/messages/${CONVERSATION_ID}`);
	});

	it("reports a refusal on the job page instead of throwing", async () => {
		vi.mocked(ensureConversationForApplication).mockResolvedValue({
			error: "This application is no longer open for messaging.",
		});

		const { pathname, params } = await expectRedirectTo(
			openProviderApplicationConversationAction(PROJECT_ID, APPLICATION_ID),
		);

		expect(pathname).toBe(`/jobs/${PROJECT_ID}`);
		expect(params.get("applicationError")).toBe(
			"This application is no longer open for messaging.",
		);
	});
});
