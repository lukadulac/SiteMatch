import { NextResponse } from "next/server";
import {
  createApplicationSchema,
  updateProjectSchema,
} from "@/lib/projects/schemas";
import {
  createProjectApplication,
  getClientProjectById,
  getPublishedProjectByIdForProvider,
  updateClientProject,
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
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result =
    profile.role === "client"
      ? await getClientProjectById(supabase, user.id, id)
      : await getPublishedProjectByIdForProvider(supabase, user.id, id);

  if (result.error) {
    const statusCode =
      result.error === "Only clients can view their project listings." ||
      result.error === "Only providers can access this resource."
        ? 403
        : result.error === "Project not found."
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

  const parsed = updateProjectSchema.safeParse(payload);

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
  const result = await updateClientProject(supabase, user.id, id, parsed.data);

  if (result.error) {
    const statusCode =
      result.error === "Only clients can manage project listings."
        ? 403
        : result.error === "Project not found."
          ? 404
          : result.error === "Complete your client profile before managing listings."
            ? 409
            : result.error === "Only draft or published projects can be updated."
              ? 409
              : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json({
    data: result.data,
    message: "Project updated successfully.",
  });
}

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

  const parsed = createApplicationSchema.safeParse(payload);

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
  const result = await createProjectApplication(supabase, user.id, id, parsed.data);

  if (result.error) {
    const statusCode =
      result.error === "Only providers can access this resource."
        ? 403
        : result.error === "Project not found."
          ? 404
          : result.error === "Providers cannot apply to their own project." ||
              result.error === "You have already applied to this project."
            ? 409
            : 400;

    return NextResponse.json({ error: result.error }, { status: statusCode });
  }

  return NextResponse.json(
    {
      data: result.data,
      message: "Application submitted successfully.",
    },
    { status: 201 },
  );
}
