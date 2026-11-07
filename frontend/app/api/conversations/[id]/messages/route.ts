import { NextResponse } from "next/server";
import { sendMessageSchema } from "@/lib/messaging/schemas";
import { sendConversationMessage } from "@/lib/messaging/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = sendMessageSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  const result = await sendConversationMessage(supabase, user.id, id, parsed.data);

  if (result.error) {
    const statusCode = result.error === "Conversation not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json(
    {
      data: result.data,
      message: "Message sent successfully.",
    },
    { status: 201 },
  );
}
