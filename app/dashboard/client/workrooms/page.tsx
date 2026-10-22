import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
	WorkroomCard,
	WorkroomEmptyState,
	WorkroomNotice,
	WorkroomPagination,
	WorkroomStatusFilters,
} from "@/components/workrooms/workroom-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import {
	getClientWorkroomsPage,
	getWorkroomStatusCounts,
} from "@/lib/service-workrooms/service";
import {
	parseWorkroomListQuery,
	type RawWorkroomListQuery,
} from "@/lib/service-workrooms/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientWorkroomsPageProps = {
	searchParams?: Promise<
		RawWorkroomListQuery & {
			workroomError?: string | string[];
			workroomStatus?: string | string[];
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
		? `/dashboard/client/workrooms?${query}`
		: "/dashboard/client/workrooms";
}

export default async function ClientWorkroomsPage({
	searchParams,
}: ClientWorkroomsPageProps) {
	const params = await searchParams;
	const workroomError =
		typeof params?.workroomError === "string" ? params.workroomError : null;
	const workroomStatus =
		typeof params?.workroomStatus === "string" ? params.workroomStatus : null;
	const listQuery = parseWorkroomListQuery(params);
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

	const [conversationsResult, workroomsResult, countsResult] = await Promise.all([
		getUserConversations(supabase, user.id),
		getClientWorkroomsPage(supabase, user.id, listQuery),
		getWorkroomStatusCounts(supabase, user.id, "client"),
	]);

	if (conversationsResult.error) {
		throw new Error(conversationsResult.error);
	}

	if (workroomsResult.error) {
		throw new Error(workroomsResult.error);
	}

	if (countsResult.error || !countsResult.data) {
		throw new Error(countsResult.error ?? "Workroom counts could not be loaded.");
	}

	const counts = countsResult.data;

	const pageData = workroomsResult.data;
	if (!pageData) {
		throw new Error("Workrooms could not be loaded.");
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
			title="Workrooms"
			subtitle="One shared space per hire, from acceptance until the work is completed."
			navItems={[
				{ href: "/dashboard/client", label: "Overview" },
				{ href: "/dashboard/client/projects", label: "Projects" },
				{ href: "/dashboard/client/service-requests", label: "Service Requests" },
				{
					href: "/dashboard/client/workrooms",
					label: "Workrooms",
					count: counts.all,
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
			<section className="space-y-4 sm:space-y-5">
				<WorkroomNotice status={workroomStatus} error={workroomError} />
				<WorkroomStatusFilters
					basePath="/dashboard/client/workrooms"
					activeStatus={listQuery.status}
					counts={counts}
				/>

				{pageData.workrooms.length > 0 ? (
					<ul className="space-y-3">
						{pageData.workrooms.map((workroom) => (
							<li key={workroom.id}>
								<WorkroomCard workroom={workroom} viewerRole="client" />
							</li>
						))}
					</ul>
				) : (
					<WorkroomEmptyState
						status={listQuery.status}
						serviceRequestsHref="/dashboard/client/service-requests"
					/>
				)}

				<WorkroomPagination
					basePath="/dashboard/client/workrooms"
					status={listQuery.status}
					page={pageData.page}
					totalPages={pageData.totalPages}
				/>
			</section>
		</DashboardShell>
	);
}
