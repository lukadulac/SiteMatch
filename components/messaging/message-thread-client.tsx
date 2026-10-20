"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowLeft, Check, CheckCheck, ExternalLink, Send } from "lucide-react";
import type { ConversationDetail } from "@/lib/messaging/service";
import {
  canComposeConversation,
  getConversationStatus,
  getConversationTitle,
  getOtherParty,
  statusToneClasses,
} from "@/components/messaging/conversation-view";
import {
  authenticateSupabaseRealtime,
  createSupabaseBrowserClient,
} from "@/lib/supabase/client";

type MessageRow = ConversationDetail["messages"][number];

type MessageThreadProps = {
  conversation: ConversationDetail;
  currentUserId: string;
  messageError?: string;
  onConversationRead?: (conversationId: string) => void;
  onBackToInbox?: () => void;
};

type MessageResponse = {
  data?: MessageRow;
  error?: string;
};

type ConversationResponse = {
  data?: ConversationDetail;
  error?: string;
};

function sortMessagesByCreatedAt(messages: MessageRow[]) {
  return [...messages].sort(
    (firstMessage, secondMessage) =>
      new Date(firstMessage.created_at).getTime() -
      new Date(secondMessage.created_at).getTime(),
  );
}

function mergeMessages(currentMessages: MessageRow[], incomingMessages: MessageRow[]) {
  const messageMap = new Map<string, MessageRow>();

  for (const message of currentMessages) {
    messageMap.set(message.id, message);
  }

  for (const message of incomingMessages) {
    messageMap.set(message.id, message);
  }

  return sortMessagesByCreatedAt(Array.from(messageMap.values()));
}

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

function readOnlyConversationMessage(status: string | null | undefined) {
  if (status === "rejected") {
    return "This application was rejected. Conversation history remains visible, but new messages are disabled.";
  }

  if (status === "withdrawn") {
    return "This application was withdrawn. Conversation history remains visible, but new messages are disabled.";
  }

  return "This application is closed. Conversation history remains visible, but new messages are disabled.";
}

function getReadOnlyMessage(conversation: ConversationDetail) {
  if (conversation.source_deleted_at) {
    return "This listing was removed. Conversation history remains visible, but new messages are disabled.";
  }

  if (conversation.service_request) {
    return "";
  }

  if (conversation.application) {
    return readOnlyConversationMessage(conversation.application.status);
  }

  return "This conversation is read-only. Conversation history remains visible, but new messages are disabled.";
}

function MessageStatusTicks({
  isMine,
  isRead,
}: {
  isMine: boolean;
  isRead: boolean;
}) {
  if (!isMine) {
    return null;
  }

  return (
    <span
      aria-label={isRead ? "Seen" : "Sent"}
      title={isRead ? "Seen" : "Sent"}
      className={`ml-1 inline-flex items-center ${isRead ? "text-emerald-200" : "text-white/70"}`}
    >
      {isRead ? <CheckCheck size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
    </span>
  );
}

export function MessageThread({
  conversation,
  currentUserId,
  messageError,
  onConversationRead,
  onBackToInbox,
}: MessageThreadProps) {
  const [messages, setMessages] = useState(conversation.messages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(messageError ?? "");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(conversation.unread_count);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(
    conversation.has_older_messages,
  );
  const [oldestMessageCursor, setOldestMessageCursor] = useState(
    conversation.oldest_message_cursor,
  );
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "reconnecting"
  >("connecting");
  const formRef = useRef<HTMLFormElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const otherParty = getOtherParty(conversation, currentUserId);
  const composerEnabled = canComposeConversation(conversation);
  const conversationStatus = getConversationStatus(conversation);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let isMounted = true;

    async function refetchConversation() {
      try {
        const response = await fetch(`/api/conversations/${conversation.id}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ConversationResponse;

        if (!isMounted || !response.ok || !payload.data) {
          return;
        }

        setMessages((currentMessages) =>
          mergeMessages(currentMessages, payload.data?.messages ?? []),
        );
        setUnreadCount(payload.data.unread_count);

        if (payload.data.unread_count === 0) {
          onConversationRead?.(conversation.id);
        }
      } catch {
        if (isMounted) {
          setError("Conversation could not be refreshed.");
        }
      }
    }

    async function subscribeToConversation() {
      setConnectionStatus("connecting");
      await authenticateSupabaseRealtime(supabase);

      const channel = supabase
        .channel(`conversation:${conversation.id}`)
        .on("system", {}, (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("Supabase conversation realtime system event", payload);
          }
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversation.id}`,
          },
          (payload) => {
            const newMessage = payload.new as MessageRow;

            setMessages((currentMessages) =>
              mergeMessages(currentMessages, [newMessage]),
            );

            if (newMessage.sender_id !== currentUserId) {
              setUnreadCount((currentCount) => currentCount + 1);
            }
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void refetchConversation();
          }

          if (status === "SUBSCRIBED") {
            setConnectionStatus("connected");
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnectionStatus("reconnecting");
          }

          if (status === "CLOSED") {
            setConnectionStatus("reconnecting");
          }
        });

      return channel;
    }

    const channelPromise = subscribeToConversation();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refetchConversation();
      }
    }

    function handleWindowFocus() {
      void refetchConversation();
    }

    function handleOnline() {
      void refetchConversation();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleOnline);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleOnline);
      void channelPromise.then((channel) => supabase.removeChannel(channel));
    };
  }, [conversation.id, currentUserId, onConversationRead]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!composerEnabled) {
      setError(getReadOnlyMessage(conversation));
      return;
    }

    const messageText = draft.trim().replace(/\s+/g, " ");

    if (!messageText) {
      setError("Message cannot be empty.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message_text: messageText }),
        },
      );
      const payload = (await response.json()) as MessageResponse;

      if (!response.ok || !payload.data) {
        setError(payload.error ?? "Message could not be sent.");
        return;
      }

      const newMessage = payload.data;

      setMessages((currentMessages) =>
        currentMessages.some((message) => message.id === newMessage.id)
          ? currentMessages
          : [...currentMessages, newMessage],
      );
      setDraft("");
    } catch {
      setError("Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  async function handleLoadOlderMessages() {
    if (!oldestMessageCursor || isLoadingOlderMessages) {
      return;
    }

    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight ?? 0;
    const previousScrollTop = container?.scrollTop ?? 0;

    setIsLoadingOlderMessages(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: "50",
        before: oldestMessageCursor,
      });
      const response = await fetch(
        `/api/conversations/${conversation.id}?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as ConversationResponse;

      if (!response.ok || !payload.data) {
        setError(payload.error ?? "Older messages could not be loaded.");
        return;
      }

      setMessages((currentMessages) =>
        mergeMessages(payload.data?.messages ?? [], currentMessages),
      );
      setHasOlderMessages(payload.data.has_older_messages);
      setOldestMessageCursor(payload.data.oldest_message_cursor);

      window.requestAnimationFrame(() => {
        if (!container) {
          return;
        }

        container.scrollTop =
          container.scrollHeight - previousScrollHeight + previousScrollTop;
      });
    } catch {
      setError("Older messages could not be loaded.");
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }

  async function handleMarkRead() {
    setIsMarkingRead(true);
    setError("");

    try {
      const response = await fetch(`/api/conversations/${conversation.id}`, {
        method: "PATCH",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Conversation could not be marked as read.");
        return;
      }

      setUnreadCount(0);
      onConversationRead?.(conversation.id);
      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.sender_id === currentUserId
            ? message
            : {
                ...message,
                is_read: true,
              },
        ),
      );
    } catch {
      setError("Conversation could not be marked as read.");
    } finally {
      setIsMarkingRead(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white lg:rounded-lg lg:border lg:border-line">
      <header className="shrink-0 border-b border-line px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-5 lg:pt-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBackToInbox ? (
            <button type="button" onClick={onBackToInbox} aria-label="Back to inbox" title="Back to inbox" className="flex size-10 shrink-0 items-center justify-center rounded-md text-zinc-700 transition hover:bg-zinc-100 lg:hidden">
              <ArrowLeft size={19} aria-hidden="true" />
            </button>
          ) : null}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800" aria-hidden="true">
            {(otherParty?.full_name ?? "M").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-zinc-950 sm:text-base">{otherParty?.full_name ?? "Marketplace conversation"}</h2>
            <p className="truncate text-xs text-secondary">{getConversationTitle(conversation)}</p>
          </div>
          {unreadCount > 0 ? (
            <button type="button" disabled={isMarkingRead} onClick={handleMarkRead} className="shrink-0 rounded-md px-2 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50" title="Mark conversation as read">
              {isMarkingRead ? "Marking..." : "Mark as read"}
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 pl-0 lg:pl-13">
          <span className={`rounded px-2 py-1 text-xs font-semibold ${statusToneClasses[conversationStatus.tone]}`}>{conversationStatus.label}</span>
          {conversation.project ? (
            <Link href={`/oglasi/${conversation.project.id}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100">View project <ExternalLink size={12} aria-hidden="true" /></Link>
          ) : null}
          {conversation.service_request?.service ? (
            <Link href={`/find-talent/${conversation.service_request.service.id}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100">View service <ExternalLink size={12} aria-hidden="true" /></Link>
          ) : null}
          {connectionStatus !== "connected" ? (
            <span className="text-xs text-amber-700" role="status">{connectionStatus === "connecting" ? "Connecting" : "Reconnecting"}</span>
          ) : null}
        </div>
      </header>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-zinc-50/60 p-4 sm:p-5"
      >
        {hasOlderMessages ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={isLoadingOlderMessages}
              onClick={handleLoadOlderMessages}
              className="rounded-md border border-line bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingOlderMessages ? "Loading..." : "Load older messages"}
            </button>
          </div>
        ) : null}

        {messages.length > 0 ? (
          messages.map((message) => {
            const isMine = message.sender_id === currentUserId;

            return (
              <article
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[min(72ch,85%)] rounded-md px-3 py-2.5 sm:px-4 ${
                    isMine
                      ? "bg-[#6447b5] text-white"
                      : "border border-line bg-white text-zinc-950"
                  }`}
                >
                  <p className="whitespace-pre-wrap wrap-break-word text-sm leading-5">
                    {message.message_text}
                  </p>
                  <p
                    className={`mt-1.5 flex items-center text-[11px] ${
                      isMine ? "text-white/60" : "text-secondary"
                    }`}
                  >
                    <span>{formatTimeLabel(message.created_at)}</span>
                    <MessageStatusTicks isMine={isMine} isRead={message.is_read} />
                  </p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="mx-auto max-w-sm py-12 text-center text-sm leading-6 text-secondary">
            {composerEnabled
              ? "No messages yet. Send the first message to discuss scope, budget, timing, or project details."
              : "No messages were sent before this conversation became read-only."}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-line bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4 lg:pb-4">
        {error ? (
          <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {composerEnabled ? (
          <form ref={formRef} onSubmit={handleSend} className="flex items-end gap-2">
            <label htmlFor="conversation-message" className="sr-only">Message</label>
            <textarea id="conversation-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} rows={2} required maxLength={4000} placeholder="Write a message..." disabled={isSending} className="max-h-40 min-h-12 flex-1 resize-none rounded-md border border-line bg-white px-3 py-2.5 text-sm leading-5 text-black outline-none transition placeholder:text-secondary focus:border-[#6447b5] disabled:opacity-70" />
            <button type="submit" disabled={isSending || draft.trim().length === 0} aria-label={isSending ? "Sending message" : "Send message"} title="Send message" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#6447b5] text-white transition hover:bg-[#50369c] disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        ) : (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-5 text-zinc-600">
            <p className="font-semibold text-zinc-800">Conversation is read-only</p>
            <p className="mt-1">{getReadOnlyMessage(conversation)}</p>
          </div>
        )}
      </footer>
    </section>
  );
}
