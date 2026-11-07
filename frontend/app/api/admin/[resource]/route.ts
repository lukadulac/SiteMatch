import { NextResponse } from "next/server";
import { getAdminOverview, getAdminRecords } from "@/lib/admin/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const params = new URL(request.url).searchParams;
  const supabase = await createSupabaseServerClient();
  const result = resource === "overview" ? await getAdminOverview(supabase) : await getAdminRecords(supabase, {
    resource, page: params.get("page") ?? undefined, filter: params.get("filter") ?? undefined,
  });
  return NextResponse.json(result.error ? { error: result.error } : { data: result.data }, {
    status: result.status ?? 200, headers: { "Cache-Control": "private, no-store" },
  });
}
