import { NextResponse } from "next/server";
import {
  getConversationById,
  markConversationAsRead,
} from "@/lib/messaging/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await getConversationById(supabase, user.id, id);

  if (result.error) {
    const statusCode = result.error === "Conversation not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({ data: result.data });
}

export async function PATCH(_request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await markConversationAsRead(supabase, user.id, id);

  if (result.error) {
    const statusCode = result.error === "Conversation not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({
    data: result.data,
    message: "Conversation marked as read.",
  });
}
