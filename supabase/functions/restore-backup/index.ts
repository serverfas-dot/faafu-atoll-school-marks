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

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, options);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function requireSuperAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "Please sign in again.");
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...options,
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
  if (profile?.role !== "super_admin") throw new HttpError(403, "Only a super admin can do this.");
  return userData.user.id;
}

async function handle(req: Request): Promise<Response> {
  const body = (await req.json()) as Record<string, unknown>;

  switch (body.action) {
    case "restore": {
      await requireSuperAdmin(req);
      const payload = body.payload;
      if (typeof payload !== "object" || payload === null) {
        throw new HttpError(400, "This file is not a valid backup.");
      }
      const { error } = await adminClient.rpc("restore_backup", { restore_payload: payload });
      if (error) throw new HttpError(400, error.message);
      return json({ ok: true });
    }

    default:
      throw new HttpError(400, "Unknown action.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    return await handle(req);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("restore-backup failed", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
