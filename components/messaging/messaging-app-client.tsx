"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ConversationDetail,
  ConversationListItem,
} from "@/lib/messaging/service";
import { ConversationInbox } from "@/components/messaging/conversation-ui";
import { MessageThread } from "@/components/messaging/message-thread-client";
import {
  authenticateSupabaseRealtime,
  createSupabaseBrowserClient,
} from "@/lib/supabase/client";

type MessagingAppProps = {
  conversations: ConversationListItem[];
  currentUserId: string;
  initialConversationId?: string;
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
  initialConversationId,
}: MessagingAppProps) {
  const [conversationList, setConversationList] = useState(() =>
    sortConversations(conversations),
  );
  const firstConversationId = conversationList[0]?.id;
  const [activeConversationId, setActiveConversationId] = useState(
    initialConversationId ?? "",
  );
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activeConversationExists = useMemo(
    () =>
      conversationList.some((item) => item.id === activeConversationId) ||
      !activeConversationId,
    [activeConversationId, conversationList],
  );
  const selectedConversationId = activeConversationExists
    ? activeConversationId
    : firstConversationId ?? "";
  const hasActiveConversation = selectedConversationId.length > 0;
  const conversationIdKey = useMemo(
    () => conversationList.map((item) => item.id).join(","),
    [conversationList],
  );

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
    setActiveConversationId(conversationId);

    const url = new URL(window.location.href);
    url.searchParams.set("conversation", conversationId);
    window.history.pushState({}, "", url);
  }

  function handleBackToInbox() {
    setActiveConversationId("");
    setConversation(null);

    const url = new URL(window.location.href);
    url.searchParams.delete("conversation");
    window.history.pushState({}, "", url);
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
    <div className="grid h-[calc(100vh-220px)] min-h-170 gap-6 overflow-hidden xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
      <section
        className={`min-h-0 flex-col rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-7 xl:flex ${
          hasActiveConversation ? "hidden" : "flex"
        }`}
      >
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-black">Inbox</h2>
        </div>
        <ConversationInbox
          conversations={conversationList}
          currentUserId={currentUserId}
          activeConversationId={selectedConversationId}
          onSelectConversation={handleSelectConversation}
        />
      </section>

      {isLoading ? (
        <section className="flex min-h-0 items-center justify-center rounded-4xl border border-line bg-white/90 p-8 text-sm font-semibold text-secondary shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
          Loading conversation...
        </section>
      ) : error ? (
        <section className="flex min-h-0 items-center justify-center rounded-4xl border border-red-200 bg-red-50 p-8 text-sm font-semibold text-red-700 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
          {error}
        </section>
      ) : conversation && conversation.id === selectedConversationId ? (
        <MessageThread
          key={conversation.id}
          conversation={conversation}
          currentUserId={currentUserId}
          onConversationRead={handleActiveConversationRead}
          onBackToInbox={handleBackToInbox}
        />
      ) : (
        <section className="hidden rounded-4xl border border-line bg-white/90 p-8 shadow-[0_20px_60px_rgba(17,17,17,0.06)] xl:block">
          <div className="flex min-h-105 flex-col items-start justify-center">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-secondary">
              Select a conversation
            </p>
            <h2 className="mt-3 max-w-lg text-3xl font-semibold text-black">
              Open a thread to continue the project discussion.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-secondary">
              Conversations are connected to applications, so both sides can keep
              project context while discussing the work.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
