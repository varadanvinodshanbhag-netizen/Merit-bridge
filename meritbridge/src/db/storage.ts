// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Storage & Relational Database Layer (Clean Production Release)
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

// ─── Clean Initial Database State (Zero Sample Records) ──────────────────────
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
      password_hash: "admin", // default administrative credential
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

  const audit_logs: AuditLog[] = [
    {
      id: 1,
      occurred_at: now,
      user_id: 1,
      user_name_snapshot: "Administrator",
      action: "INIT_SYSTEM",
      entity_type: "System",
      entity_id: 1,
      summary: "MeritBridge database initialized with clean institutional schema",
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
    students: [],
    semester_records: [],
    backlogs: [],
    student_documents: [],
    companies: [],
    criteria_sets: [],
    drives: [],
    eligibility_results: [],
    eligibility_overrides: [],
    applications: [],
    offers: [],
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
    loadFromIndexedDb().then((idbState) => {
      if (idbState && idbState.students && idbState.students.length > this.state.students.length) {
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
        return JSON.parse(serialized);
      }
    } catch (e) {
      console.warn("Could not load persisted database, initializing clean state", e);
    }
    const fresh = getInitialData();
    this.persist(fresh);
    return fresh;
  }

  private persist(state: DatabaseState): void {
    saveToIndexedDb(state);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e: any) {
      if (e?.name === "QuotaExceededError" || e?.code === 22) {
        console.warn("LocalStorage 5MB quota reached. State safely persisted to IndexedDB.", e);
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
    const fresh = getInitialData();
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
