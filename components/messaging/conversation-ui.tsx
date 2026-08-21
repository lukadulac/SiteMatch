import type {
  ConversationDetail,
  ConversationListItem,
} from "@/lib/messaging/service";
import {
  getApplicationStatusMeta,
  type ApplicationStatus,
} from "@/lib/projects/application-status";

function formatTimeLabel(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).formatToParts(new Date(value));
  const partMap = new Map(parts.map((part) => [part.type, part.value]));

  return `${partMap.get("month")} ${partMap.get("day")}, ${partMap.get(
    "hour",
  )}:${partMap.get("minute")} ${partMap.get("dayPeriod")}`;
}

function applicationStatusClasses(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "bg-blue-50 text-blue-700";
    case "viewed":
      return "bg-zinc-100 text-zinc-700";
    case "shortlisted":
      return "bg-amber-50 text-amber-700";
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
    case "withdrawn":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function applicationStatusLabel(status: ApplicationStatus | null | undefined) {
  return status ? getApplicationStatusMeta(status).label : "Application";
}

function getOtherParty(
  conversation: ConversationListItem | ConversationDetail,
  currentUserId: string,
) {
  return conversation.client_id === currentUserId
    ? conversation.provider
    : conversation.client;
}

type ConversationInboxProps = {
  conversations: ConversationListItem[];
  currentUserId: string;
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
};

export function ConversationInbox({
  conversations,
  currentUserId,
  activeConversationId,
  onSelectConversation,
}: ConversationInboxProps) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-line p-8 text-sm leading-6 text-secondary">
        No conversations yet. Start from a provider application and choose
        Message to open a discussion.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
      {conversations.map((conversation) => {
        const otherParty = getOtherParty(conversation, currentUserId);
        const isActive = conversation.id === activeConversationId;

        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelectConversation?.(conversation.id)}
            className={`block w-full rounded-3xl border p-4 text-left transition ${
              isActive
                ? "border-black bg-black text-white"
                : "border-line bg-white hover:border-black/30 hover:bg-black/3"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p
                  className={`truncate text-sm font-semibold ${
                    isActive ? "text-white" : "text-black"
                  }`}
                >
                  {otherParty?.full_name ?? "Marketplace conversation"}
                </p>
                <p
                  className={`mt-1 truncate text-sm ${
                    isActive ? "text-white/70" : "text-secondary"
                  }`}
                >
                  {conversation.project?.title ?? "Untitled project"}
                </p>
              </div>
              {conversation.unread_count > 0 ? (
                <span className="inline-flex min-w-7 shrink-0 items-center justify-center rounded-full bg-accent px-2 py-1 text-xs font-semibold text-accent-ink">
                  {conversation.unread_count}
                </span>
              ) : null}
            </div>

            <p
              className={`mt-4 line-clamp-2 text-sm leading-6 ${
                isActive ? "text-white/70" : "text-secondary"
              }`}
            >
              {conversation.last_message?.message_text ?? "No messages yet."}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isActive
                    ? "bg-white/15 text-white"
                    : applicationStatusClasses(conversation.application?.status)
                }`}
              >
                {applicationStatusLabel(conversation.application?.status)}
              </span>
              <span
                className={`shrink-0 text-xs ${
                  isActive ? "text-white/60" : "text-secondary"
                }`}
              >
                {formatTimeLabel(
                  conversation.last_message?.created_at ?? conversation.updated_at,
                )}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
