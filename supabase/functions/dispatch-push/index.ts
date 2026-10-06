const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Supabase Edge Function environment is incomplete." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ action: "dispatch" }),
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") || "application/json" },
  });
});