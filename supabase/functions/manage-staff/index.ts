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

type StaffRole = "super_admin" | "admin" | "teacher";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${label} is required.`);
  }
  return value.trim();
}

function readPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new HttpError(400, "The password must be at least 8 characters.");
  }
  return value;
}

async function hasAdmin(): Promise<boolean> {
  const { count, error } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "super_admin"]);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function requireRole(req: Request, ...allowed: StaffRole[]): Promise<string> {
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
  if (!profile || !allowed.includes(profile.role as StaffRole)) {
    throw new HttpError(403, "You do not have permission to do this.");
  }
  return userData.user.id;
}

async function countAdmins(): Promise<number> {
  const { count, error } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "super_admin"]);
  if (error) throw error;
  return count ?? 0;
}

async function createAccount(
  fullName: string,
  email: string,
  password: string,
  role: StaffRole,
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw new HttpError(400, error?.message ?? "Could not create the account.");

  const userId = data.user.id;
  const { error: profileError } = await adminClient
    .from("profiles")
    .insert({ id: userId, full_name: fullName, email, role });
  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId);
    if (profileError.code === "23505") throw new HttpError(409, "An admin account already exists.");
    throw new HttpError(400, profileError.message);
  }
  return userId;
}

async function requireStaff(staffId: string): Promise<{ role: StaffRole }> {
  const { data, error } = await adminClient.from("profiles").select("role").eq("id", staffId).maybeSingle();
  if (error) throw error;
  if (data?.role !== "super_admin" && data?.role !== "admin" && data?.role !== "teacher") {
    throw new HttpError(404, "Staff member not found.");
  }
  return data;
}

async function handle(req: Request): Promise<Response> {
  const body = (await req.json()) as Record<string, unknown>;

  switch (body.action) {
    case "status":
      return json({ hasAdmin: await hasAdmin() });

    case "bootstrap": {
      if (await hasAdmin()) throw new HttpError(409, "An admin already exists.");
      const fullName = readText(body.fullName, "Full name");
      const email = readText(body.email, "Email");
      const password = readPassword(body.password);
      await createAccount(fullName, email, password, "super_admin");
      return json({ ok: true });
    }

    case "create_teacher": {
      await requireRole(req, "admin", "super_admin");
      const fullName = readText(body.fullName, "Full name");
      const email = readText(body.email, "Email");
      const password = readPassword(body.password);
      await createAccount(fullName, email, password, "teacher");
      return json({ ok: true });
    }

    case "update_teacher": {
      await requireRole(req, "admin", "super_admin");
      const teacherId = readText(body.teacherId, "Teacher");
      const fullName = readText(body.fullName, "Full name");
      await requireStaff(teacherId);
      const { error } = await adminClient.from("profiles").update({ full_name: fullName }).eq("id", teacherId);
      if (error) throw error;
      return json({ ok: true });
    }

    case "set_password": {
      const callerId = await requireRole(req, "admin", "super_admin");
      const staffId = readText(body.staffId, "Staff member");
      const password = readPassword(body.password);
      const staff = await requireStaff(staffId);
      if (staff.role === "super_admin" && staffId !== callerId) {
        throw new HttpError(403, "Only a super admin can change another super admin's password.");
      }
      const { error } = await adminClient.auth.admin.updateUserById(staffId, { password });
      if (error) throw new HttpError(400, error.message);
      return json({ ok: true });
    }

    case "update_role": {
      const callerId = await requireRole(req, "super_admin");
      const staffId = readText(body.staffId, "Staff member");
      const role = readText(body.role, "Role");
      if (role !== "super_admin" && role !== "admin" && role !== "teacher") throw new HttpError(400, "Invalid role.");
      const staff = await requireStaff(staffId);
      if (staffId === callerId && role !== "super_admin") {
        throw new HttpError(400, "You cannot remove your own super admin access.");
      }
      if (staff.role !== "teacher" && role === "teacher") {
        if ((await countAdmins()) <= 1) throw new HttpError(400, "At least one admin account must remain.");
      }
      const { error } = await adminClient.from("profiles").update({ role }).eq("id", staffId);
      if (error) throw error;
      return json({ ok: true });
    }

    case "delete_teacher": {
      const callerId = await requireRole(req, "admin", "super_admin");
      const teacherId = readText(body.teacherId, "Teacher");
      if (teacherId === callerId) throw new HttpError(400, "You cannot delete your own account.");
      const staff = await requireStaff(teacherId);
      if (staff.role === "super_admin") throw new HttpError(403, "Only a super admin can remove another super admin.");
      if (staff.role === "admin" && (await countAdmins()) <= 1) {
        throw new HttpError(400, "At least one admin account must remain.");
      }
      const { error } = await adminClient.auth.admin.deleteUser(teacherId);
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
    console.error("manage-staff failed", err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
