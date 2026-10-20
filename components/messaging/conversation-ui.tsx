import { ChevronRight, MessageSquare } from "lucide-react";
import type { ConversationListItem } from "@/lib/messaging/service";
import {
  getConversationStatus,
  getConversationTitle,
  getOtherParty,
  statusToneClasses,
} from "@/components/messaging/conversation-view";

function formatInboxTime(value: string) {
  const date = new Date(value);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type ConversationInboxProps = {
  conversations: ConversationListItem[];
  currentUserId: string;
  activeConversationId?: string;
  isFiltered?: boolean;
  onSelectConversation?: (conversationId: string) => void;
};

export function ConversationInbox({
  conversations,
  currentUserId,
  activeConversationId,
  isFiltered = false,
  onSelectConversation,
}: ConversationInboxProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center px-5 py-8 text-center">
        <MessageSquare aria-hidden="true" className="mb-3 size-6 text-secondary" />
        <p className="text-sm font-semibold text-black">
          {isFiltered ? "No matching conversations" : "No conversations yet"}
        </p>
        <p className="mt-1 max-w-xs text-sm leading-5 text-secondary">
          {isFiltered
            ? "Try another search or filter."
            : "Project and service discussions will appear here."}
        </p>
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain" aria-label="Conversations">
      {conversations.map((conversation) => {
        const name = getOtherParty(conversation, currentUserId)?.full_name ?? "Marketplace member";
        const isActive = conversation.id === activeConversationId;
        const status = getConversationStatus(conversation);

        return (
          <li key={conversation.id}>
            <button
              type="button"
              onClick={() => onSelectConversation?.(conversation.id)}
              aria-current={isActive ? "true" : undefined}
              className={`group flex min-h-22 w-full items-start gap-3 border-l-2 px-3 py-3 text-left transition-colors sm:px-4 ${
                isActive
                  ? "border-l-violet-600 bg-violet-50/70"
                  : "border-l-transparent hover:bg-zinc-50"
              }`}
            >
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-700">
                {initials(name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-black">{name}</span>
                  <time className="shrink-0 text-xs text-secondary" dateTime={conversation.last_message?.created_at ?? conversation.updated_at}>
                    {formatInboxTime(conversation.last_message?.created_at ?? conversation.updated_at)}
                  </time>
                </span>
                <span className="mt-0.5 flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs text-secondary">{getConversationTitle(conversation)}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusToneClasses[status.tone]}`}>
                    {status.label}
                  </span>
                </span>
                <span className="mt-1.5 flex min-w-0 items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-secondary">
                    {conversation.last_message?.message_text ?? "No messages yet"}
                  </span>
                  {conversation.unread_count > 0 ? (
                    <span className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-700 px-1 text-[10px] font-bold text-white" aria-label={`${conversation.unread_count} unread messages`}>
                      {conversation.unread_count}
                    </span>
                  ) : (
                    <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-zinc-400 lg:hidden" />
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
