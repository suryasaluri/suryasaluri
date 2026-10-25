// SAN Connect AI agent — role-aware assistant for the customer portal and the
// internal operations dashboard. Runs as a Supabase Edge Function so the
// Anthropic key never reaches the browser. Context queries run through the
// caller's own JWT, so RLS (already defined in the schema) scopes every
// answer to exactly what that user is allowed to see — customers only ever
// see their own data, staff see what their role already has access to.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ANTHROPIC_MODEL = "claude-sonnet-4-5";

type ChatMessage = { role: "user" | "assistant"; content: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

// deno-lint-ignore no-explicit-any
async function buildCustomerContext(supabase: any, userId: string) {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, lead_status, kyc_status, whatsapp_opt_in")
    .eq("user_id", userId)
    .maybeSingle();
  if (!customer) return "This customer has no linked profile yet — they haven't booked anything.";

  const [{ data: properties }, { data: plans }, { data: documents }, { data: loans }] =
    await Promise.all([
      supabase
        .from("properties")
        .select("code, property_type, price, status, projects(name)")
        .eq("customer_id", customer.id),
      supabase
        .from("installment_plans")
        .select("id, total_amount, installments(seq_no, due_date, amount, status)")
        .eq("customer_id", customer.id),
      supabase
        .from("documents")
        .select("doc_type, verification_status")
        .eq("customer_id", customer.id),
      supabase
        .from("loan_applications")
        .select("bank_name, requested_amount, status")
        .eq("customer_id", customer.id),
    ]);

  // deno-lint-ignore no-explicit-any
  const allInstallments = (plans ?? []).flatMap((p: any) => p.installments ?? []);
  // deno-lint-ignore no-explicit-any
  const overdue = allInstallments.filter((i: any) => i.status === "overdue");
  // deno-lint-ignore no-explicit-any
  const pending = allInstallments.filter((i: any) => i.status === "pending");
  const nextDue = pending.sort(
    // deno-lint-ignore no-explicit-any
    (a: any, b: any) => a.due_date.localeCompare(b.due_date),
  )[0];
  // deno-lint-ignore no-explicit-any
  const pendingDocs = (documents ?? []).filter((d: any) => d.verification_status === "pending");
  // deno-lint-ignore no-explicit-any
  const rejectedDocs = (documents ?? []).filter((d: any) => d.verification_status === "rejected");

  return [
    `Customer: ${customer.name} (lead status: ${customer.lead_status}, KYC: ${customer.kyc_status}).`,
    `WhatsApp updates: ${customer.whatsapp_opt_in ? "opted in" : "not opted in — you can suggest they turn it on in Settings"}.`,
    `Properties: ${
      (properties ?? [])
        // deno-lint-ignore no-explicit-any
        .map(
          (p: any) =>
            `${p.code} (${p.property_type}, ${p.status}, ${inr(p.price)}${p.projects?.name ? `, ${p.projects.name}` : ""})`,
        )
        .join("; ") || "none yet"
    }.`,
    `Installments: ${overdue.length} overdue, ${pending.length} upcoming.${
      nextDue ? ` Next due: ${inr(nextDue.amount)} on ${nextDue.due_date}.` : ""
    }`,
    `Documents: ${pendingDocs.length} pending review, ${rejectedDocs.length} rejected and need re-upload.`,
    `Loan applications: ${
      (loans ?? []).length
        ? // deno-lint-ignore no-explicit-any
          loans.map((l: any) => `${l.bank_name} — ${inr(l.requested_amount)} (${l.status})`).join("; ")
        : "none submitted yet — they can apply from a property's detail page."
    }`,
  ].join("\n");
}

// deno-lint-ignore no-explicit-any
async function buildStaffContext(supabase: any, userId: string) {
  const [{ data: customers }, { data: properties }, { data: installments }, { data: approvals }, { data: tasks }, { data: loans }] =
    await Promise.all([
      supabase.from("customers").select("lead_status"),
      supabase.from("properties").select("status"),
      supabase.from("installments").select("status, amount"),
      supabase.from("approvals").select("status"),
      supabase.from("tasks").select("status, assigned_to").eq("assigned_to", userId).neq("status", "done"),
      supabase.from("loan_applications").select("status"),
    ]);

  // deno-lint-ignore no-explicit-any
  const byKey = (rows: any[] | null, key: string) =>
    // deno-lint-ignore no-explicit-any
    Object.entries(
      (rows ?? []).reduce((acc: Record<string, number>, r: any) => {
        acc[r[key]] = (acc[r[key]] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

  // deno-lint-ignore no-explicit-any
  const overdueInstallments = (installments ?? []).filter((i: any) => i.status === "overdue");
  const overdueAmount = overdueInstallments.reduce(
    // deno-lint-ignore no-explicit-any
    (sum: number, i: any) => sum + Number(i.amount),
    0,
  );

  return [
    `Leads/customers by stage: ${byKey(customers, "lead_status") || "none"}.`,
    `Inventory by status: ${byKey(properties, "status") || "none"}.`,
    `Installments: ${overdueInstallments.length} overdue totalling ${inr(overdueAmount)}.`,
    `Approvals pending: ${(approvals ?? []).filter((a: { status: string }) => a.status === "pending").length}.`,
    `Bank loan applications by status: ${byKey(loans, "status") || "none submitted yet"}.`,
    `Your open tasks: ${(tasks ?? []).length}.`,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return json(
        { error: "The AI agent isn't configured yet — ask an admin to add ANTHROPIC_API_KEY." },
        500,
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2.108.0");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", userData.user.id)
      .single();
    const role = profile?.role ?? "customer";

    const { messages } = (await req.json()) as { messages: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages is required" }, 400);
    }

    const context =
      role === "customer"
        ? await buildCustomerContext(supabase, userData.user.id)
        : await buildStaffContext(supabase, userData.user.id);

    const audience =
      role === "customer"
        ? "a customer using the SAN Connect buyer portal"
        : `a ${role} team member using the SAN Connect internal operations dashboard`;

    const system = [
      "You are the SAN Connect AI assistant, built into a real estate sales & operations platform.",
      `You are helping ${audience}, ${profile?.full_name ?? "a signed-in user"}.`,
      "Live data snapshot for this user (answer specifically from it; never invent figures beyond it):",
      context,
      role === "customer"
        ? "Only discuss this customer's own bookings, payments, documents and loan applications. Never claim to see other customers' data. If they ask about financing, point them to the 'Apply for home loan financing' button on their property page. You cannot send WhatsApp messages yourself — if asked, tell them to enable it in Settings and our team sends updates from there."
        : "You may discuss aggregate pipeline, inventory, collections and loan-application data visible to internal staff.",
      "Be concise, warm, and specific. Use Indian Rupee formatting (₹) for money. If you don't know something, say so plainly instead of guessing.",
    ].join("\n\n");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic error", anthropicRes.status, errText);
      return json({ error: "The AI agent is temporarily unavailable. Please try again." }, 502);
    }

    const result = await anthropicRes.json();
    const reply = result.content?.[0]?.type === "text" ? result.content[0].text : "";
    return json({ reply });
  } catch (err) {
    console.error(err);
    return json({ error: "Something went wrong." }, 500);
  }
});
