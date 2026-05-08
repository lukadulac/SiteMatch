import { NextResponse } from "next/server";
import { updateApplicationStatusSchema } from "@/lib/projects/schemas";
import {
  getProjectApplicationForClient,
  updateProjectApplicationStatusForClient,
} from "@/lib/projects/service";
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
  const result = await getProjectApplicationForClient(supabase, user.id, id);

  if (result.error) {
    const statusCode =
      result.error === "Only clients can access this resource."
        ? 403
        : result.error === "Application not found."
          ? 404
          : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({ data: result.data });
}

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = updateApplicationStatusSchema.safeParse(payload);

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
  const result = await updateProjectApplicationStatusForClient(
    supabase,
    user.id,
    id,
    parsed.data,
  );

  if (result.error) {
    const statusCode =
      result.error === "Only clients can access this resource."
        ? 403
        : result.error === "Application not found."
          ? 404
          : result.error === "This application can no longer be updated."
            || result.error === "A provider has already been accepted for this project."
            ? 409
            : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({
    data: result.data,
    message: "Application updated successfully.",
  });
}
