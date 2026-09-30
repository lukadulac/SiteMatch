import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
	ServiceRequestCard,
	ServiceRequestNotice,
	ServiceRequestPagination,
	ServiceRequestStatusFilters,
} from "@/components/service-requests/service-request-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import {
	getClientServiceRequestsPage,
} from "@/lib/provider-service-requests/service";
import {
	parseServiceRequestListQuery,
	type RawServiceRequestListQuery,
} from "@/lib/provider-service-requests/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientServiceRequestsPageProps = {
	searchParams?: Promise<
		RawServiceRequestListQuery & {
			serviceError?: string | string[];
			serviceStatus?: string | string[];
		}
	>;
};

function buildCanonicalListPath(status: string, page: number) {
	const params = new URLSearchParams();

	if (status !== "all") {
		params.set("status", status);
	}

	if (page > 1) {
		params.set("page", String(page));
	}

	const query = params.toString();

	return query
		? `/dashboard/client/service-requests?${query}`
		: "/dashboard/client/service-requests";
}

export default async function ClientServiceRequestsPage({
	searchParams,
}: ClientServiceRequestsPageProps) {
	const params = await searchParams;
	const serviceError =
		typeof params?.serviceError === "string" ? params.serviceError : null;
	const serviceStatus =
		typeof params?.serviceStatus === "string" ? params.serviceStatus : null;
	const listQuery = parseServiceRequestListQuery(params);
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const provisioned = await ensureUserProfile(supabase, user);

	if (!provisioned.role) {
		await supabase.auth.signOut();
		redirect("/login");
	}

	if (provisioned.role !== "client") {
		redirect(getDashboardPath(provisioned.role));
	}

	const [conversationsResult, serviceRequestsResult] = await Promise.all([
		getUserConversations(supabase, user.id),
		getClientServiceRequestsPage(supabase, user.id, listQuery),
	]);

	if (conversationsResult.error) {
		throw new Error(conversationsResult.error);
	}

	if (serviceRequestsResult.error) {
		throw new Error(serviceRequestsResult.error);
	}

	const pageData = serviceRequestsResult.data;
	if (!pageData) {
		throw new Error("Service requests could not be loaded.");
	}
	const canonicalPage =
		pageData.totalCount === 0
			? 1
			: Math.min(listQuery.page, pageData.totalPages);

	if (listQuery.wasNormalized || listQuery.page !== canonicalPage) {
		redirect(buildCanonicalListPath(listQuery.status, canonicalPage));
	}

	const unreadConversations =
		conversationsResult.data?.filter((conversation) => conversation.unread_count > 0) ??
		[];

	return (
		<DashboardShell
			title="Service Requests"
			subtitle="Track provider service requests you sent and continue discussions from one place."
			actionHref="/find-talent"
			actionLabel="Find Talent"
			navItems={[
				{ href: "/dashboard/client", label: "Overview" },
				{ href: "/dashboard/client/projects", label: "Projects" },
				{
					href: "/dashboard/client/service-requests",
					label: "Service Requests",
					count: pageData.totalCount,
					active: true,
				},
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadConversations.length,
				},
				{ href: "/dashboard/client/profile", label: "Profile" },
			]}
		>
			<section className="space-y-5">
				<ServiceRequestNotice status={serviceStatus} error={serviceError} />
				<div className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-white/90 p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)] lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 className="text-xl font-semibold text-black">Sent requests</h2>
						<p className="mt-1 text-sm text-secondary">
							{pageData.totalCount} request
							{pageData.totalCount === 1 ? "" : "s"} found
						</p>
					</div>
					<ServiceRequestStatusFilters
						basePath="/dashboard/client/service-requests"
						activeStatus={listQuery.status}
					/>
				</div>

				{pageData.requests.length > 0 ? (
					<div className="space-y-4">
						{pageData.requests.map((request) => (
							<ServiceRequestCard
								key={request.id}
								request={request}
								viewerRole="client"
								context="client-list"
								status={listQuery.status}
								page={pageData.page}
							/>
						))}
					</div>
				) : (
					<div className="rounded-3xl border border-dashed border-line-strong bg-panel-soft p-8 text-center">
						<h2 className="text-2xl font-semibold text-black">
							No service requests found
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
							{listQuery.status === "all"
								? "Browse Find Talent to request a provider service."
								: "There are no requests in this status yet."}
						</p>
					</div>
				)}

				<ServiceRequestPagination
					basePath="/dashboard/client/service-requests"
					status={listQuery.status}
					page={pageData.page}
					totalPages={pageData.totalPages}
				/>
			</section>
		</DashboardShell>
	);
}
