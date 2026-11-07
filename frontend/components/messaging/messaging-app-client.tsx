"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquare, Search, X } from "lucide-react";
import type {
  ConversationDetail,
  ConversationListItem,
} from "@/lib/messaging/service";
import { ConversationInbox } from "@/components/messaging/conversation-ui";
import { MessageThread } from "@/components/messaging/message-thread-client";
import {
  filterConversations,
  type InboxFilter,
} from "@/components/messaging/conversation-view";
import {
  authenticateSupabaseRealtime,
  createSupabaseBrowserClient,
} from "@/lib/supabase/client";

type MessagingAppProps = {
  conversations: ConversationListItem[];
  currentUserId: string;
  dashboardHref: string;
};

type ConversationResponse = {
  data?: ConversationDetail;
  error?: string;
};

type ConversationsResponse = {
  data?: ConversationListItem[];
  error?: string;
};

type MessageRow = ConversationDetail["messages"][number];

const inboxFilters: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
];

function sortConversations(conversations: ConversationListItem[]) {
  return [...conversations].sort(
    (firstConversation, secondConversation) =>
      new Date(secondConversation.updated_at).getTime() -
      new Date(firstConversation.updated_at).getTime(),
  );
}

export function MessagingApp({
  conversations,
  currentUserId,
  dashboardHref,
}: MessagingAppProps) {
  const searchParams = useSearchParams();
  const [conversationList, setConversationList] = useState(() =>
    sortConversations(conversations),
  );
  const activeConversationId = searchParams.get("conversation") ?? "";
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");

  const selectedConversationId = conversationList.some(
    (item) => item.id === activeConversationId,
  )
    ? activeConversationId
    : "";
  const hasActiveConversation = activeConversationId.length > 0;
  const invalidConversationId = hasActiveConversation && !selectedConversationId;
  const conversationIdKey = useMemo(
    () => conversationList.map((item) => item.id).join(","),
    [conversationList],
  );
  const filteredConversations = useMemo(
    () => filterConversations(conversationList, currentUserId, search, filter),
    [conversationList, currentUserId, search, filter],
  );
  const unreadConversationCount = conversationList.filter(
    (item) => item.unread_count > 0,
  ).length;

  async function refreshConversationList() {
    const response = await fetch("/api/conversations", { cache: "no-store" });
    const payload = (await response.json()) as ConversationsResponse;

    if (!response.ok || !payload.data) {
      return;
    }

    setConversationList(sortConversations(payload.data));
  }

  useEffect(() => {
    let isMounted = true;

    async function loadConversation() {
      if (!selectedConversationId) {
        setConversation(null);
        setError("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/conversations/${selectedConversationId}`);
        const payload = (await response.json()) as ConversationResponse;

        if (!isMounted) {
          return;
        }

        if (!response.ok || !payload.data) {
          setConversation(null);
          setError(payload.error ?? "Conversation could not be loaded.");
          return;
        }

        setConversation(payload.data);
      } catch {
        if (isMounted) {
          setConversation(null);
          setError("Conversation could not be loaded.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadConversation();

    return () => {
      isMounted = false;
    };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const activeConversation = conversationList.find(
      (item) => item.id === selectedConversationId,
    );

    if (!activeConversation || activeConversation.unread_count === 0) {
      return;
    }

    let isMounted = true;

    async function markActiveConversationRead() {
      const response = await fetch(`/api/conversations/${selectedConversationId}`, {
        method: "PATCH",
      });

      if (!isMounted || !response.ok) {
        return;
      }

      setConversationList((currentConversations) =>
        currentConversations.map((item) =>
          item.id === selectedConversationId
            ? {
                ...item,
                unread_count: 0,
              }
            : item,
        ),
      );
    }

    void markActiveConversationRead();

    return () => {
      isMounted = false;
    };
  }, [conversationList, selectedConversationId]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let isMounted = true;

    async function subscribeToInbox() {
      await authenticateSupabaseRealtime(supabase);
      const conversationIds = conversationIdKey.split(",").filter(Boolean);
      const channel = supabase
        .channel(`conversation-list:${currentUserId}`)
        .on("system", {}, (payload) => {
          if (process.env.NODE_ENV === "development") {
            console.warn("Supabase inbox realtime system event", payload);
          }
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            const newMessage = payload.new as MessageRow;

            if (!conversationIds.includes(newMessage.conversation_id)) {
              return;
            }

            setConversationList((currentConversations) =>
              sortConversations(
                currentConversations.map((item) => {
                  if (item.id !== newMessage.conversation_id) {
                    return item;
                  }

                  const isActive = item.id === selectedConversationId;
                  const isIncoming = newMessage.sender_id !== currentUserId;

                  return {
                    ...item,
                    updated_at: newMessage.created_at,
                    last_message: {
                      id: newMessage.id,
                      message_text: newMessage.message_text,
                      sender_id: newMessage.sender_id,
                      created_at: newMessage.created_at,
                      is_read: isActive ? true : newMessage.is_read,
                    },
                    unread_count:
                      isIncoming && !isActive
                        ? item.unread_count + 1
                        : item.unread_count,
                  };
                }),
              ),
            );
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void refreshConversationList();
          }
        });

      return channel;
    }

    const channelPromise = subscribeToInbox();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshConversationList();
      }
    }

    function handleWindowFocus() {
      void refreshConversationList();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      void channelPromise.then((channel) => {
        if (isMounted) {
          return;
        }

        void supabase.removeChannel(channel);
      });
    };
  }, [conversationIdKey, currentUserId, selectedConversationId]);

  function handleSelectConversation(conversationId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("conversation", conversationId);
    window.history.pushState(null, "", url);
  }

  function handleBackToInbox() {
    setConversation(null);

    const url = new URL(window.location.href);
    url.searchParams.delete("conversation");
    window.history.pushState(null, "", url);
  }

  const handleActiveConversationRead = useCallback((conversationId: string) => {
    setConversationList((currentConversations) =>
      currentConversations.map((item) => {
        if (item.id !== conversationId || item.unread_count === 0) {
          return item;
        }

        return {
          ...item,
          unread_count: 0,
        };
      }),
    );
  }, []);

  return (
    <div className="fixed inset-0 z-60 grid h-dvh min-h-0 min-w-0 gap-0 overflow-hidden bg-white lg:static lg:z-auto lg:h-[calc(100dvh-16rem)] lg:min-h-140 lg:gap-3 lg:bg-transparent lg:grid-cols-[minmax(270px,0.85fr)_minmax(0,1.5fr)]">
      <section
        className={`min-h-0 min-w-0 flex-col overflow-hidden bg-white lg:flex lg:rounded-lg lg:border lg:border-line ${
          hasActiveConversation ? "hidden" : "flex"
        }`}
      >
        <div className="border-b border-line px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 sm:px-5 lg:pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link href={dashboardHref} aria-label="Back to dashboard" title="Back to dashboard" className="flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-700 hover:bg-zinc-100 lg:hidden">
                <ArrowLeft aria-hidden="true" className="size-5" />
              </Link>
              <h2 className="text-lg font-semibold text-black">Inbox</h2>
            </div>
            <span className="text-xs text-secondary">{conversationList.length} conversations</span>
          </div>
          <div className="relative mt-4">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-secondary" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="min-h-10 w-full rounded-md border border-line bg-zinc-50 pr-10 pl-9 text-sm text-black outline-none placeholder:text-secondary focus:border-violet-500 focus:bg-white"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                title="Clear search"
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-secondary hover:bg-zinc-200 hover:text-black"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
          </div>
          <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter conversations">
            {inboxFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`min-h-8 shrink-0 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  filter === item.value
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {item.label}{item.value === "unread" && unreadConversationCount > 0 ? ` ${unreadConversationCount}` : ""}
              </button>
            ))}
          </div>
        </div>
        <ConversationInbox
          conversations={filteredConversations}
          currentUserId={currentUserId}
          activeConversationId={selectedConversationId}
          isFiltered={Boolean(search.trim()) || filter !== "all"}
          onSelectConversation={handleSelectConversation}
        />
      </section>

      {!hasActiveConversation ? (
        <section className="hidden min-h-0 flex-col items-center justify-center rounded-lg border border-line bg-white px-8 text-center lg:flex">
          <span className="flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
            <MessageSquare aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-black">Select a conversation</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">
            Choose a project or service discussion from your inbox.
          </p>
        </section>
      ) : invalidConversationId ? (
        <section className="flex min-h-0 flex-col items-start justify-center gap-4 rounded-lg border border-line bg-white p-8">
          <h2 className="text-lg font-semibold text-black">Conversation not found</h2>
          <p className="text-sm text-secondary">This conversation is not available in your inbox.</p>
          <button type="button" onClick={handleBackToInbox} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-black lg:hidden">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to inbox
          </button>
        </section>
      ) : isLoading ? (
        <section className="flex min-h-0 flex-col items-start gap-6 rounded-lg border border-line bg-white p-4 text-sm font-medium text-secondary lg:items-center lg:justify-center lg:p-8" role="status">
          <button type="button" onClick={handleBackToInbox} aria-label="Back to inbox" title="Back to inbox" className="flex size-10 items-center justify-center rounded-md text-zinc-700 lg:hidden"><ArrowLeft aria-hidden="true" className="size-5" /></button>
          <span>Loading conversation...</span>
        </section>
      ) : error ? (
        <section className="flex min-h-0 flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-white p-8 text-sm font-medium text-red-700" role="alert">
          <p>{error}</p>
          <button type="button" onClick={handleBackToInbox} className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-black lg:hidden">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to inbox
          </button>
        </section>
      ) : conversation && conversation.id === selectedConversationId ? (
        <MessageThread
          key={conversation.id}
          conversation={conversation}
          currentUserId={currentUserId}
          onConversationRead={handleActiveConversationRead}
          onBackToInbox={handleBackToInbox}
        />
      ) : null}
    </div>
  );
}
