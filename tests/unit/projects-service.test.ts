import { describe, expect, it } from "vitest";
import { createProjectSchema } from "@/lib/projects/schemas";
import {
	createProject,
	createProjectApplication,
	getClientProjects,
	getProjectApplicationForClient,
	getProjectApplicationsForClient,
	markProjectApplicationViewedForClient,
	recalculateProjectDiscussionStatus,
	updateClientProject,
	updateProjectApplicationStatusForClient,
	withdrawProjectApplicationForProvider,
} from "@/lib/projects/service";
import { createSupabaseStub, type StubResponses } from "../helpers/supabase-stub";

const CLIENT_ID = "client-1";
const PROVIDER_ID = "provider-1";
const PROJECT_ID = "project-1";
const APPLICATION_ID = "application-1";
const UUID = "11111111-1111-4111-8111-111111111111";

const CLIENT_ROLE = { data: { role: "client" } };
const PROVIDER_ROLE = { data: { role: "provider" } };

const COMPLETE_CLIENT_PROFILE = {
	data: {
		business_name: "Dulac Studio",
		business_type: "local_service",
		business_type_text: null,
		project_idea: "A booking site for two salon locations.",
		interested_solution_types: ["business_website"],
		interested_solution_other_text: null,
	},
};

function projectInput(overrides: Record<string, unknown> = {}) {
	return createProjectSchema.parse({
		title: "Landing page redesign",
		description: "A".repeat(60),
		service_type_id: UUID,
		business_domain_id: UUID,
		what_do_you_need_text: "We need a brand new marketing site.",
		budget_type: "range",
		budget_min: 500,
		budget_max: 1500,
		deadline_type: "flexible",
		status: "published",
		...overrides,
	});
}

/** Stubs the read path shared by every client-owned listing mutation. */
function clientProjectStubs(extra: StubResponses = {}): StubResponses {
	return {
		"profiles.select": CLIENT_ROLE,
		"client_profiles.select": COMPLETE_CLIENT_PROFILE,
		"project_request_goals.delete": {},
		"project_request_features.delete": {},
		"project_request_goals.insert": {},
		"project_request_features.insert": {},
		...extra,
	};
}

describe("createProject", () => {
	it("refuses a non-client and writes nothing", async () => {
		const stub = createSupabaseStub({ "profiles.select": PROVIDER_ROLE });

		const result = await createProject(stub.client, PROVIDER_ID, projectInput());

		expect(result.error).toBe("Only clients can manage project listings.");
		expect(stub.callKeys()).not.toContain("projects.insert");
	});

	it("refuses a client whose profile is incomplete", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"client_profiles.select": { data: null },
		});

		const result = await createProject(stub.client, CLIENT_ID, projectInput());

		expect(result.error).toBe(
			"Complete your client profile before managing listings.",
		);
		expect(stub.callKeys()).not.toContain("projects.insert");
	});

	it("stamps the listing with the owner and a slug derived from the title", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.insert": {
					data: { id: PROJECT_ID, slug: "landing-page-redesign-abc", status: "published" },
				},
			}),
		);

		const result = await createProject(stub.client, CLIENT_ID, projectInput());

		expect(result.data).toEqual({
			id: PROJECT_ID,
			slug: "landing-page-redesign-abc",
			status: "published",
		});

		const payload = stub.callsFor("projects.insert")[0]?.payload as {
			client_id: string;
			slug: string;
			title: string;
		};

		expect(payload.client_id).toBe(CLIENT_ID);
		expect(payload.title).toBe("Landing page redesign");
		expect(payload.slug).toMatch(/^landing-page-redesign-[0-9a-f]{8}$/);
	});

	it("builds a url-safe slug from accented titles", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.insert": { data: { id: PROJECT_ID, slug: "x", status: "draft" } },
			}),
		);

		await createProject(
			stub.client,
			CLIENT_ID,
			projectInput({ title: "Šta radiš — nova prezentacija" }),
		);

		const payload = stub.callsFor("projects.insert")[0]?.payload as { slug: string };

		expect(payload.slug).toMatch(/^sta-radis-nova-prezentacija-[0-9a-f]{8}$/);
	});

	it("writes goal and feature relations when they are selected", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.insert": { data: { id: PROJECT_ID, slug: "x", status: "draft" } },
			}),
		);

		await createProject(
			stub.client,
			CLIENT_ID,
			projectInput({ goal_ids: [UUID], feature_ids: [UUID] }),
		);

		expect(stub.callsFor("project_request_goals.insert")[0]?.payload).toEqual([
			{ project_id: PROJECT_ID, goal_id: UUID },
		]);
		expect(stub.callsFor("project_request_features.insert")[0]?.payload).toEqual([
			{ project_id: PROJECT_ID, feature_id: UUID },
		]);
	});

	it("skips relation inserts when nothing is selected", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.insert": { data: { id: PROJECT_ID, slug: "x", status: "draft" } },
			}),
		);

		await createProject(stub.client, CLIENT_ID, projectInput());

		expect(stub.callKeys()).toContain("project_request_goals.delete");
		expect(stub.callKeys()).not.toContain("project_request_goals.insert");
		expect(stub.callKeys()).not.toContain("project_request_features.insert");
	});

	it("surfaces a database error from the insert", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.insert": { error: { message: "duplicate slug" } },
			}),
		);

		const result = await createProject(stub.client, CLIENT_ID, projectInput());

		expect(result.error).toBe("duplicate slug");
	});
});

describe("updateClientProject", () => {
	it("refuses a listing owned by someone else", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.select": {
					data: { id: PROJECT_ID, client_id: "someone-else", status: "published" },
				},
			}),
		);

		const result = await updateClientProject(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
			projectInput(),
		);

		expect(result.error).toBe("Project not found.");
		expect(stub.callKeys()).not.toContain("projects.update");
	});

	it("refuses a listing that has moved past the editable statuses", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.select": {
					data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "completed" },
				},
			}),
		);

		const result = await updateClientProject(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
			projectInput(),
		);

		expect(result.error).toMatch(/can be updated/);
		expect(stub.callKeys()).not.toContain("projects.update");
	});

	it("updates a published listing", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.select": {
					data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "published" },
				},
				"projects.update": {
					data: { id: PROJECT_ID, slug: "landing-page-redesign-abc", status: "draft" },
				},
			}),
		);

		const result = await updateClientProject(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
			projectInput({ status: "draft" }),
		);

		expect(result.data?.id).toBe(PROJECT_ID);

		const payload = stub.callsFor("projects.update")[0]?.payload as {
			status: string;
		};

		expect(payload.status).toBe("draft");
	});

	it("never lets an update reassign the owner or the slug", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.select": {
					data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "published" },
				},
				"projects.update": {
					data: { id: PROJECT_ID, slug: "x", status: "published" },
				},
			}),
		);

		await updateClientProject(stub.client, CLIENT_ID, PROJECT_ID, projectInput());

		const payload = stub.callsFor("projects.update")[0]?.payload as {
			client_id?: string;
			slug?: string;
		};

		expect(payload.client_id).toBeUndefined();
		expect(payload.slug).toBeUndefined();
	});

	it("keeps a listing in discussion even if the form submits another status", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.select": {
					data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "in_discussion" },
				},
				"projects.update": {
					data: { id: PROJECT_ID, slug: "x", status: "in_discussion" },
				},
			}),
		);

		await updateClientProject(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
			projectInput({ status: "draft" }),
		);

		const payload = stub.callsFor("projects.update")[0]?.payload as {
			status: string;
		};

		expect(payload.status).toBe("in_discussion");
	});

	it("replaces the relation rows on every update", async () => {
		const stub = createSupabaseStub(
			clientProjectStubs({
				"projects.select": {
					data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "published" },
				},
				"projects.update": {
					data: { id: PROJECT_ID, slug: "x", status: "published" },
				},
			}),
		);

		await updateClientProject(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
			projectInput({ goal_ids: [UUID] }),
		);

		expect(stub.callKeys()).toContain("project_request_goals.delete");
		expect(stub.callKeys()).toContain("project_request_features.delete");
		expect(stub.callsFor("project_request_goals.insert")).toHaveLength(1);
	});
});

describe("getClientProjects", () => {
	it("refuses a non-client", async () => {
		const stub = createSupabaseStub({ "profiles.select": PROVIDER_ROLE });

		const result = await getClientProjects(stub.client, PROVIDER_ID);

		expect(result.error).toBe("Only clients can view their project listings.");
		expect(stub.callKeys()).not.toContain("projects.select");
	});

	it("returns an empty list rather than null when the client has no listings", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"projects.select": { data: null },
		});

		expect(await getClientProjects(stub.client, CLIENT_ID)).toEqual({ data: [] });
	});
});

describe("createProjectApplication", () => {
	const application = { cover_message: "I would love to build this.", proposed_price: null, estimated_delivery_days: null };

	it("refuses a non-provider", async () => {
		const stub = createSupabaseStub({ "profiles.select": CLIENT_ROLE });

		const result = await createProjectApplication(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
			application,
		);

		expect(result.error).toBe("Only providers can access this resource.");
		expect(stub.callKeys()).not.toContain("applications.insert");
	});

	it("hides listings that are not open for applications", async () => {
		for (const status of ["draft", "assigned", "completed", "cancelled"]) {
			const stub = createSupabaseStub({
				"profiles.select": PROVIDER_ROLE,
				"projects.select": { data: { id: PROJECT_ID, client_id: CLIENT_ID, status } },
			});

			const result = await createProjectApplication(
				stub.client,
				PROVIDER_ID,
				PROJECT_ID,
				application,
			);

			expect(result.error).toBe("Project not found.");
			expect(stub.callKeys()).not.toContain("applications.insert");
		}
	});

	it("accepts applications on published and in-discussion listings", async () => {
		for (const status of ["published", "in_discussion"]) {
			const stub = createSupabaseStub({
				"profiles.select": PROVIDER_ROLE,
				"projects.select": { data: { id: PROJECT_ID, client_id: CLIENT_ID, status } },
				"applications.select": { data: null },
				"applications.insert": { data: { id: APPLICATION_ID, status: "pending" } },
			});

			const result = await createProjectApplication(
				stub.client,
				PROVIDER_ID,
				PROJECT_ID,
				application,
			);

			expect(result.data).toEqual({ id: APPLICATION_ID, status: "pending" });
		}
	});

	it("refuses an application to the applicant's own listing", async () => {
		const stub = createSupabaseStub({
			"profiles.select": PROVIDER_ROLE,
			"projects.select": {
				data: { id: PROJECT_ID, client_id: PROVIDER_ID, status: "published" },
			},
		});

		const result = await createProjectApplication(
			stub.client,
			PROVIDER_ID,
			PROJECT_ID,
			application,
		);

		expect(result.error).toBe("Providers cannot apply to their own project.");
		expect(stub.callKeys()).not.toContain("applications.insert");
	});

	it("refuses a second application to the same listing", async () => {
		const stub = createSupabaseStub({
			"profiles.select": PROVIDER_ROLE,
			"projects.select": {
				data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "published" },
			},
			"applications.select": { data: { id: APPLICATION_ID } },
		});

		const result = await createProjectApplication(
			stub.client,
			PROVIDER_ID,
			PROJECT_ID,
			application,
		);

		expect(result.error).toBe("You have already applied to this project.");
		expect(stub.callKeys()).not.toContain("applications.insert");
	});

	it("records the applicant and opens the application as pending", async () => {
		const stub = createSupabaseStub({
			"profiles.select": PROVIDER_ROLE,
			"projects.select": {
				data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "published" },
			},
			"applications.select": { data: null },
			"applications.insert": { data: { id: APPLICATION_ID, status: "pending" } },
		});

		await createProjectApplication(stub.client, PROVIDER_ID, PROJECT_ID, {
			cover_message: "I would love to build this.",
			proposed_price: 1200,
			estimated_delivery_days: 30,
		});

		expect(stub.callsFor("applications.insert")[0]?.payload).toMatchObject({
			project_id: PROJECT_ID,
			provider_id: PROVIDER_ID,
			status: "pending",
			proposed_price: 1200,
			estimated_delivery_days: 30,
		});
	});
});

describe("getProjectApplicationForClient", () => {
	it("refuses a non-client", async () => {
		const stub = createSupabaseStub({ "profiles.select": PROVIDER_ROLE });

		const result = await getProjectApplicationForClient(
			stub.client,
			PROVIDER_ID,
			APPLICATION_ID,
		);

		expect(result.error).toBe("Only clients can access this resource.");
	});

	it("hides an application belonging to another client's listing", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"applications.select": {
				data: {
					id: APPLICATION_ID,
					status: "pending",
					project: { id: PROJECT_ID, client_id: "another-client" },
				},
			},
		});

		const result = await getProjectApplicationForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
		);

		expect(result.error).toBe("Application not found.");
	});

	it("flattens the embedded provider and project rows", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"applications.select": {
				data: {
					id: APPLICATION_ID,
					status: "pending",
					provider: [{ id: PROVIDER_ID, full_name: "Ana" }],
					project: [{ id: PROJECT_ID, client_id: CLIENT_ID }],
				},
			},
		});

		const result = await getProjectApplicationForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
		);

		expect(result.data?.provider).toEqual({ id: PROVIDER_ID, full_name: "Ana" });
		expect(result.data?.project).toEqual({ id: PROJECT_ID, client_id: CLIENT_ID });
	});
});

describe("getProjectApplicationsForClient", () => {
	it("refuses a listing the client does not own", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"projects.select": {
				data: { id: PROJECT_ID, client_id: "another-client", status: "published" },
			},
		});

		const result = await getProjectApplicationsForClient(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
		);

		expect(result.error).toBe("Project not found.");
		expect(stub.callKeys()).not.toContain("applications.select");
	});

	it("flattens each embedded provider row", async () => {
		const stub = createSupabaseStub({
			"profiles.select": CLIENT_ROLE,
			"projects.select": {
				data: { id: PROJECT_ID, client_id: CLIENT_ID, status: "published" },
			},
			"applications.select": {
				data: [
					{ id: APPLICATION_ID, provider: [{ id: PROVIDER_ID, full_name: "Ana" }] },
					{ id: "application-2", provider: null },
				],
			},
		});

		const result = await getProjectApplicationsForClient(
			stub.client,
			CLIENT_ID,
			PROJECT_ID,
		);

		expect(result.data?.[0]?.provider).toEqual({ id: PROVIDER_ID, full_name: "Ana" });
		expect(result.data?.[1]?.provider).toBeNull();
	});
});

describe("updateProjectApplicationStatusForClient", () => {
	function applicationStubs(status: string, extra: StubResponses = {}): StubResponses {
		return {
			"profiles.select": CLIENT_ROLE,
			"applications.select": {
				data: {
					id: APPLICATION_ID,
					status,
					project: { id: PROJECT_ID, client_id: CLIENT_ID },
				},
			},
			...extra,
		};
	}

	it("refuses to move an application out of a terminal status", async () => {
		for (const status of ["accepted", "rejected", "withdrawn"]) {
			const stub = createSupabaseStub(applicationStubs(status));

			const result = await updateProjectApplicationStatusForClient(
				stub.client,
				CLIENT_ID,
				APPLICATION_ID,
				{ status: "shortlisted" },
			);

			expect(result.error).toBe("This application can no longer be updated.");
			expect(stub.callKeys()).not.toContain("applications.update");
		}
	});

	it("treats a repeated status as a no-op", async () => {
		const stub = createSupabaseStub(applicationStubs("shortlisted"));

		const result = await updateProjectApplicationStatusForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
			{ status: "shortlisted" },
		);

		expect(result.data).toEqual({ id: APPLICATION_ID, status: "shortlisted" });
		expect(stub.callKeys()).not.toContain("applications.update");
	});

	it("delegates acceptance to the transactional database function", async () => {
		const stub = createSupabaseStub(
			applicationStubs("shortlisted", {
				"rpc.accept_project_application": {
					data: [
						{
							application_id: APPLICATION_ID,
							application_status: "accepted",
							conversation_id: "conversation-1",
						},
					],
				},
			}),
		);

		const result = await updateProjectApplicationStatusForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
			{ status: "accepted" },
		);

		expect(result.data).toEqual({ id: APPLICATION_ID, status: "accepted" });
		expect(stub.callsFor("rpc.accept_project_application")[0]?.payload).toEqual({
			target_application_id: APPLICATION_ID,
		});
		expect(stub.callKeys()).not.toContain("applications.update");
	});

	it("delegates rejection to the transactional database function", async () => {
		const stub = createSupabaseStub(
			applicationStubs("viewed", {
				"rpc.reject_project_application": {
					data: [
						{
							application_id: APPLICATION_ID,
							application_status: "rejected",
							project_id: PROJECT_ID,
							project_status: "published",
						},
					],
				},
			}),
		);

		const result = await updateProjectApplicationStatusForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
			{ status: "rejected" },
		);

		expect(result.data?.status).toBe("rejected");
		expect(stub.callKeys()).not.toContain("applications.update");
	});

	it("reports a failure when the accept function returns no row", async () => {
		const stub = createSupabaseStub(
			applicationStubs("pending", {
				"rpc.accept_project_application": { data: [] },
			}),
		);

		const result = await updateProjectApplicationStatusForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
			{ status: "accepted" },
		);

		expect(result.error).toBe("Application could not be accepted.");
	});

	it("shortlists with a plain update rather than a database function", async () => {
		const stub = createSupabaseStub(
			applicationStubs("pending", {
				"applications.update": {
					data: { id: APPLICATION_ID, status: "shortlisted" },
				},
			}),
		);

		const result = await updateProjectApplicationStatusForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
			{ status: "shortlisted" },
		);

		expect(result.data?.status).toBe("shortlisted");
		expect(stub.callsFor("applications.update")[0]?.payload).toEqual({
			status: "shortlisted",
		});
	});
});

describe("markProjectApplicationViewedForClient", () => {
	function applicationStubs(status: string, extra: StubResponses = {}): StubResponses {
		return {
			"profiles.select": CLIENT_ROLE,
			"applications.select": {
				data: {
					id: APPLICATION_ID,
					status,
					project: { id: PROJECT_ID, client_id: CLIENT_ID },
				},
			},
			...extra,
		};
	}

	it("moves a pending application to viewed", async () => {
		const stub = createSupabaseStub(
			applicationStubs("pending", {
				"applications.update": { data: { id: APPLICATION_ID, status: "viewed" } },
			}),
		);

		const result = await markProjectApplicationViewedForClient(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
		);

		expect(result.data?.status).toBe("viewed");
		expect(stub.callsFor("applications.update")[0]?.payload).toEqual({
			status: "viewed",
		});
	});

	it("leaves any other status untouched", async () => {
		for (const status of ["viewed", "shortlisted", "accepted", "rejected"]) {
			const stub = createSupabaseStub(applicationStubs(status));

			const result = await markProjectApplicationViewedForClient(
				stub.client,
				CLIENT_ID,
				APPLICATION_ID,
			);

			expect(result.data).toEqual({ id: APPLICATION_ID, status });
			expect(stub.callKeys()).not.toContain("applications.update");
		}
	});
});

describe("withdrawProjectApplicationForProvider", () => {
	it("refuses a non-provider", async () => {
		const stub = createSupabaseStub({ "profiles.select": CLIENT_ROLE });

		const result = await withdrawProjectApplicationForProvider(
			stub.client,
			CLIENT_ID,
			APPLICATION_ID,
		);

		expect(result.error).toBe("Only providers can access this resource.");
		expect(stub.callKeys()).not.toContain("rpc.withdraw_project_application");
	});

	it("delegates to the transactional database function", async () => {
		const stub = createSupabaseStub({
			"profiles.select": PROVIDER_ROLE,
			"rpc.withdraw_project_application": {
				data: [
					{
						application_id: APPLICATION_ID,
						application_status: "withdrawn",
						project_id: PROJECT_ID,
						project_status: "published",
					},
				],
			},
		});

		const result = await withdrawProjectApplicationForProvider(
			stub.client,
			PROVIDER_ID,
			APPLICATION_ID,
		);

		expect(result.data).toEqual({ id: APPLICATION_ID, status: "withdrawn" });
		expect(
			stub.callsFor("rpc.withdraw_project_application")[0]?.payload,
		).toEqual({ target_application_id: APPLICATION_ID });
	});

	it("reports a failure when the function returns no row", async () => {
		const stub = createSupabaseStub({
			"profiles.select": PROVIDER_ROLE,
			"rpc.withdraw_project_application": { data: [] },
		});

		const result = await withdrawProjectApplicationForProvider(
			stub.client,
			PROVIDER_ID,
			APPLICATION_ID,
		);

		expect(result.error).toBe("Application could not be withdrawn.");
	});
});

describe("recalculateProjectDiscussionStatus", () => {
	it("does nothing when the listing is not in discussion", async () => {
		const stub = createSupabaseStub({
			"projects.select": { data: { id: PROJECT_ID, status: "published" } },
		});

		const result = await recalculateProjectDiscussionStatus(stub.client, PROJECT_ID);

		expect(result.data).toBeNull();
		expect(stub.callKeys()).not.toContain("projects.update");
	});

	it("keeps the listing in discussion while an active application remains", async () => {
		const stub = createSupabaseStub({
			"projects.select": { data: { id: PROJECT_ID, status: "in_discussion" } },
			"applications.select": { data: { id: APPLICATION_ID } },
		});

		const result = await recalculateProjectDiscussionStatus(stub.client, PROJECT_ID);

		expect(result.data).toBeNull();
		expect(stub.callKeys()).not.toContain("projects.update");
	});

	it("republishes the listing once no active application is left", async () => {
		const stub = createSupabaseStub({
			"projects.select": { data: { id: PROJECT_ID, status: "in_discussion" } },
			"applications.select": { data: null },
			"projects.update": { data: { id: PROJECT_ID, status: "published" } },
		});

		const result = await recalculateProjectDiscussionStatus(stub.client, PROJECT_ID);

		expect(result.data).toEqual({ id: PROJECT_ID, status: "published" });
		expect(stub.callsFor("projects.update")[0]?.payload).toEqual({
			status: "published",
		});
	});

	it("reports a missing listing", async () => {
		const stub = createSupabaseStub({ "projects.select": { data: null } });

		expect(
			(await recalculateProjectDiscussionStatus(stub.client, PROJECT_ID)).error,
		).toBe("Project not found.");
	});
});
