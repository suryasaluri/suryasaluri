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
export type LoanApplication = Tables<"loan_applications">;
export type SiteSettings = Tables<"site_settings">;
export type Integration = Tables<"integrations">;
export type Complex = Tables<"complexes">;
export type Resident = Tables<"residents">;
export type Asset = Tables<"assets">;
export type MaintenanceTicket = Tables<"maintenance_tickets">;
export type MaintenanceBill = Tables<"maintenance_bills">;
export type AttendanceRecord = Tables<"attendance_records">;
export type CallLog = Tables<"call_logs">;
export type WebsiteMetric = Tables<"website_metrics">;
export type SocialEngagement = Tables<"social_engagement">;

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
export type LoanStatus = Enums<"loan_status">;
export type HeroAnimation = Enums<"hero_animation">;
export type IntegrationPlatform = Enums<"integration_platform">;
export type ResidentRelation = Enums<"resident_relation">;
export type AssetCategory = Enums<"asset_category">;
export type TicketCategory = Enums<"ticket_category">;
export type TicketPriority = Enums<"ticket_priority">;
export type TicketStatus = Enums<"ticket_status">;
export type BillType = Enums<"bill_type">;
export type AttendanceStatus = Enums<"attendance_status">;
export type CallDirection = Enums<"call_direction">;
export type CallOutcome = Enums<"call_outcome">;
export type TrafficSource = Enums<"traffic_source">;

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half Day",
  leave: "Leave",
  holiday: "Holiday",
};

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  connected: "Connected",
  no_answer: "No Answer",
  voicemail: "Voicemail",
  busy: "Busy",
  wrong_number: "Wrong Number",
};

export const TRAFFIC_SOURCE_LABELS: Record<TrafficSource, string> = {
  organic: "Organic Search",
  paid: "Paid Ads",
  social: "Social Media",
  referral: "Referral",
  direct: "Direct",
};

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  lift: "Lift",
  generator: "Generator",
  pump: "Water Pump",
  fire_safety: "Fire Safety",
  security_system: "Security System",
  other: "Other",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  civil: "Civil",
  security: "Security",
  housekeeping: "Housekeeping",
  other: "Other",
};

export const BILL_TYPE_LABELS: Record<BillType, string> = {
  monthly_maintenance: "Monthly Maintenance",
  sinking_fund: "Sinking Fund",
  special_assessment: "Special Assessment",
};

export const INTEGRATION_LABELS: Record<
  IntegrationPlatform,
  { label: string; description: string }
> = {
  youtube: {
    label: "YouTube",
    description: "Capture leads from video comments, descriptions and end-screen links.",
  },
  google_analytics: {
    label: "Website Analytics",
    description: "Track visitor behaviour on your public site and attribute leads to campaigns.",
  },
  instagram: {
    label: "Instagram",
    description: "Sync DMs and comment inquiries from your property reels and posts.",
  },
  tiktok: {
    label: "TikTok",
    description: "Capture inquiries from TikTok ads and organic video engagement.",
  },
  facebook_meta: {
    label: "Facebook / Meta Ads",
    description: "Pull lead-form submissions from Facebook and Instagram ad campaigns.",
  },
};

export const INDIAN_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "State Bank of India",
  "IDBI Bank",
  "Axis Bank",
  "Punjab National Bank",
  "Bank of Baroda",
  "Kotak Mahindra Bank",
  "LIC Housing Finance",
] as const;

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
