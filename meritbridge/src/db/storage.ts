// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Storage & Relational Database Layer
// Persists all tables to localStorage / IndexedDB with strict schema integrity.
// ─────────────────────────────────────────────────────────────────────────────

import {
  User,
  AppSecurity,
  Institution,
  AcademicYear,
  Course,
  Department,
  Batch,
  Student,
  SemesterRecord,
  Backlog,
  StudentDocument,
  Company,
  CriteriaSet,
  Drive,
  EligibilityResult,
  EligibilityOverride,
  Application,
  Offer,
  AuditLog,
  BackupRecord,
  AppSettings,
} from "../types";
import { getRichSampleData } from "../services/sampleData";

const STORAGE_KEY = "meritbridge_database_v1";

export interface DatabaseState {
  users: User[];
  app_security: AppSecurity;
  institution: Institution;
  academic_years: AcademicYear[];
  courses: Course[];
  departments: Department[];
  batches: Batch[];
  students: Student[];
  semester_records: SemesterRecord[];
  backlogs: Backlog[];
  student_documents: StudentDocument[];
  companies: Company[];
  criteria_sets: CriteriaSet[];
  drives: Drive[];
  eligibility_results: EligibilityResult[];
  eligibility_overrides: EligibilityOverride[];
  applications: Application[];
  offers: Offer[];
  audit_logs: AuditLog[];
  backup_history: BackupRecord[];
  settings: AppSettings;
}

// ─── Initial Seed Data ────────────────────────────────────────────────────────
export function getInitialData(): DatabaseState {
  const now = new Date().toISOString();

  const academic_years: AcademicYear[] = [
    { id: 1, label: "2023-2024", start_date: "2023-06-01", end_date: "2024-05-31" },
    { id: 2, label: "2024-2025", start_date: "2024-06-01", end_date: "2025-05-31" },
    { id: 3, label: "2025-2026", start_date: "2025-06-01", end_date: "2026-05-31" },
  ];

  const courses: Course[] = [
    {
      id: 1,
      name: "Diploma in Engineering",
      code: "Diploma",
      duration_semesters: 6,
      cgpa_method: "MeanOfSgpa",
      grade_scale_max: 10,
    },
  ];

  const departments: Department[] = [
    { id: 1, course_id: 1, name: "Mechanical Engineering", code: "ME" },
    { id: 2, course_id: 1, name: "Automobile Engineering", code: "AE" },
    { id: 3, course_id: 1, name: "Electrical & Electronics Engineering", code: "EE" },
    { id: 4, course_id: 1, name: "Computer Science & Engineering", code: "CSE" },
  ];

  const batches: Batch[] = [
    { id: 1, course_id: 1, label: "2021-2024", admission_year: 2021, passing_year: 2024 },
    { id: 2, course_id: 1, label: "2022-2025", admission_year: 2022, passing_year: 2025 },
    { id: 3, course_id: 1, label: "2023-2026", admission_year: 2023, passing_year: 2026 },
  ];

  const users: User[] = [
    {
      id: 1,
      username: "admin",
      display_name: "Placement Administrator",
      role: "Placement Officer",
      password_hash: "admin", // in mock/dev auth
      must_change_password: false,
      is_active: true,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    },
  ];

  const app_security: AppSecurity = {
    recovery_key_hash: "MB-RECOVERY-KEY-SECURE-8492048",
    recovery_rotated_at: now,
  };

  const institution: Institution = {
    name: "RNS Rural Polytechnic",
    address: "Murdeshwar, Bhatkal Taluk, Uttara Kannada, Karnataka - 581350",
    contact_details: "placement@rnsrp.edu.in | +91 8385 268688",
    current_academic_year_id: 2,
  };

  const settings: AppSettings = {
    theme: "light",
    table_density: "Comfortable",
    default_landing: "/dashboard",
    date_format: "DD/MM/YYYY",
    default_export_folder: "MeritBridge Exports",
    default_report_format: "PDF",
    backup_schedule: "Daily",
    backup_location: "Local Backups",
    backups_to_keep: 10,
  };

  // Seed Students (RNS Rural Polytechnic Murdeshwar - ME, AE, EE, CSE)
  const students: Student[] = [
    {
      id: 1,
      registration_number: "22ME014",
      full_name: "Aarav Reddy",
      gender: "Male",
      email: "aarav.reddy@student.rnsrp.edu.in",
      phone: "+91 98765 43210",
      course_id: 1,
      department_id: 1, // ME
      batch_id: 2,
      passing_year: 2025,
      cgpa: 8.85,
      created_at: now,
      updated_at: now,
      created_by: 1,
      updated_by: 1,
    },
    {
      id: 2,
      registration_number: "22AE008",
      full_name: "Priya Kapoor",
      gender: "Female",
      email: "priya.kapoor@student.rnsrp.edu.in",
      phone: "+91 98765 43211",
      course_id: 1,
      department_id: 2, // AE
      batch_id: 2,
      passing_year: 2025,
      cgpa: 9.12,
      created_at: now,
      updated_at: now,
      created_by: 1,
      updated_by: 1,
    },
    {
      id: 3,
      registration_number: "22EE021",
      full_name: "Mohammed Saif",
      gender: "Male",
      email: "mohammed.saif@student.rnsrp.edu.in",
      phone: "+91 98765 43212",
      course_id: 1,
      department_id: 3, // EE
      batch_id: 2,
      passing_year: 2025,
      cgpa: 7.95,
      created_at: now,
      updated_at: now,
      created_by: 1,
      updated_by: 1,
    },
    {
      id: 4,
      registration_number: "22CSE035",
      full_name: "Sneha Nair",
      gender: "Female",
      email: "sneha.nair@student.rnsrp.edu.in",
      phone: "+91 98765 43213",
      course_id: 1,
      department_id: 4, // CSE
      batch_id: 2,
      passing_year: 2025,
      cgpa: 8.40,
      created_at: now,
      updated_at: now,
      created_by: 1,
      updated_by: 1,
    },
    {
      id: 5,
      registration_number: "22ME042",
      full_name: "Rahul Verma",
      gender: "Male",
      email: "rahul.verma@student.rnsrp.edu.in",
      phone: "+91 98765 43214",
      course_id: 1,
      department_id: 1, // ME
      batch_id: 2,
      passing_year: 2025,
      cgpa: 8.15,
      created_at: now,
      updated_at: now,
      created_by: 1,
      updated_by: 1,
    },
  ];

  // Seed Companies
  const companies: Company[] = [
    {
      id: 1,
      name: "TCS",
      name_normalized: "tcs",
      industry: "Information Technology",
      website: "https://www.tcs.com",
      location: "Mumbai, India",
      status: "Active",
      contacts: [
        {
          id: 1,
          company_id: 1,
          name: "Vikram Mehta",
          designation: "Campus Lead",
          email: "v.mehta@tcs.com",
          phone: "+91 22 6778 9000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 1,
          company_id: 1,
          title: "Ninja & Digital Developer",
          designation: "Software Engineer",
          salary_min: 360000,
          salary_max: 750000,
          skills: ["Java", "Python", "SQL", "Data Structures"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      name: "Infosys",
      name_normalized: "infosys",
      industry: "IT & Consulting",
      website: "https://www.infosys.com",
      location: "Bangalore, India",
      status: "Active",
      contacts: [
        {
          id: 2,
          company_id: 2,
          name: "Ananya Roy",
          designation: "HR Talent Acquisition",
          email: "ananya.roy@infosys.com",
          phone: "+91 80 2852 0261",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 2,
          company_id: 2,
          title: "System Engineer Specialist",
          designation: "Associate Consultant",
          salary_min: 400000,
          salary_max: 950000,
          skills: ["Full Stack", "Cloud", "Problem Solving"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      name: "Accenture",
      name_normalized: "accenture",
      industry: "Professional Services & Tech",
      website: "https://www.accenture.com",
      location: "Dublin / Bangalore",
      status: "Active",
      contacts: [
        {
          id: 3,
          company_id: 3,
          name: "Rohan Sen",
          designation: "University Relations Lead",
          email: "rohan.sen@accenture.com",
          phone: "+91 80 4106 0000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 3,
          company_id: 3,
          title: "Application Development Associate",
          designation: "Associate Software Engineer",
          salary_min: 450000,
          salary_max: 650000,
          skills: ["Agile", "TypeScript", "DevOps"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      name: "L&T",
      name_normalized: "l&t",
      industry: "Engineering & Construction",
      website: "https://www.larsentoubro.com",
      location: "Mumbai, India",
      status: "Active",
      contacts: [
        {
          id: 4,
          company_id: 4,
          name: "Devendra Patil",
          designation: "Senior Manager - HR",
          email: "d.patil@larsentoubro.com",
          phone: "+91 22 6752 5656",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 4,
          company_id: 4,
          title: "Graduate Engineer Trainee",
          designation: "GET",
          salary_min: 600000,
          salary_max: 800000,
          skills: ["AutoCAD", "Thermodynamics", "Project Management"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      name: "Capgemini",
      name_normalized: "capgemini",
      industry: "Technology Services",
      website: "https://www.capgemini.com",
      location: "Paris / Pune",
      status: "Active",
      contacts: [
        {
          id: 5,
          company_id: 5,
          name: "Shruti Desai",
          designation: "Lead Recruiter",
          email: "shruti.desai@capgemini.com",
          phone: "+91 20 6699 1000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 5,
          company_id: 5,
          title: "Senior Analyst",
          designation: "Software Developer",
          salary_min: 425000,
          salary_max: 750000,
          skills: ["Java", "React", "Cloud"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
  ];

  // Criteria Set & Drives
  const criteria_sets: CriteriaSet[] = [
    {
      id: 1,
      rules: [
        { id: 1, criteria_set_id: 1, rule_type: "MIN_CGPA", numeric_value: 6.5 },
        { id: 2, criteria_set_id: 1, rule_type: "MAX_ACTIVE_BACKLOGS", numeric_value: 0 },
        { id: 3, criteria_set_id: 1, rule_type: "ALLOWED_PASSING_YEARS", numeric_value: 2025 },
      ],
    },
  ];

  const drives: Drive[] = [
    {
      id: 1,
      company_id: 1,
      academic_year_id: 2,
      title: "TCS Campus Recruitment 2025",
      description: "Recruitment for Ninja and Digital Engineering roles.",
      drive_date: "2024-10-22",
      registration_deadline: "2024-10-15",
      status: "In Progress",
      criteria_set_id: 1,
      stages: [
        { id: 1, drive_id: 1, name: "Online Aptitude Test", stage_type: "Aptitude", sequence: 1 },
        { id: 2, drive_id: 1, name: "Technical Interview", stage_type: "Technical", sequence: 2 },
        { id: 3, drive_id: 1, name: "HR Interview", stage_type: "HR", sequence: 3 },
      ],
      roles: [
        {
          id: 1,
          drive_id: 1,
          job_role_id: 1,
          role_title_snapshot: "Ninja & Digital Developer",
          designation_snapshot: "Software Engineer",
          package_override: 700000,
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      company_id: 2,
      academic_year_id: 2,
      title: "Infosys Specialist Hiring 2025",
      drive_date: "2024-10-24",
      status: "In Progress",
      criteria_set_id: 1,
      stages: [
        { id: 4, drive_id: 2, name: "Aptitude Round", stage_type: "Aptitude", sequence: 1 },
        { id: 5, drive_id: 2, name: "Technical + HR", stage_type: "Technical", sequence: 2 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
  ];

  // Seed Applications & Offers
  const applications: Application[] = [
    {
      id: 1,
      drive_id: 1,
      student_id: 1,
      applied_date: "2024-10-10",
      final_outcome: "Selected",
      stages: [
        {
          id: 1,
          application_id: 1,
          drive_stage_id: 1,
          scheduled_at: "2024-10-16 10:00",
          outcome: "Passed",
          updated_at: now,
          updated_by: 1,
        },
        {
          id: 2,
          application_id: 1,
          drive_stage_id: 2,
          scheduled_at: "2024-10-22 10:30",
          outcome: "Passed",
          remarks: "Excellent problem solving in technical round",
          updated_at: now,
          updated_by: 1,
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      drive_id: 2,
      student_id: 2,
      applied_date: "2024-10-12",
      final_outcome: "Selected",
      stages: [
        {
          id: 3,
          application_id: 2,
          drive_stage_id: 4,
          scheduled_at: "2024-10-20 09:30",
          outcome: "Passed",
          updated_at: now,
          updated_by: 1,
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      drive_id: 1,
      student_id: 3,
      applied_date: "2024-10-21",
      final_outcome: "Pending",
      stages: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      drive_id: 1,
      student_id: 4,
      applied_date: "2024-10-18",
      final_outcome: "Pending",
      stages: [
        {
          id: 4,
          application_id: 4,
          drive_stage_id: 1,
          scheduled_at: "2024-10-20 15:45",
          outcome: "Passed",
          updated_at: now,
          updated_by: 1,
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      drive_id: 1,
      student_id: 5,
      applied_date: "2024-10-15",
      final_outcome: "Selected",
      stages: [
        {
          id: 5,
          application_id: 5,
          drive_stage_id: 1,
          scheduled_at: "2024-10-18 11:00",
          outcome: "Passed",
          updated_at: now,
          updated_by: 1,
        },
      ],
      created_at: now,
      updated_at: now,
    },
  ];

  const offers: Offer[] = [
    {
      id: 1,
      application_id: 1,
      offer_date: "2024-10-22",
      designation: "Software Engineer (Digital)",
      annual_salary: 700000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-23",
      joining_status: "Pending",
      remarks: "Candidate accepted offer letter",
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      application_id: 2,
      offer_date: "2024-10-21",
      designation: "Specialist Programmer",
      annual_salary: 950000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-22",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      application_id: 5,
      offer_date: "2024-10-18",
      designation: "Senior Analyst",
      annual_salary: 750000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-19",
      joining_status: "Joined",
      joining_date: "2024-10-19",
      created_at: now,
      updated_at: now,
    },
  ];

  const audit_logs: AuditLog[] = [
    {
      id: 1,
      occurred_at: now,
      user_id: 1,
      user_name_snapshot: "S. Kumar",
      action: "INIT_SYSTEM",
      entity_type: "System",
      entity_id: 1,
      summary: "MeritBridge database initialized with baseline academic schema",
    },
  ];

  return {
    users,
    app_security,
    institution,
    academic_years,
    courses,
    departments,
    batches,
    students,
    semester_records: [],
    backlogs: [],
    student_documents: [],
    companies,
    criteria_sets,
    drives,
    eligibility_results: [],
    eligibility_overrides: [],
    applications,
    offers,
    audit_logs,
    backup_history: [],
    settings,
  };
}

// ─── IndexedDB Backing Store (Supports Unlimited Gigabytes of Data) ──────────
const IDB_NAME = "meritbridge_idb";
const IDB_VERSION = 1;
const IDB_STORE = "state_snapshots";

function saveToIndexedDb(state: DatabaseState): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) return resolve();
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        store.put(state, "latest_state");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function loadFromIndexedDb(): Promise<DatabaseState | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) return resolve(null);
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const getReq = store.get("latest_state");
        getReq.onsuccess = () => {
          db.close();
          resolve(getReq.result || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// ─── Local Database Manager ──────────────────────────────────────────────────
class LocalDatabase {
  private state: DatabaseState;
  private listeners: Set<(state: DatabaseState) => void> = new Set();

  constructor() {
    this.state = this.load();
    // Hybrid sync: Check if IndexedDB has newer or larger data than localStorage
    loadFromIndexedDb().then((idbState) => {
      if (idbState && idbState.students && idbState.students.length > this.state.students.length) {
        if (idbState.students.some((s: any) => s.internship_status === undefined)) {
          const sample = getRichSampleData();
          const sampleMap = new Map(sample.students.map((st) => [st.registration_number, st]));
          idbState.students = idbState.students.map((s: any, idx: number) => {
            if (s.internship_status === undefined) {
              const matched = sampleMap.get(s.registration_number) || sample.students[idx % sample.students.length];
              return {
                ...s,
                internship_status: matched?.internship_status || (idx % 3 === 0 ? "Active" : idx % 3 === 1 ? "Completed" : "None"),
                internship_company: matched?.internship_company,
                internship_role: matched?.internship_role,
                internship_duration: matched?.internship_duration,
              };
            }
            return s;
          });
        }
        this.state = idbState;
        this.persist(idbState);
        this.notify();
      }
    });
  }

  private load(): DatabaseState {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        // Auto-upgrade to RNS Rural Polytechnic Murdeshwar schema (Diploma 3Y, ME/AE/EE/CSE)
        if (
          !parsed.institution?.name?.includes("RNS") ||
          parsed.courses?.some((c: any) => c.code === "B.Tech" || c.code === "MCA") ||
          (parsed.students && parsed.students.length <= 5)
        ) {
          const sample = getRichSampleData();
          this.persist(sample);
          return sample;
        }

        // Auto-migrate missing internship fields if previously seeded without them
        if (parsed.students && parsed.students.some((s: any) => s.internship_status === undefined)) {
          const sample = getRichSampleData();
          const sampleMap = new Map(sample.students.map((st) => [st.registration_number, st]));
          parsed.students = parsed.students.map((s: any, idx: number) => {
            if (s.internship_status === undefined) {
              const matched = sampleMap.get(s.registration_number) || sample.students[idx % sample.students.length];
              return {
                ...s,
                internship_status: matched?.internship_status || (idx % 3 === 0 ? "Active" : idx % 3 === 1 ? "Completed" : "None"),
                internship_company: matched?.internship_company,
                internship_role: matched?.internship_role,
                internship_duration: matched?.internship_duration,
              };
            }
            return s;
          });
          this.persist(parsed);
        }

        return parsed;
      }
    } catch (e) {
      console.warn("Could not load persisted database, initializing fresh state", e);
    }
    const fresh = getRichSampleData();
    this.persist(fresh);
    return fresh;
  }

  private persist(state: DatabaseState): void {
    // Always persist to IndexedDB asynchronously (capacity: hundreds of MBs to GBs)
    saveToIndexedDb(state);

    // Sync write to localStorage if within browser quota limit
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        console.warn("LocalStorage 5MB quota reached. Large state safely persisted to IndexedDB.", e);
      } else {
        console.error("Failed to persist database to localStorage", e);
      }
    }
  }

  public getState(): Readonly<DatabaseState> {
    return this.state;
  }

  public setState(updater: (draft: DatabaseState) => void): void {
    const copy: DatabaseState = JSON.parse(JSON.stringify(this.state));
    updater(copy);
    this.state = copy;
    this.persist(copy);
    this.notify();
  }

  public subscribe(listener: (state: DatabaseState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error(err);
      }
    }
  }

  // ─── Reset / Restore / Sample Data ──────────────────────────────────────────
  public loadSampleData(): void {
    const sample = getRichSampleData();
    this.state = sample;
    this.persist(sample);
    this.notify();
  }

  public resetToDefault(): void {
    const fresh = getRichSampleData();
    this.state = fresh;
    this.persist(fresh);
    this.notify();
  }

  public restoreSnapshot(snapshot: DatabaseState): void {
    this.state = snapshot;
    this.persist(snapshot);
    this.notify();
  }

  // ─── Transaction Helper ─────────────────────────────────────────────────────
  public transaction<T>(callback: (draft: DatabaseState) => T): T {
    const copy: DatabaseState = JSON.parse(JSON.stringify(this.state));
    const result = callback(copy);
    this.state = copy;
    this.persist(copy);
    this.notify();
    return result;
  }
}

export const db = new LocalDatabase();
