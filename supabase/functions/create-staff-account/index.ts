import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await callerClient.auth.getUser();
  if (userError || !user) return json({ error: "Invalid session" }, 401);
  const { data: caller } = await adminClient.from("staff").select("role,store_id,active").eq("user_id", user.id).maybeSingle();
  if (!caller?.active || !["global_admin", "store_manager"].includes(caller.role)) return json({ error: "Administrator access required" }, 403);

  const { email, password, displayName, role, storeId } = await req.json();
  if (!email || !password || !displayName || !storeId) return json({ error: "Name, email, password and store are required" }, 400);
  if (!['store_manager','staff'].includes(role)) return json({ error: "Invalid role" }, 400);
  if (caller.role === "store_manager" && (role !== "staff" || Number(storeId) !== Number(caller.store_id))) return json({ error: "Managers may only create staff for their own store" }, 403);
  const { data: store } = await adminClient.from("stores").select("id").eq("id", storeId).eq("active", true).maybeSingle();
  if (!store) return json({ error: "Select an active store" }, 400);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
  if (createError || !created.user) return json({ error: createError?.message ?? "Unable to create user" }, 400);
  const { error: staffError } = await adminClient.from("staff").insert({ user_id: created.user.id, display_name: displayName, role, store_id: storeId, active: true });
  if (staffError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: staffError.message }, 400);
  }
  await adminClient.from("admin_audit_logs").insert({
    admin_id: user.id,
    action_type: "team.account_created",
    target_id: created.user.id,
    details_json: { display_name: displayName, role, store_id: Number(storeId) },
  });
  return json({ userId: created.user.id });
});
