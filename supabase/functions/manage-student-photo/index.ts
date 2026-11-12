import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, clientOptions);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireAdmin(req: Request): Promise<void> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "Please sign in again.");

  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...clientOptions,
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) throw new HttpError(401, "Please sign in again.");

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin") throw new HttpError(403, "Only the admin can upload student photos.");
}

function studentPhotoPath(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  const marker = "/storage/v1/object/public/student-photos/";
  const markerIndex = photoUrl.indexOf(marker);
  if (markerIndex === -1) return null;
  return decodeURIComponent(photoUrl.slice(markerIndex + marker.length));
}

async function handle(req: Request): Promise<Response> {
  await requireAdmin(req);
  const form = await req.formData();
  const studentId = form.get("studentId");
  const file = form.get("file");

  if (typeof studentId !== "string" || !studentId.trim()) throw new HttpError(400, "A student is required.");
  if (!(file instanceof File)) throw new HttpError(400, "Please choose an image file.");
  if (file.size > 5 * 1024 * 1024) throw new HttpError(400, "The photo must be 5 MB or smaller.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new HttpError(400, "Use a JPEG, PNG, or WebP image.");
  }

  const { data: student, error: studentError } = await adminClient
    .from("students")
    .select("id, photo_url")
    .eq("id", studentId.trim())
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student) throw new HttpError(404, "Student not found.");

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${student.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await adminClient.storage.from("student-photos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new HttpError(400, "Could not save the photo. Please try again.");

  const { data: publicData } = adminClient.storage.from("student-photos").getPublicUrl(path);
  const { error: updateError } = await adminClient
    .from("students")
    .update({ photo_url: publicData.publicUrl })
    .eq("id", student.id);
  if (updateError) {
    await adminClient.storage.from("student-photos").remove([path]);
    throw new HttpError(400, "Could not save the photo. Please try again.");
  }

  const previousPath = studentPhotoPath(student.photo_url);
  if (previousPath && previousPath !== path) {
    const { error: removeError } = await adminClient.storage.from("student-photos").remove([previousPath]);
    if (removeError) console.error("Could not remove previous student photo", removeError);
  }

  return json({ ok: true, photoUrl: publicData.publicUrl });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    return await handle(req);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("manage-student-photo failed", err);
    return json({ error: "Could not save the photo. Please try again." }, 500);
  }
});
