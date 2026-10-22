import type { ConversationListItem } from "@/lib/messaging/service";
import type { ServiceWorkroomSummary } from "@/lib/service-workrooms/service";
import {
	formatTimeAgo,
	OverviewPanel,
	OverviewRow,
	OverviewRows,
	PanelEmpty,
	StatusChip,
} from "@/components/dashboard/overview/overview-ui";

type Role = "client" | "provider";

export function conversationPartner(conversation: ConversationListItem, userId: string) {
	return conversation.client_id === userId ? conversation.provider : conversation.client;
}

export function WorkroomsPanel({
	workrooms,
	role,
}: {
	workrooms: ServiceWorkroomSummary[];
	role: Role;
}) {
	const listHref = role === "client" ? "/dashboard/client/workrooms" : "/dashboard/provider/workrooms";

	return (
		<OverviewPanel id="workrooms-heading" title="Workrooms" viewAllHref={workrooms.length > 0 ? listHref : undefined}>
			{workrooms.length > 0 ? (
				<OverviewRows>
					{workrooms.map((workroom) => {
						const other = role === "client" ? workroom.provider : workroom.client;

						return (
							<OverviewRow
								key={workroom.id}
								href={`/dashboard/workrooms/${workroom.id}`}
								title={workroom.service?.title ?? "Accepted service"}
								detail={`with ${other?.full_name ?? (role === "client" ? "Provider" : "Client")} · Accepted ${formatTimeAgo(workroom.accepted_at)}`}
								chip={
									workroom.status === "completed" ? (
										<StatusChip label="Completed" tone="neutral" />
									) : (
										<StatusChip label="Active" tone="green" />
									)
								}
							/>
						);
					})}
				</OverviewRows>
			) : role === "provider" ? (
				<PanelEmpty
					text="A workroom opens when you accept a service request. It's where you and the client keep the hire on track."
					link={{ href: "/dashboard/provider/service-requests", label: "Go to Service requests" }}
				/>
			) : (
				<PanelEmpty
					text="A workroom opens when a provider accepts your service request."
					link={{ href: "/find-talent", label: "Find talent" }}
				/>
			)}
		</OverviewPanel>
	);
}

export function MessagesPanel({
	conversations,
	userId,
	role,
}: {
	conversations: ConversationListItem[];
	userId: string;
	role: Role;
}) {
	return (
		<OverviewPanel
			id="messages-heading"
			title="Messages"
			viewAllHref={conversations.length > 0 ? "/dashboard/messages" : undefined}
		>
			{conversations.length > 0 ? (
				<OverviewRows>
					{conversations.map((conversation) => {
						const partner = conversationPartner(conversation, userId);
						const name = partner?.full_name ?? "Marketplace member";

						return (
							<OverviewRow
								key={conversation.id}
								href={`/dashboard/messages?conversation=${conversation.id}`}
								person={{ name, avatarPath: partner?.avatar_url ?? null }}
								title={name}
								aside={formatTimeAgo(conversation.last_message?.created_at ?? conversation.updated_at)}
								detail={conversation.last_message?.message_text ?? "No messages yet."}
							/>
						);
					})}
				</OverviewRows>
			) : (
				<PanelEmpty
					text={
						role === "provider"
							? "Conversations start when you apply to a project or a client sends you a request."
							: "Conversations start when a provider applies to your project or you request a service."
					}
				/>
			)}
		</OverviewPanel>
	);
}
