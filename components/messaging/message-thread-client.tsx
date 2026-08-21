"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { ConversationDetail } from "@/lib/messaging/service";
import {
  getApplicationStatusMeta,
  type ApplicationStatus,
} from "@/lib/projects/application-status";
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

function canSendMessages(status: string | null | undefined) {
  return (
    status === "pending" ||
    status === "viewed" ||
    status === "shortlisted" ||
    status === "accepted"
  );
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
      className={`ml-2 inline-flex items-center font-semibold tracking-[-0.18em] ${
        isRead ? "text-sky-300" : "text-white/60"
      }`}
    >
      {isRead ? "✓✓" : "✓"}
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
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const otherParty =
    conversation.client_id === currentUserId
      ? conversation.provider
      : conversation.client;
  const applicationStatus = conversation.application?.status;
  const composerEnabled = canSendMessages(applicationStatus);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
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
      setError(readOnlyConversationMessage(applicationStatus));
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
    <section className="flex min-h-0 flex-col overflow-hidden rounded-4xl border border-line bg-white/90 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
      <header className="border-b border-line p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {onBackToInbox ? (
              <button
                type="button"
                onClick={onBackToInbox}
                className="mb-4 inline-flex rounded-full border border-line px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-black/3 xl:hidden"
              >
                Back to inbox
              </button>
            ) : null}
            <p className="text-sm font-semibold text-secondary">
              {otherParty?.full_name ?? "Marketplace conversation"}
            </p>
            <h2 className="mt-1 truncate text-2xl font-semibold text-black">
              {conversation.project?.title ?? "Untitled project"}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${applicationStatusClasses(
                  applicationStatus,
                )}`}
              >
                {applicationStatusLabel(applicationStatus)}
              </span>
              {conversation.project ? (
                <Link
                  href={`/oglasi/${conversation.project.id}`}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-black transition hover:bg-black/3"
                >
                  View project
                </Link>
              ) : null}
              {connectionStatus !== "connected" ? (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {connectionStatus === "connecting"
                    ? "Connecting"
                    : "Reconnecting"}
                </span>
              ) : null}
            </div>
          </div>

          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={isMarkingRead}
              onClick={handleMarkRead}
              className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isMarkingRead ? "Marking..." : "Mark as read"}
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={messagesContainerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 sm:p-6"
      >
        {hasOlderMessages ? (
          <div className="flex justify-center">
            <button
              type="button"
              disabled={isLoadingOlderMessages}
              onClick={handleLoadOlderMessages}
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className={`max-w-[min(72ch,85%)] rounded-3xl px-5 py-4 ${
                    isMine
                      ? "bg-zinc-500 text-white shadow-[0_14px_30px_rgba(17,17,17,0.12)]"
                      : "border border-line bg-white text-black shadow-[0_10px_24px_rgba(17,17,17,0.04)]"
                  }`}
                >
                  <p className="whitespace-pre-wrap wrap-break-word text-sm leading-6">
                    {message.message_text}
                  </p>
                  <p
                    className={`mt-3 flex items-center text-xs ${
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
          <div className="rounded-3xl border border-dashed border-line p-8 text-sm leading-6 text-secondary">
            {composerEnabled
              ? "No messages yet. Send the first message to discuss scope, budget, timing, or project details."
              : "No messages were sent before this application was closed."}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-line p-5 sm:p-6">
        {error ? (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {composerEnabled ? (
          <form ref={formRef} onSubmit={handleSend} className="space-y-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              rows={3}
              required
              maxLength={4000}
              placeholder="Write a message..."
              disabled={isSending}
              className="max-h-40 min-h-24 w-full resize-none rounded-3xl border border-line bg-white px-5 py-4 text-sm leading-6 text-black outline-none transition placeholder:text-secondary focus:border-black disabled:cursor-not-allowed disabled:opacity-70"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-secondary">
                Enter sends. Shift+Enter adds a new line.
              </p>
              <button
                type="submit"
                disabled={isSending || draft.trim().length === 0}
                className="rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send message"}
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm leading-6 text-red-700">
            <p className="font-semibold text-red-800">Conversation is read-only</p>
            <p className="mt-1">{readOnlyConversationMessage(applicationStatus)}</p>
          </div>
        )}
      </footer>
    </section>
  );
}
