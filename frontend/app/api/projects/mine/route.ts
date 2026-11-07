import { NextResponse } from "next/server";
import { getClientProjects } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await getClientProjects(supabase, user.id);

  if (result.error) {
    const statusCode =
      result.error === "Only clients can view their project listings."
        ? 403
        : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({ data: result.data });
}
