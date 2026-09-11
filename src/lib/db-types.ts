import type { Tables, Enums } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Project = Tables<"projects">;
export type Property = Tables<"properties">;
export type Customer = Tables<"customers">;
export type Payment = Tables<"payments">;
export type InstallmentPlan = Tables<"installment_plans">;
export type Installment = Tables<"installments">;
export type Document = Tables<"documents">;
export type Approval = Tables<"approvals">;
export type SiteVisit = Tables<"site_visits">;
export type Notification = Tables<"notifications">;
export type LeadNote = Tables<"lead_notes">;
export type Task = Tables<"tasks">;
export type Commission = Tables<"commissions">;

export type UserRole = Enums<"user_role">;
export type PropertyType = Enums<"property_type">;
export type ProjectTypeMix = Enums<"project_type_mix">;
export type PropertyStatus = Enums<"property_status">;
export type FacingDirection = Enums<"facing_direction">;
export type LeadStatus = Enums<"lead_status">;
export type PaymentStatus = Enums<"payment_status">;
export type PaymentMode = Enums<"payment_mode">;
export type DocumentType = Enums<"document_type">;
export type VerificationStatus = Enums<"verification_status">;
export type ApprovalStage = Enums<"approval_stage">;
export type ApprovalStatus = Enums<"approval_status">;
export type SiteVisitStatus = Enums<"site_visit_status">;
export type TaskStatus = Enums<"task_status">;
export type CommissionStatus = Enums<"commission_status">;

export const APPROVAL_STAGES: ApprovalStage[] = [
  "booking",
  "legal_verification",
  "finance_clearance",
  "registration",
  "possession",
];

export const LEAD_STAGES: LeadStatus[] = ["new", "contacted", "site_visit", "booked", "sold"];

export const STAGE_LABELS: Record<ApprovalStage, string> = {
  booking: "Booking",
  legal_verification: "Legal Verification",
  finance_clearance: "Finance Clearance",
  registration: "Registration",
  possession: "Possession",
};

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  sale_agreement: "Sale Agreement",
  title_deed: "Title Deed",
  approval_certificate: "Approval Certificate",
  id_proof: "ID Proof",
  occupancy_certificate: "Occupancy Certificate",
  kyc: "KYC Document",
  other: "Other",
};

export const LEAD_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  site_visit: "Site Visit",
  booked: "Booked",
  sold: "Sold",
};
