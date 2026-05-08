import { NextResponse } from "next/server";
import { getProjectFormMeta } from "@/lib/projects/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const result = await getProjectFormMeta(supabase);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result.data });
}
