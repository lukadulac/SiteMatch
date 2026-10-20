import type {
  ConversationDetail,
  ConversationListItem,
} from "@/lib/messaging/service";
import { getApplicationStatusMeta } from "@/lib/projects/application-status";

type Conversation = ConversationListItem | ConversationDetail;

export type InboxFilter = "all" | "unread" | "pending" | "accepted" | "closed";
export type ConversationTone = "neutral" | "pending" | "accepted" | "closed";

export const statusToneClasses: Record<ConversationTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  pending: "bg-sky-50 text-sky-800",
  accepted: "bg-emerald-50 text-emerald-800",
  closed: "bg-rose-50 text-rose-800",
};

export function getConversationTitle(conversation: Conversation) {
  return (
    conversation.project?.title ??
    conversation.service_request?.service?.title ??
    conversation.source_title ??
    "Marketplace conversation"
  );
}

export function getOtherParty(conversation: Conversation, currentUserId: string) {
  return conversation.client_id === currentUserId
    ? conversation.provider
    : conversation.client;
}

export function getConversationStatus(conversation: Conversation): {
  label: string;
  tone: ConversationTone;
} {
  if (conversation.source_deleted_at) {
    return { label: "Listing removed", tone: "closed" };
  }

  if (conversation.service_request) {
    switch (conversation.service_request.status) {
      case "accepted":
        return { label: "Accepted", tone: "accepted" };
      case "rejected":
        return { label: "Rejected", tone: "closed" };
      case "cancelled":
        return { label: "Cancelled", tone: "closed" };
      default:
        return { label: "Pending", tone: "pending" };
    }
  }

  if (conversation.application) {
    const status = conversation.application.status;
    const tone = status === "accepted"
      ? "accepted"
      : status === "rejected" || status === "withdrawn"
        ? "closed"
        : "pending";

    return { label: getApplicationStatusMeta(status).label, tone };
  }

  return { label: "Project chat", tone: "closed" };
}

export function canComposeConversation(conversation: Conversation) {
  if (conversation.source_deleted_at) {
    return false;
  }

  if (conversation.service_request) {
    return true;
  }

  const status = conversation.application?.status;
  return status === "pending" || status === "viewed" ||
    status === "shortlisted" || status === "accepted";
}

export function filterConversations(
  conversations: ConversationListItem[],
  currentUserId: string,
  search: string,
  filter: InboxFilter,
) {
  const query = search.trim().toLocaleLowerCase();

  return conversations.filter((conversation) => {
    if (filter === "unread" && conversation.unread_count === 0) {
      return false;
    }
    if (filter !== "all" && filter !== "unread" && getConversationStatus(conversation).tone !== filter) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      getOtherParty(conversation, currentUserId)?.full_name,
      getConversationTitle(conversation),
      conversation.last_message?.message_text,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });
}
