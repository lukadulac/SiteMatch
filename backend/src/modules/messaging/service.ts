// Moved from frontend/lib/messaging/service.ts (getUnreadConversationCount). Until EB8 the frontend keeps a temporary copy for
// callers that have not moved yet; see TEMPORARY_COPIES in scripts/check-boundaries.mjs.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase.js";

type Result<T> =
  | { data: T; error?: never }
  | { data?: never; error: string };

export async function getUnreadConversationCount(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Result<number>> {
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("id")
    .or(`client_id.eq.${userId},provider_id.eq.${userId}`);

  if (conversationsError) {
    return { error: conversationsError.message };
  }

  const conversationIds = (conversations ?? []).map((conversation) => conversation.id);
  if (conversationIds.length === 0) {
    return { data: 0 };
  }

  const { data: unreadMessages, error: messagesError } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("is_read", false)
    .neq("sender_id", userId);

  if (messagesError) {
    return { error: messagesError.message };
  }

  return {
    data: new Set((unreadMessages ?? []).map((message) => message.conversation_id)).size,
  };
}
