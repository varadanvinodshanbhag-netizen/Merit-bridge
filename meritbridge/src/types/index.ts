// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Domain Types — Strictly matching PRD Section 7
// ─────────────────────────────────────────────────────────────────────────────

export type Role = "Admin" | "Placement Officer" | "Assistant";

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  password_hash: string;
  must_change_password: boolean;
  is_active: boolean;
  failed_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  security_question?: string;
  security_answer_hash?: string;
}

export interface AppSecurity {
  recovery_key_hash: string;
  recovery_rotated_at: string;
  admin_pin?: string;
  master_hash?: string;
}

export interface Institution {
  name: string;
  address: string;
  contact_details: string;
  logo_path?: string;
  current_academic_year_id: number;
}

export interface AcademicYear {
  id: number;
  label: string; // e.g. "2024-25"
  start_date: string;
  end_date: string;
}

export type CgpaMethod = "Manual" | "MeanOfSgpa";

export interface Course {
  id: number;
  name: string; // e.g. "Bachelor of Technology"
  code: string; // e.g. "B.Tech"
  duration_semesters: number; // e.g. 8
  cgpa_method: CgpaMethod;
  grade_scale_max: number; // default 10
}

export interface Department {
  id: number;
  course_id: number;
  name: string; // e.g. "Computer Science & Engineering"
  code: string; // e.g. "CSE"
}

export interface Batch {
  id: number;
  course_id: number;
  label: string; // e.g. "2021-2025"
  admission_year: number; // 2021
  passing_year: number; // 2025
}

export type Gender = "Male" | "Female" | "Other";
export type InternshipStatus = "None" | "Active" | "Completed";

export interface Student {
  id: number;
  registration_number: string; // trimmed, uppercase, unique
  full_name: string;
  date_of_birth?: string;
  gender?: Gender;
  email?: string;
  phone?: string;
  alt_phone?: string;
  address?: string;
  course_id: number;
  department_id: number;
  batch_id: number;
  passing_year: number;
  cgpa?: number | null;
  internship_status?: InternshipStatus;
  internship_company?: string;
  internship_role?: string;
  internship_duration?: string;
  notes?: string;
  archived_at?: string | null;
  archived_by?: number | null;
  archive_reason?: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

export interface SubjectMark {
  id: number;
  semester_record_id: number;
  subject_name: string;
  subject_code?: string;
  marks_obtained: number;
  max_marks: number;
  credits?: number | null;
}

export interface SemesterRecord {
  id: number;
  student_id: number;
  semester_number: number;
  sgpa?: number | null;
  subjects: SubjectMark[];
}

export type BacklogStatus = "Active" | "Cleared";

export interface Backlog {
  id: number;
  student_id: number;
  subject_name: string;
  subject_code?: string;
  semester_number: number;
  status: BacklogStatus;
  cleared_on?: string | null;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export type DocumentCategory =
  | "Resume"
  | "Marksheet"
  | "Certificate"
  | "Identity Document"
  | "Internship Certificate"
  | "Other";

export interface StudentDocument {
  id: number;
  student_id: number;
  category: DocumentCategory;
  title?: string;
  original_filename: string;
  relative_path: string;
  size_bytes: number;
  sha256: string;
  uploaded_at: string;
  uploaded_by: number;
  data_url?: string; // in-browser storage preview
}

export interface CompanyContact {
  id: number;
  company_id: number;
  name: string;
  designation: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

export interface JobRole {
  id: number;
  company_id: number;
  title: string;
  designation: string;
  description?: string;
  salary_min?: number; // annual INR
  salary_max?: number;
  skills: string[];
}

export type CompanyStatus = "Active" | "Inactive" | "Archived";

export interface Company {
  id: number;
  name: string;
  name_normalized: string; // lowercase
  industry?: string;
  website?: string;
  location?: string;
  description?: string;
  notes?: string;
  status: CompanyStatus;
  default_criteria_set_id?: number;
  department_ids?: number[]; // Target departments (optional in company settings)
  contacts: CompanyContact[];
  job_roles: JobRole[];
  created_at: string;
  updated_at: string;
}

export type RuleType =
  | "MIN_CGPA"
  | "MIN_PERCENTAGE"
  | "MAX_ACTIVE_BACKLOGS"
  | "ALLOWED_COURSES"
  | "ALLOWED_DEPARTMENTS"
  | "ALLOWED_BATCHES"
  | "ALLOWED_PASSING_YEARS";

export interface CriteriaRule {
  id: number;
  criteria_set_id: number;
  rule_type: RuleType;
  numeric_value?: number; // for CGPA, percentage, backlogs
  item_ids?: number[]; // course_ids, department_ids, batch_ids, passing_years
}

export interface CriteriaSet {
  id: number;
  rules: CriteriaRule[];
}

export type DriveStatus = "Draft" | "Registration Open" | "In Progress" | "Completed" | "Cancelled";

export type StageType = "Aptitude" | "Technical" | "Group Discussion" | "HR" | "Other";

export interface DriveStage {
  id: number;
  drive_id: number;
  name: string;
  stage_type: StageType;
  sequence: number;
}

export interface DriveJobRole {
  id: number;
  drive_id: number;
  job_role_id: number;
  role_title_snapshot: string;
  designation_snapshot: string;
  openings?: number;
  package_override?: number; // annual INR
}

export interface Drive {
  id: number;
  company_id: number;
  academic_year_id: number;
  title: string;
  description?: string;
  drive_date: string; // YYYY-MM-DD
  registration_deadline?: string;
  status: DriveStatus;
  criteria_set_id: number;
  notes?: string;
  stages: DriveStage[];
  roles: DriveJobRole[];
  created_at: string;
  updated_at: string;
}

export type EligibilityVerdict = "Eligible" | "Needs Review" | "Ineligible";

export interface RuleExplanation {
  rule_type: RuleType;
  passed: boolean | "unknown";
  detail: string;
}

export interface EligibilityResult {
  id: number;
  drive_id: number;
  student_id: number;
  computed_status: EligibilityVerdict;
  explanation: RuleExplanation[];
  computed_at: string;
}

export interface EligibilityOverride {
  id: number;
  drive_id: number;
  student_id: number;
  override_status: EligibilityVerdict;
  reason: string;
  created_by: number;
  created_at: string;
  removed_at?: string | null;
  removed_by?: number | null;
  removal_reason?: string | null;
}

export type ApplicationOutcome = "Pending" | "Selected" | "Rejected" | "Withdrawn";

export type StageOutcome = "Pending" | "Passed" | "Failed" | "Withdrawn";

export interface ApplicationStageResult {
  id: number;
  application_id: number;
  drive_stage_id: number;
  scheduled_at?: string | null;
  outcome: StageOutcome;
  remarks?: string;
  updated_at: string;
  updated_by: number;
}

export interface ApplicationStageHistory {
  id: number;
  stage_result_id: number;
  previous_outcome?: StageOutcome;
  new_outcome: StageOutcome;
  scheduled_at_snapshot?: string | null;
  remarks?: string;
  changed_by: number;
  changed_at: string;
}

export interface Application {
  id: number;
  drive_id: number;
  student_id: number;
  drive_job_role_id?: number | null;
  applied_date: string;
  final_outcome: ApplicationOutcome;
  remarks?: string;
  stages: ApplicationStageResult[];
  created_at: string;
  updated_at: string;
}

export type OfferStatus = "Pending" | "Accepted" | "Declined" | "Rescinded";
export type JoiningStatus = "Pending" | "Joined" | "Not Joined";

export interface Offer {
  id: number;
  application_id: number;
  offer_date: string;
  designation: string;
  annual_salary: number; // in INR
  offer_status: OfferStatus;
  acceptance_date?: string | null;
  joining_status: JoiningStatus;
  joining_date?: string | null;
  service_period_months?: number | null;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface OfferHistory {
  id: number;
  offer_id: number;
  changed_fields_json: string;
  changed_by: number;
  changed_at: string;
}

export interface AuditLog {
  id: number;
  occurred_at: string;
  user_id: number;
  user_name_snapshot: string;
  action: string;
  entity_type: string;
  entity_id: number | string;
  summary: string;
  before_json?: string;
  after_json?: string;
  reason?: string;
}

export type BackupType = "Scheduled" | "Manual" | "Safety" | "PreMigration";
export type BackupStatus = "Success" | "Failed" | "InProgress";

export interface BackupRecord {
  id: number;
  type: BackupType;
  path: string;
  size_bytes: number;
  sha256: string;
  status: BackupStatus;
  started_at: string;
  finished_at?: string;
  error?: string;
  app_version: string;
  schema_version: number;
  validated_at?: string;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  table_density: "Comfortable" | "Compact";
  default_landing: string;
  date_format: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MMM-YYYY";
  default_export_folder: string;
  default_report_format: "PDF" | "Excel";
  backup_schedule: "Off" | "Daily" | "Weekly";
  backup_location: string;
  backups_to_keep: number;
}
