// Demo-mode AI assistant — no LLM API key required. Answers are generated
// entirely in the browser from the signed-in user's own real Supabase data
// (RLS already scopes every query to what they're allowed to see), matched
// against the question by keyword. This trades free-form conversation for
// zero API cost and zero extra setup — swap in a real LLM later by pointing
// ChatWidget back at a Supabase Edge Function if desired.
import { supabase } from "@/integrations/supabase/client";
import type { UserRole } from "@/lib/db-types";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

function matches(text: string, ...keywords: string[]) {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

async function customerReply(message: string, userId: string): Promise<string> {
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, lead_status, kyc_status, whatsapp_opt_in")
    .eq("user_id", userId)
    .maybeSingle();

  if (!customer) {
    return "I don't see a booking linked to your account yet. Once you book or express interest in a property, I'll be able to help with your payments, documents and status.";
  }

  if (matches(message, "payment", "due", "installment", "overdue", "emi", "pay")) {
    const { data: plans } = await supabase
      .from("installment_plans")
      .select("installments(due_date, amount, status)")
      .eq("customer_id", customer.id);
    const all = (plans ?? []).flatMap((p) => p.installments ?? []);
    const overdue = all.filter((i) => i.status === "overdue");
    const pending = all
      .filter((i) => i.status === "pending")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const next = pending[0];
    if (overdue.length) {
      return `You have ${overdue.length} overdue installment(s) totalling ${inr(overdue.reduce((s, i) => s + Number(i.amount), 0))}. ${next ? `Your next upcoming payment is ${inr(next.amount)}, due ${next.due_date}.` : ""} You can pay from the Payments page.`;
    }
    if (next) {
      return `You're all caught up — no overdue payments. Your next installment is ${inr(next.amount)}, due ${next.due_date}.`;
    }
    return "You don't have any pending or overdue installments right now.";
  }

  if (matches(message, "loan", "bank", "financ", "mortgage", "hdfc", "icici", "sbi")) {
    const { data: loans } = await supabase
      .from("loan_applications")
      .select("bank_name, requested_amount, status")
      .eq("customer_id", customer.id);
    if (!loans?.length) {
      return 'You haven\'t applied for financing yet. Open any of your properties and use "Apply for home loan financing" to submit a request to a bank of your choice.';
    }
    return loans
      .map(
        (l) =>
          `${l.bank_name}: ${inr(l.requested_amount)} requested, currently ${l.status.replace("_", " ")}.`,
      )
      .join("\n");
  }

  if (matches(message, "document", "kyc", "upload", "verify", "verification")) {
    const { data: docs } = await supabase
      .from("documents")
      .select("doc_type, verification_status")
      .eq("customer_id", customer.id);
    const pending = (docs ?? []).filter((d) => d.verification_status === "pending").length;
    const rejected = (docs ?? []).filter((d) => d.verification_status === "rejected").length;
    if (!docs?.length)
      return "You haven't uploaded any documents yet — you can do that from the Documents page.";
    return `You have ${docs.length} document(s) on file: ${pending} pending review${rejected ? `, ${rejected} rejected and needing re-upload` : ""}. Your KYC status is ${customer.kyc_status}.`;
  }

  if (matches(message, "whatsapp", "notification", "update", "alert")) {
    return customer.whatsapp_opt_in
      ? "You're opted in to WhatsApp updates — our team sends payment reminders and status updates there. You can change this anytime in Settings."
      : "You're not opted in to WhatsApp updates yet. Turn it on in Settings to get payment reminders and status updates there.";
  }

  if (matches(message, "propert", "booking", "flat", "plot", "status", "possession")) {
    const { data: properties } = await supabase
      .from("properties")
      .select("code, property_type, status, price, projects(name)")
      .eq("customer_id", customer.id);
    if (!properties?.length) {
      return "You don't have any booked properties yet — browse available plots and flats from the Browse Properties page.";
    }
    return properties
      .map(
        (p) =>
          `${p.code} (${p.property_type}) at ${p.projects?.name ?? "—"} — ${p.status}, ${inr(p.price)}.`,
      )
      .join("\n");
  }

  return `Hi! I can help with your payments and installments, documents, financing applications, property status, or WhatsApp notification preferences — just ask. You're currently ${customer.lead_status === "sold" ? "a confirmed owner" : customer.lead_status}.`;
}

async function staffReply(message: string, userId: string, role: UserRole): Promise<string> {
  if (matches(message, "lead", "pipeline", "crm", "sales")) {
    const { data } = await supabase.from("customers").select("lead_status");
    const counts = (data ?? []).reduce<Record<string, number>>((acc, c) => {
      acc[c.lead_status] = (acc[c.lead_status] ?? 0) + 1;
      return acc;
    }, {});
    return `Leads by stage: ${
      Object.entries(counts)
        .map(([k, v]) => `${k} (${v})`)
        .join(", ") || "none yet"
    }.`;
  }

  if (matches(message, "inventory", "propert", "plot", "flat", "available")) {
    const { data } = await supabase.from("properties").select("status");
    const counts = (data ?? []).reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});
    return `Inventory by status: ${
      Object.entries(counts)
        .map(([k, v]) => `${k} (${v})`)
        .join(", ") || "none yet"
    }.`;
  }

  if (matches(message, "overdue", "collection", "finance", "payment", "dues")) {
    const { data } = await supabase
      .from("installments")
      .select("status, amount")
      .eq("status", "overdue");
    const total = (data ?? []).reduce((s, i) => s + Number(i.amount), 0);
    return `${data?.length ?? 0} overdue installment(s), totalling ${inr(total)}.`;
  }

  if (matches(message, "approval", "legal", "clearance")) {
    const { data } = await supabase.from("approvals").select("status").eq("status", "pending");
    return `${data?.length ?? 0} approval(s) pending across booking, legal, finance, registration and possession stages.`;
  }

  if (matches(message, "task", "todo", "my work")) {
    const { data } = await supabase
      .from("tasks")
      .select("status")
      .eq("assigned_to", userId)
      .neq("status", "done");
    return `You have ${data?.length ?? 0} open task(s) assigned to you.`;
  }

  if (matches(message, "loan", "bank", "financ")) {
    const { data } = await supabase.from("loan_applications").select("status");
    const counts = (data ?? []).reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {});
    return `Loan applications by status: ${
      Object.entries(counts)
        .map(([k, v]) => `${k.replace("_", " ")} (${v})`)
        .join(", ") || "none submitted yet"
    }.`;
  }

  return `Hi! As ${role}, I can help with leads & pipeline, inventory, overdue collections, pending approvals, your open tasks, or loan applications — just ask.`;
}

export async function getDemoAgentReply(message: string): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return "Please sign in to use the assistant.";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();
  const role = profile?.role ?? "customer";

  if (role === "customer") return customerReply(message, userData.user.id);
  return staffReply(message, userData.user.id, role);
}
