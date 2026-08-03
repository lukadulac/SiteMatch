import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendMessageInput } from "@/lib/messaging/schemas";
import type { Database } from "@/types/supabase";

type Result<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

export type ConversationListItem =
  Database["public"]["Tables"]["conversations"]["Row"] & {
  project: Pick<
    Database["public"]["Tables"]["projects"]["Row"],
    "id" | "title" | "slug" | "status"
  > | null;
  application: Pick<
    Database["public"]["Tables"]["applications"]["Row"],
    "id" | "status" | "proposed_price" | "estimated_delivery_days"
  > | null;
  client: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "full_name" | "email" | "phone" | "country" | "city"
  > | null;
  provider: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "id" | "full_name" | "email" | "phone" | "country" | "city"
  > | null;
  last_message: Pick<
    Database["public"]["Tables"]["messages"]["Row"],
    "id" | "message_text" | "sender_id" | "created_at" | "is_read"
  > | null;
  unread_count: number;
};

export type ConversationDetail = ConversationListItem & {
  messages: Array<Database["public"]["Tables"]["messages"]["Row"]>;
  has_older_messages: boolean;
  oldest_message_cursor: string | null;
};

type GetConversationMessagesOptions = {
  limit?: number;
  before?: string | null;
};

async function getConversationByApplicationId(
  supabase: SupabaseClient<Database>,
  applicationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    return { error: error.message };
  }

  return { data: data?.[0] ?? null };
}

function canSendMessagesForApplication(
  status: Database["public"]["Enums"]["application_status"] | null | undefined,
) {
  return (
    status === "pending" ||
    status === "viewed" ||
    status === "shortlisted" ||
    status === "accepted"
  );
}

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function ensureConversationForApplication(
  supabase: SupabaseClient<Database>,
  userId: string,
  applicationId: string,
) {
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select(
      "id, project_id, provider_id, status, project:projects!applications_project_id_fkey(client_id)",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return { error: applicationError.message };
  }

  if (!application) {
    return { error: "Application not found." };
  }

  const project = firstOrNull(application.project);

  if (!project) {
    return { error: "Project not found." };
  }

  const isProjectClient = project.client_id === userId;
  const isApplicationProvider = application.provider_id === userId;

  if (!isProjectClient && !isApplicationProvider) {
    return { error: "Application not found." };
  }

  const existingConversationResult = await getConversationByApplicationId(
    supabase,
    applicationId,
  );

  if (existingConversationResult.error) {
    return { error: existingConversationResult.error };
  }

  if (existingConversationResult.data) {
    return { data: existingConversationResult.data };
  }

  if (!isProjectClient) {
    return { error: "Conversation not found." };
  }

  if (!canSendMessagesForApplication(application.status)) {
    return { error: "This application is no longer open for messaging." };
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      application_id: application.id,
      project_id: application.project_id,
      client_id: project.client_id,
      provider_id: application.provider_id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicateConversationResult = await getConversationByApplicationId(
        supabase,
        applicationId,
      );

      if (duplicateConversationResult.error) {
        return { error: duplicateConversationResult.error };
      }

      if (duplicateConversationResult.data) {
        return { data: duplicateConversationResult.data };
      }
    }

    return { error: error.message };
  }

  return { data };
}

export async function getUserConversations(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<ConversationListItem[]>> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, application_id, client_id, provider_id, project_id, created_at, updated_at, project:projects!conversations_project_id_fkey(id, title, slug, status), application:applications!conversations_application_id_fkey(id, status, proposed_price, estimated_delivery_days), client:profiles!conversations_client_id_fkey(id, full_name, email, phone, country, city), provider:profiles!conversations_provider_id_fkey(id, full_name, email, phone, country, city)",
    )
    .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const conversationIds = (data ?? []).map((item) => item.id);

  const lastMessageMap = new Map<
    string,
    Pick<
      Database["public"]["Tables"]["messages"]["Row"],
      "id" | "message_text" | "sender_id" | "created_at" | "is_read"
    >
  >();
  const unreadCountMap = new Map<string, number>();

  if (conversationIds.length > 0) {
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id, conversation_id, message_text, sender_id, created_at, is_read")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      return { error: messagesError.message };
    }

    for (const message of messages ?? []) {
      if (!lastMessageMap.has(message.conversation_id)) {
        lastMessageMap.set(message.conversation_id, {
          id: message.id,
          message_text: message.message_text,
          sender_id: message.sender_id,
          created_at: message.created_at,
          is_read: message.is_read,
        });
      }

      if (!message.is_read && message.sender_id !== userId) {
        unreadCountMap.set(
          message.conversation_id,
          (unreadCountMap.get(message.conversation_id) ?? 0) + 1,
        );
      }
    }
  }

  return {
    data: (data ?? []).map((item) => ({
      ...item,
      project: firstOrNull(item.project),
      application: firstOrNull(item.application),
      client: firstOrNull(item.client),
      provider: firstOrNull(item.provider),
      last_message: lastMessageMap.get(item.id) ?? null,
      unread_count: unreadCountMap.get(item.id) ?? 0,
    })),
  };
}

export async function getConversationById(
  supabase: SupabaseClient<Database>,
  userId: string,
  conversationId: string,
  options: GetConversationMessagesOptions = {},
): Promise<Result<ConversationDetail>> {
  const messageLimit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, application_id, client_id, provider_id, project_id, created_at, updated_at, project:projects!conversations_project_id_fkey(id, title, slug, status), application:applications!conversations_application_id_fkey(id, status, proposed_price, estimated_delivery_days), client:profiles!conversations_client_id_fkey(id, full_name, email, phone, country, city), provider:profiles!conversations_provider_id_fkey(id, full_name, email, phone, country, city)",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (!data || (data.client_id !== userId && data.provider_id !== userId)) {
    return { error: "Conversation not found." };
  }

  let messagesQuery = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(messageLimit + 1);

  if (options.before) {
    messagesQuery = messagesQuery.lt("created_at", options.before);
  }

  const { data: messages, error: messagesError } = await messagesQuery;

  if (messagesError) {
    return { error: messagesError.message };
  }

  const newestFirstMessages = messages ?? [];
  const hasOlderMessages = newestFirstMessages.length > messageLimit;
  const conversationMessages = newestFirstMessages
    .slice(0, messageLimit)
    .reverse();

  const { data: latestMessages, error: latestMessageError } = await supabase
    .from("messages")
    .select("id, message_text, sender_id, created_at, is_read")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (latestMessageError) {
    return { error: latestMessageError.message };
  }

  const { count: unreadCount, error: unreadCountError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);

  if (unreadCountError) {
    return { error: unreadCountError.message };
  }

  const lastMessage =
    latestMessages && latestMessages.length > 0
      ? latestMessages[0]
      : null;
  const oldestMessage =
    conversationMessages.length > 0 ? conversationMessages[0] : null;

  return {
    data: {
      ...data,
      project: firstOrNull(data.project),
      application: firstOrNull(data.application),
      client: firstOrNull(data.client),
      provider: firstOrNull(data.provider),
      last_message: lastMessage
        ? {
            id: lastMessage.id,
            message_text: lastMessage.message_text,
            sender_id: lastMessage.sender_id,
            created_at: lastMessage.created_at,
            is_read: lastMessage.is_read,
        }
        : null,
      unread_count: unreadCount ?? 0,
      messages: conversationMessages,
      has_older_messages: hasOlderMessages,
      oldest_message_cursor: oldestMessage?.created_at ?? null,
    },
  };
}

export async function sendConversationMessage(
  supabase: SupabaseClient<Database>,
  userId: string,
  conversationId: string,
  input: SendMessageInput,
): Promise<Result<Database["public"]["Tables"]["messages"]["Row"]>> {
  const conversationResult = await getConversationById(
    supabase,
    userId,
    conversationId,
  );

  if (conversationResult.error) {
    return { error: conversationResult.error };
  }

  if (!conversationResult.data) {
    return { error: "Conversation not found." };
  }

  if (!canSendMessagesForApplication(conversationResult.data.application?.status)) {
    return { error: "This application is no longer open for messaging." };
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_text: input.message_text,
    })
    .select("*")
    .single();

  if (error) {
    return { error: error.message };
  }

  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (conversationUpdateError) {
    return { error: conversationUpdateError.message };
  }

  return { data };
}

export async function markConversationAsRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  conversationId: string,
): Promise<Result<{ conversation_id: string; updated_count: number }>> {
  const conversationResult = await getConversationById(
    supabase,
    userId,
    conversationId,
  );

  if (conversationResult.error) {
    return { error: conversationResult.error };
  }

  const { data, error } = await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false)
    .select("id");

  if (error) {
    return { error: error.message };
  }

  return {
    data: {
      conversation_id: conversationId,
      updated_count: (data ?? []).length,
    },
  };
}
