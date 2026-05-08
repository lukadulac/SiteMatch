import type { SupabaseClient } from "@supabase/supabase-js";
import type { SendMessageInput } from "@/lib/messaging/schemas";
import type { Database } from "@/types/supabase";

type Result<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

type ConversationListItem = Database["public"]["Tables"]["conversations"]["Row"] & {
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

type ConversationDetail = ConversationListItem & {
  messages: Array<Database["public"]["Tables"]["messages"]["Row"]>;
};

function firstOrNull<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function ensureConversationForAcceptedApplication(
  supabase: SupabaseClient<Database>,
  applicationId: string,
) {
  const { data: existingConversation, error: existingConversationError } =
    await supabase
      .from("conversations")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

  if (existingConversationError) {
    return { error: existingConversationError.message };
  }

  if (existingConversation) {
    return { data: existingConversation };
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id, project_id, provider_id, project:projects!applications_project_id_fkey(client_id)")
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
): Promise<Result<ConversationDetail>> {
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

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (messagesError) {
    return { error: messagesError.message };
  }

  const conversationMessages = messages ?? [];
  const lastMessage =
    conversationMessages.length > 0
      ? conversationMessages[conversationMessages.length - 1]
      : null;
  const unreadCount = conversationMessages.filter(
    (message) => !message.is_read && message.sender_id !== userId,
  ).length;

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
      unread_count: unreadCount,
      messages: conversationMessages,
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
