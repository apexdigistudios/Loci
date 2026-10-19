import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-loci-session, x-deloci-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readStringProperty(value: unknown, property: string): string | null {
  if (typeof value !== "object" || value === null || !(property in value)) return null;
  const propertyValue = (value as Record<string, unknown>)[property];
  return typeof propertyValue === "string" ? propertyValue : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
    
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Server configuration error: missing service keys" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const action = body.action || "signup";

    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";

    if (!phone) {
      return jsonResponse({ error: "Phone number is required." }, 400);
    }

    // SIGNUP
    if (action === "signup") {
      if (!pin) {
        return jsonResponse({ error: "A 4-digit PIN is required for signup." }, 400);
      }

      const pinHash = await sha256Hex(pin);
      const fullName = body.fullName || body.full_name || null;
      const nickname = body.nickname || null;
      const email = body.email || null;
      const avatarUrl = body.avatarUrl || body.avatar_url || null;

      const { data: existingUser, error: lookupError } = await admin
        .from("users")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      if (lookupError) throw lookupError;

      let userId: string;

      if (existingUser) {
        const existingUserId = readStringProperty(existingUser, "id");
        if (!existingUserId) throw new Error("User lookup returned an invalid ID");
        userId = existingUserId;
        const { error: updateError } = await admin
          .from("users")
          .update({ pin_hash: pinHash, full_name: fullName, nickname, email, avatar_url: avatarUrl })
          .eq("id", userId);
        if (updateError) throw updateError;
      } else {
        const { data: newUser, error: insertError } = await admin
          .from("users")
          .insert({ phone, pin_hash: pinHash, full_name: fullName, nickname, email, avatar_url: avatarUrl })
          .select("id")
          .single();

        if (insertError) throw insertError;
        const newUserId = readStringProperty(newUser, "id");
        if (!newUserId) throw new Error("User creation returned an invalid ID");
        userId = newUserId;
      }

      // Generate App Session
      const sessionToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const tokenHash = await sha256Hex(sessionToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await admin.from("notification_app_sessions").insert({
        token_hash: tokenHash,
        user_id: userId,
        expires_at: expiresAt,
      });

      // Fetch full user profile to return
      const { data: profile } = await admin.from("users").select("*").eq("id", userId).single();

      return jsonResponse({
        success: true,
        sessionToken,
        expiresAt,
        userId,
        user: profile,
      });
    }

    // LOGIN
    if (action === "login" || action === "create_session") {
      if (!pin) {
        return jsonResponse({ error: "PIN is required to sign in." }, 400);
      }

      const { data: user, error: userError } = await admin
        .from("users")
        .select("*")
        .eq("phone", phone)
        .maybeSingle();

      if (userError || !user) {
        return jsonResponse({ error: "Account not found with this phone number." }, 404);
      }

      const inputPinHash = await sha256Hex(pin);
      if (user.pin_hash && user.pin_hash !== inputPinHash) {
        return jsonResponse({ error: "Incorrect PIN. Please try again." }, 401);
      }

      const sessionToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const tokenHash = await sha256Hex(sessionToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await admin.from("notification_app_sessions").insert({
        token_hash: tokenHash,
        user_id: user.id,
        expires_at: expiresAt,
      });

      return jsonResponse({
        success: true,
        sessionToken,
        expiresAt,
        userId: user.id,
        user,
      });
    }

    // CHECK PIN STATUS / LOOKUP
    if (action === "check_pin_status") {
      const { data } = await admin.from("users").select("pin_hash").eq("phone", phone).maybeSingle();
      return jsonResponse({ hasPin: !!data?.pin_hash });
    }

    if (action === "lookup_user") {
      const { data } = await admin.from("users").select("*").eq("phone", phone).maybeSingle();
      return jsonResponse({ user: data ? { ...data, hasPin: !!data.pin_hash } : null });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err: unknown) {
    console.error("CRITICAL DELOCI-AUTH ERROR:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({
      error: message,
      details: String(err),
    }, 500);
  }
});