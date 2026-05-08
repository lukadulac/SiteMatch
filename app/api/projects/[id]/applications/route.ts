import { NextResponse } from "next/server";
import { getProjectApplicationsForClient } from "@/lib/projects/service";
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
  const result = await getProjectApplicationsForClient(supabase, user.id, id);

  if (result.error) {
    const statusCode =
      result.error === "Only clients can access this resource."
        ? 403
        : result.error === "Project not found."
          ? 404
          : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({ data: result.data });
}
