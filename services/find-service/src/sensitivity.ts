const PCI_HINTS = ["finance", "billing", "payment", "invoice", "card", "stripe", "aml"];
const PHI_HINTS = ["health", "patient", "medical", "hipaa", "clinical"];
const PII_HINTS = ["customer", "crm", "salesforce", "hubspot", "marketing", "user", "lead", "contact", "workday", "hr", "zendesk"];

/** Deterministic heuristic classification for the demo — keyword match on name/service type. */
export function classifySensitivity(name: string, serviceType: string, category?: string | null): string[] {
  const haystack = `${name} ${serviceType}`.toLowerCase();
  const labels: string[] = [];
  if (PCI_HINTS.some((h) => haystack.includes(h))) labels.push("PCI");
  if (PHI_HINTS.some((h) => haystack.includes(h))) labels.push("PHI");
  if (PII_HINTS.some((h) => haystack.includes(h))) labels.push("PII");
  if (labels.length === 0) labels.push(category === "Storage" || category === "Streaming" ? "Internal" : "Public");
  return labels;
}
