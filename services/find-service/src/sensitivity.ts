const PCI_HINTS = ["finance", "billing", "payment", "invoice", "card", "stripe", "aml"];
const PHI_HINTS = ["health", "patient", "medical", "hipaa", "clinical"];
const PII_HINTS = ["customer", "crm", "salesforce", "hubspot", "marketing", "user", "lead", "contact", "workday", "hr", "zendesk"];

/** Heuristic classification for a connection/table name — keyword match. */
export function classifySensitivity(name: string, serviceType: string, category?: string | null): string[] {
  const haystack = `${name} ${serviceType}`.toLowerCase();
  const labels: string[] = [];
  if (PCI_HINTS.some((h) => haystack.includes(h))) labels.push("PCI");
  if (PHI_HINTS.some((h) => haystack.includes(h))) labels.push("PHI");
  if (PII_HINTS.some((h) => haystack.includes(h))) labels.push("PII");
  if (labels.length === 0) labels.push(category === "Storage" || category === "Streaming" ? "Internal" : "Public");
  return labels;
}

const PCI_COLUMN_HINTS = ["card_number", "credit_card", "cvv", "card", "payment", "iban", "routing_number"];
const PHI_COLUMN_HINTS = ["diagnosis", "patient", "medical", "prescription", "treatment"];
const PII_COLUMN_HINTS = ["email", "phone", "ssn", "social_security", "address", "dob", "date_of_birth", "birth_date", "first_name", "last_name", "full_name", "passport"];

/** Heuristic classification for a single column name, against a client's real schema. */
export function classifyColumnSensitivity(columnName: string): string[] {
  const haystack = columnName.toLowerCase();
  const labels: string[] = [];
  if (PCI_COLUMN_HINTS.some((h) => haystack.includes(h))) labels.push("PCI");
  if (PHI_COLUMN_HINTS.some((h) => haystack.includes(h))) labels.push("PHI");
  if (PII_COLUMN_HINTS.some((h) => haystack.includes(h))) labels.push("PII");
  return labels;
}
