import { NextResponse } from "next/server";
import { createProjectSchema } from "@/lib/projects/schemas";
import { createProject } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

  const parsed = createProjectSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const result = await createProject(supabase, user.id, parsed.data);

  if (result.error) {
    const statusCode =
      result.error === "Only clients can create project listings."
        ? 403
        : result.error === "Complete your client profile before creating a listing."
          ? 409
          : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json(
    {
      data: result.data,
      message: "Project created successfully.",
    },
    { status: 201 },
  );
}
