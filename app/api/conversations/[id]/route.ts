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

function parseMessageLimit(value: string | null) {
  if (!value) {
    return 50;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

export async function GET(request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const limit = parseMessageLimit(url.searchParams.get("limit"));
  const before = url.searchParams.get("before");

  if (limit == null) {
    return NextResponse.json(
      { error: "Message limit must be a whole number." },
      { status: 400 },
    );
  }

  if (before && Number.isNaN(new Date(before).getTime())) {
    return NextResponse.json(
      { error: "Message cursor must be a valid timestamp." },
      { status: 400 },
    );
  }

  const result = await getConversationById(supabase, user.id, id, {
    limit,
    before,
  });

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
