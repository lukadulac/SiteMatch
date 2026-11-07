import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  MAX_AVATAR_BYTES,
  removeOwnAvatar,
  uploadOwnAvatar,
  type AvatarResult,
} from "@/lib/profiles/avatar";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Room for the multipart boundary and headers around the image itself.
const MAX_REQUEST_BYTES = MAX_AVATAR_BYTES + 64 * 1024;

function isSameOrigin(request: Request) {
  return request.headers.get("origin") === new URL(request.url).origin;
}

async function getSignedInUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabase, user };
}

function respond(result: AvatarResult) {
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Avatars appear on dashboards, messages and public listing pages.
  revalidatePath("/", "layout");

  return NextResponse.json({ data: result.data });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "The image must be 2 MB or smaller." }, { status: 413 });
  }

  const { supabase, user } = await getSignedInUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let file: FormDataEntryValue | null;

  try {
    file = (await request.formData()).get("avatar");
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  return respond(await uploadOwnAvatar(supabase, user.id, file));
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const { supabase, user } = await getSignedInUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return respond(await removeOwnAvatar(supabase, user.id));
}
