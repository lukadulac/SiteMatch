import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { moderate } from "@/lib/admin/service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON." }, { status: 415 });
  }
  let input: unknown;
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const result = await moderate(await createSupabaseServerClient(), input, () => createSupabaseAdminClient().auth.admin);
  // Also refresh after an Auth failure: the DB moderation transaction may have succeeded.
  if (!result.error || result.status === 503) {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/find-talent", "layout");
    revalidatePath("/jobs", "layout");
    revalidatePath("/oglasi", "layout");
    revalidatePath("/find-work", "layout");
  }
  return NextResponse.json(result.error ? { error: result.error } : { data: result.data }, { status: result.status ?? 200 });
}
