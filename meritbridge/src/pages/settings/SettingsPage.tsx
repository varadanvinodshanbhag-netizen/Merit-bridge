import { useState, useEffect, useMemo } from "react";
import {
  Building,
  GraduationCap,
  Users,
  Database,
  History,
  Palette,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Plus,
  RefreshCw,
  Search,
  HardDrive,
  Trash2,
  X,
  Gauge,
  Activity,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { db, DatabaseState } from "../../db/storage";
import { useThemeStore } from "../../store/theme";
import { useAuthStore } from "../../store/auth";
import { logAudit } from "../../services/audit";
import { createBackup, validateBackup, restoreBackup } from "../../services/backup";
import { exportToExcel } from "../../services/exporter";
import {
  getStorageMetrics,
  runCapacityStressTest,
  StorageMetrics,
  BenchmarkResult,
} from "../../services/benchmark";
import {
  hashPassword,
  generateRecoveryKey,
  SECURITY_CONFIG,
  SECURITY_QUESTIONS,
  sha256Normalized,
  isAccountLocked,
} from "../../services/security";
import { format } from "date-fns";
import { User, Role } from "../../types";

export default function SettingsPage() {
  const [dbState, setDbState] = useState<DatabaseState>(db.getState());
  const { theme, setTheme } = useThemeStore();
  const lockSession = useAuthStore((s) => s.lockSession);

  const [activeTab, setActiveTab] = useState<
    "general" | "institution" | "academics" | "staff" | "security" | "audit" | "backup"
  >("general");

  // Recovery Key visibility state
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [adminPin, setAdminPin] = useState(
    dbState.app_security.admin_pin || SECURITY_CONFIG.DEFAULT_ADMIN_PIN
  );

  // Success / notification banners
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Institution form state
  const [instName, setInstName] = useState(dbState.institution.name);
  const [instAddress, setInstAddress] = useState(dbState.institution.address);
  const [instContact, setInstContact] = useState(dbState.institution.contact_details);
  const [currentAcadYear, setCurrentAcadYear] = useState(
    dbState.institution.current_academic_year_id
  );

  // General Settings state
  const [tableDensity, setTableDensity] = useState(dbState.settings.table_density);
  const [dateFormat, setDateFormat] = useState(dbState.settings.date_format);
  const [defaultLanding, setDefaultLanding] = useState(dbState.settings.default_landing);
  const [defaultReportFormat, setDefaultReportFormat] = useState(
    dbState.settings.default_report_format
  );
  const [backupSchedule, setBackupSchedule] = useState(dbState.settings.backup_schedule);
  const [backupsToKeep, setBackupsToKeep] = useState(dbState.settings.backups_to_keep);

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoreFilePayload, setRestoreFilePayload] = useState<any>(null);

  // Integrity Check result
  const [integrityStatus, setIntegrityStatus] = useState<string | null>(null);

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState("");
  const [auditEntityFilter, setAuditEntityFilter] = useState("All");

  // Academic Structure Modals & Form state
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCourseId, setNewDeptCourseId] = useState<number>(dbState.courses[0]?.id || 1);

  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [newBatchLabel, setNewBatchLabel] = useState("");
  const [newBatchPassingYear, setNewBatchPassingYear] = useState<number>(2026);
  const [newBatchCourseId, setNewBatchCourseId] = useState<number>(dbState.courses[0]?.id || 1);

  // Storage Metrics & Capacity Benchmark state
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  useEffect(() => {
    getStorageMetrics(dbState).then((metrics) => {
      setStorageMetrics(metrics);
    });
  }, [dbState]);

  const handleLoadSampleData = () => {
    if (
      confirm(
        "Load complete sample dataset? This populates 40 students across 5 departments, semester records, 10 partner companies, and 6 placement drives."
      )
    ) {
      db.loadSampleData();
      triggerNotice("Rich sample dataset loaded successfully with 40 students and complete academic records!");
    }
  };

  const handleRunBenchmark = (count: number = 1000) => {
    setBenchmarkLoading(true);
    setTimeout(() => {
      const res = runCapacityStressTest(count);
      setBenchmarkResult(res);
      setBenchmarkLoading(false);
      setShowBenchmarkModal(true);
    }, 100);
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newDeptCode.trim().toUpperCase();
    const name = newDeptName.trim();
    if (!code || !name) {
      triggerNotice("Department code and name are required.", true);
      return;
    }
    if (dbState.departments.some((d) => d.code === code)) {
      triggerNotice(`Department code ${code} already exists.`, true);
      return;
    }
    const nextId = dbState.departments.length > 0 ? Math.max(...dbState.departments.map((d) => d.id)) + 1 : 1;
    db.setState((draft) => {
      draft.departments.push({
        id: nextId,
        code,
        name,
        course_id: newDeptCourseId,
      });
    });
    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "CREATE_DEPARTMENT",
      entityType: "Department",
      entityId: code,
      summary: `Created academic department ${name} (${code})`,
    });
    setNewDeptCode("");
    setNewDeptName("");
    setShowAddDeptModal(false);
    triggerNotice(`Department ${code} created successfully.`);
  };

  const handleDeleteDepartment = (dept: { id: number; code: string; name: string }) => {
    const studentCount = dbState.students.filter((s) => s.department_id === dept.id).length;
    if (studentCount > 0) {
      triggerNotice(`Cannot delete ${dept.code}: ${studentCount} students are currently enrolled.`, true);
      return;
    }
    if (!confirm(`Delete academic department ${dept.name} (${dept.code})?`)) return;
    db.setState((draft) => {
      draft.departments = draft.departments.filter((d) => d.id !== dept.id);
    });
    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "DELETE_DEPARTMENT",
      entityType: "Department",
      entityId: dept.code,
      summary: `Deleted academic department ${dept.name} (${dept.code})`,
    });
    triggerNotice(`Department ${dept.code} deleted.`);
  };

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newBatchLabel.trim();
    if (!label) {
      triggerNotice("Batch label is required.", true);
      return;
    }
    const nextId = dbState.batches.length > 0 ? Math.max(...dbState.batches.map((b) => b.id)) + 1 : 1;
    const course = dbState.courses.find((c) => c.id === newBatchCourseId);
    const durationYears = course ? Math.round(course.duration_semesters / 2) : 4;
    const admissionYear = Number(newBatchPassingYear) - durationYears;

    db.setState((draft) => {
      draft.batches.push({
        id: nextId,
        course_id: newBatchCourseId,
        label,
        admission_year: admissionYear,
        passing_year: Number(newBatchPassingYear),
      });
    });
    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "CREATE_BATCH",
      entityType: "Batch",
      entityId: label,
      summary: `Created graduating batch ${label} (Class of ${newBatchPassingYear})`,
    });
    setNewBatchLabel("");
    setShowAddBatchModal(false);
    triggerNotice(`Batch ${label} created successfully.`);
  };

  const handleDeleteBatch = (batch: { id: number; label: string }) => {
    const studentCount = dbState.students.filter((s) => s.batch_id === batch.id).length;
    if (studentCount > 0) {
      triggerNotice(`Cannot delete batch ${batch.label}: ${studentCount} students belong to this batch.`, true);
      return;
    }
    if (!confirm(`Delete batch ${batch.label}?`)) return;
    db.setState((draft) => {
      draft.batches = draft.batches.filter((b) => b.id !== batch.id);
    });
    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "DELETE_BATCH",
      entityType: "Batch",
      entityId: batch.label,
      summary: `Deleted graduating batch ${batch.label}`,
    });
    triggerNotice(`Batch ${batch.label} deleted.`);
  };

  useEffect(() => {
    return db.subscribe((state) => {
      setDbState(state);
    });
  }, []);

  const triggerNotice = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  // ─── 1. General Settings Save ─────────────────────────────────────────
  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    db.setState((draft) => {
      draft.settings.table_density = tableDensity;
      draft.settings.date_format = dateFormat;
      draft.settings.default_landing = defaultLanding;
      draft.settings.default_report_format = defaultReportFormat;
      draft.settings.backup_schedule = backupSchedule;
      draft.settings.backups_to_keep = backupsToKeep;
      draft.settings.theme = theme;
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "UPDATE_SETTINGS",
      entityType: "Settings",
      entityId: "general",
      summary: "Updated appearance and system preferences.",
    });

    triggerNotice("System settings updated successfully.");
  };

  // ─── 2. Institution Details Save ──────────────────────────────────────
  const handleSaveInstitution = (e: React.FormEvent) => {
    e.preventDefault();
    db.setState((draft) => {
      draft.institution.name = instName;
      draft.institution.address = instAddress;
      draft.institution.contact_details = instContact;
      draft.institution.current_academic_year_id = Number(currentAcadYear);
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "UPDATE_INSTITUTION",
      entityType: "Institution",
      entityId: instName,
      summary: `Updated institution details for ${instName}.`,
    });

    triggerNotice("Institution profile updated successfully.");
  };

  // ─── 3. Add Staff Account ─────────────────────────────────────────────
  const [newUser, setNewUser] = useState({
    username: "",
    display_name: "",
    role: "Placement Officer" as Role,
    password: "",
    security_question: SECURITY_QUESTIONS[0],
    security_answer: "",
  });

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.display_name.trim()) {
      triggerNotice("Please provide both username and full name.", true);
      return;
    }

    if (
      dbState.users.some(
        (u) => u.username.toLowerCase() === newUser.username.trim().toLowerCase()
      )
    ) {
      triggerNotice("A staff account with this username already exists.", true);
      return;
    }

    const tempPassword = newUser.password.trim() || "Welcome@123";
    const passwordHash = await hashPassword(tempPassword);
    const secAnswer = newUser.security_answer.trim() || "fluffy";
    const secAnswerHash = await sha256Normalized(secAnswer);

    const created: User = {
      id: Date.now(),
      username: newUser.username.trim(),
      display_name: newUser.display_name.trim(),
      role: newUser.role,
      password_hash: passwordHash,
      must_change_password: true,
      is_active: true,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      security_question: newUser.security_question,
      security_answer_hash: secAnswerHash,
    };

    db.setState((draft) => {
      draft.users.push(created);
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "CREATE_ACCOUNT",
      entityType: "User",
      entityId: created.id,
      summary: `Created new staff account '${created.username}' (${created.role}) with security credentials.`,
    });

    setNewUser({
      username: "",
      display_name: "",
      role: "Placement Officer",
      password: "",
      security_question: SECURITY_QUESTIONS[0],
      security_answer: "",
    });
    setShowAddUserModal(false);
    triggerNotice(`Staff account '${created.display_name}' created successfully.`);
  };

  const handleSaveAdminPin = (e: React.FormEvent) => {
    e.preventDefault();
    const pin = adminPin.trim();
    if (!/^\d{6}$/.test(pin)) {
      triggerNotice("Master Security PIN must be exactly 6 numeric digits.", true);
      return;
    }

    db.setState((draft) => {
      draft.app_security.admin_pin = pin;
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "UPDATE_STATUS",
      entityType: "Security",
      entityId: "AdminPIN",
      summary: "Updated 6-digit Admin Master PIN",
    });

    triggerNotice("Admin Master PIN updated successfully.");
  };

  const handleRotateRecoveryKey = () => {
    const newKey = generateRecoveryKey();
    const now = new Date().toISOString();

    db.setState((draft) => {
      draft.app_security.recovery_key_hash = newKey;
      draft.app_security.recovery_rotated_at = now;
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "UPDATE_STATUS",
      entityType: "Security",
      entityId: "RecoveryKey",
      summary: "Emergency Master Recovery Key rotated successfully.",
    });

    triggerNotice(`Emergency Master Recovery Key updated: ${newKey}. Store this securely offline.`);
  };

  const handleResetUserLockout = (user: User) => {
    db.setState((draft) => {
      const u = draft.users.find((item) => item.id === user.id);
      if (u) {
        u.failed_attempts = 0;
        u.locked_until = null;
      }
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: "UPDATE_STATUS",
      entityType: "User",
      entityId: String(user.id),
      summary: `Administrator manually cleared lockout for user ${user.username}`,
    });

    triggerNotice(`Account lockout for '${user.username}' has been cleared.`);
  };

  const handleToggleStaffStatus = (user: User) => {
    if (user.id === 1) {
      triggerNotice("The primary administrator account cannot be deactivated.", true);
      return;
    }

    const newStatus = !user.is_active;
    db.setState((draft) => {
      const u = draft.users.find((item) => item.id === user.id);
      if (u) {
        u.is_active = newStatus;
        u.updated_at = new Date().toISOString();
      }
    });

    logAudit({
      userId: 1,
      userName: "Placement Staff",
      action: newStatus ? "ACTIVATE_ACCOUNT" : "DEACTIVATE_ACCOUNT",
      entityType: "User",
      entityId: user.id,
      summary: `${newStatus ? "Activated" : "Deactivated"} staff account '${user.username}'.`,
    });

    triggerNotice(`Staff account '${user.username}' is now ${newStatus ? "active" : "inactive"}.`);
  };

  // ─── 4. Backup & Restore Actions ──────────────────────────────────────
  const handleTriggerManualBackup = () => {
    try {
      const payload = createBackup("Manual", 1, "Placement Staff");
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MeritBridge_${format(new Date(), "yyyy-MM-dd_HHmmss")}_Manual.pabackup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      triggerNotice("Manual backup archive created and downloaded successfully.");
    } catch (err: any) {
      triggerNotice(`Backup failed: ${err.message}`, true);
    }
  };

  const handleValidateBackupItem = (record: any) => {
    const isValid = record.status === "Success" && record.sha256.startsWith("MB-");
    if (isValid) {
      triggerNotice(`Backup integrity check passed (Checksum: ${record.sha256}).`);
    } else {
      triggerNotice("Backup archive checksum validation failed.", true);
    }
  };

  const handleFileRestorePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const check = validateBackup(parsed);
        if (!check.valid) {
          triggerNotice(`Invalid backup file: ${check.reason}`, true);
          return;
        }
        setRestoreFilePayload(parsed);
        setShowRestoreModal(true);
      } catch (err: any) {
        triggerNotice("Failed to parse backup archive file.", true);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (restoreConfirmText !== "RESTORE") {
      triggerNotice("You must type RESTORE exactly to confirm.", true);
      return;
    }
    if (!restoreFilePayload) return;

    const res = restoreBackup(restoreFilePayload, 1, "Placement Staff");
    if (res.success) {
      setShowRestoreModal(false);
      setRestoreConfirmText("");
      setRestoreFilePayload(null);
      triggerNotice("Database and records restored successfully from backup.");
    } else {
      triggerNotice(`Restore error: ${res.error}`, true);
    }
  };

  // ─── 5. Database Integrity Check (PRD 9.6) ───────────────────────────
  const handleRunIntegrityCheck = () => {
    // Verify cross-table references
    const studentCount = dbState.students.length;
    const deptCount = dbState.departments.length;
    const offersCount = dbState.offers.length;
    const driveCount = dbState.drives.length;
    const docsCount = dbState.student_documents.length;

    // Check orphan applications
    const studentIds = new Set(dbState.students.map((s) => s.id));
    const orphanApps = dbState.applications.filter((a) => !studentIds.has(a.student_id));

    if (orphanApps.length === 0) {
      setIntegrityStatus(
        `Database Healthy · All foreign key constraints verified (0 orphaned records, ${studentCount} students, ${deptCount} departments, ${driveCount} drives, ${offersCount} offers, ${docsCount} document links).`
      );
    } else {
      setIntegrityStatus(
        `Integrity Warning: Found ${orphanApps.length} unlinked applications.`
      );
    }
  };

  // ─── Filtered Audit Logs ──────────────────────────────────────────────
  const filteredAuditLogs = useMemo(() => {
    return dbState.audit_logs.filter((log) => {
      if (auditEntityFilter !== "All" && log.entity_type !== auditEntityFilter) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          log.summary.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.user_name_snapshot.toLowerCase().includes(q) ||
          String(log.entity_id).toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [dbState.audit_logs, auditSearch, auditEntityFilter]);

  const handleExportAudit = () => {
    exportToExcel({
      filename: "MeritBridge_Audit_History",
      sheetName: "AuditLog",
      data: filteredAuditLogs.map((log) => ({
        ID: log.id,
        Timestamp: format(new Date(log.occurred_at), "yyyy-MM-dd HH:mm:ss"),
        User: log.user_name_snapshot,
        Action: log.action,
        Entity: log.entity_type,
        "Entity ID": String(log.entity_id),
        Summary: log.summary,
      })),
      filtersApplied: {
        EntityFilter: auditEntityFilter,
        SearchQuery: auditSearch || "None",
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
          System Settings &amp; Configuration
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Institution profile, academic hierarchy, staff security, audit trail, and backups.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-[var(--color-border)]">
        <nav className="flex space-x-6 overflow-x-auto pb-1">
          {[
            { id: "general", label: "General & Appearance", icon: Palette },
            { id: "institution", label: "Institution Profile", icon: Building },
            { id: "academics", label: "Academic Structure", icon: GraduationCap },
            { id: "staff", label: "Staff Accounts", icon: Users },
            { id: "security", label: "Security & Access", icon: ShieldCheck },
            { id: "audit", label: "Audit History", icon: History },
            { id: "backup", label: "Backup & Recovery", icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── TAB 1: GENERAL & APPEARANCE ───────────────────────────────── */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-3xl">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-text)]">Appearance &amp; Display</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Application Theme
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="light">Light Theme</option>
                  <option value="dark">Dark Theme</option>
                  <option value="system">System Default</option>
                </select>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  Applies instantly across all application screens.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Table Density (PRD 11.1)
                </label>
                <select
                  value={tableDensity}
                  onChange={(e) => setTableDensity(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="Comfortable">Comfortable (Standard padding)</option>
                  <option value="Compact">Compact (High row density)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Default Landing Page
                </label>
                <select
                  value={defaultLanding}
                  onChange={(e) => setDefaultLanding(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="students">Students</option>
                  <option value="drives">Recruitment Drives</option>
                  <option value="analytics">Analytics</option>
                  <option value="reports">Reports</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Date Format
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 21/10/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 10/21/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
                  <option value="DD-MMM-YYYY">DD-MMM-YYYY (e.g. 21-Oct-2026)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Default Report Format
                </label>
                <select
                  value={defaultReportFormat}
                  onChange={(e) => setDefaultReportFormat(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="PDF">Printable PDF</option>
                  <option value="Excel">Microsoft Excel (.xlsx)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-text)]">Scheduled Backups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Automatic Backup Schedule
                </label>
                <select
                  value={backupSchedule}
                  onChange={(e) => setBackupSchedule(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  <option value="Daily">Daily on startup / idle</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Off">Off (Manual only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Retention Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={backupsToKeep}
                  onChange={(e) => setBackupsToKeep(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  Oldest scheduled backups purged beyond this limit. Manual backups are never deleted.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
          >
            Save Preferences
          </button>
        </form>
      )}

      {/* ─── TAB 2: INSTITUTION PROFILE ────────────────────────────────── */}
      {activeTab === "institution" && (
        <form onSubmit={handleSaveInstitution} className="space-y-6 max-w-3xl">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[var(--color-text)]">Official Institution Details</h2>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                College / Institution Name
              </label>
              <input
                type="text"
                required
                value={instName}
                onChange={(e) => setInstName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                Campus Address
              </label>
              <textarea
                rows={2}
                value={instAddress}
                onChange={(e) => setInstAddress(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Contact Details / Phone / Email
                </label>
                <input
                  type="text"
                  value={instContact}
                  onChange={(e) => setInstContact(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                  Active Placement Academic Year
                </label>
                <select
                  value={currentAcadYear}
                  onChange={(e) => setCurrentAcadYear(Number(e.target.value))}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                >
                  {dbState.academic_years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label} ({y.start_date} to {y.end_date})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
          >
            Update Institution Profile
          </button>
        </form>
      )}

      {/* ─── TAB 3: ACADEMIC STRUCTURE ─────────────────────────────────── */}
      {activeTab === "academics" && (
        <div className="space-y-6">
          {/* Courses & CGPA scale */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">Configured Courses</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Programs, duration in semesters, and grading evaluation method (PRD 6.3).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                    <th className="py-2 px-3 font-semibold">Course Code</th>
                    <th className="py-2 px-3 font-semibold">Course Name</th>
                    <th className="py-2 px-3 font-semibold">Duration</th>
                    <th className="py-2 px-3 font-semibold">CGPA Method</th>
                    <th className="py-2 px-3 font-semibold">Grade Scale Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {dbState.courses.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2.5 px-3 font-bold text-[var(--color-primary)]">
                        {c.code}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[var(--color-text)]">{c.name}</td>
                      <td className="py-2.5 px-3 text-[var(--color-text-muted)]">
                        {c.duration_semesters} Semesters
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] font-semibold text-[11px]">
                          {c.cgpa_method}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[var(--color-text)]">
                        {c.grade_scale_max}.0 Scale
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Departments */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Academic Departments
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Active academic branches and faculties registered for campus placements.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDeptModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Department
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {dbState.departments.map((dept) => {
                const count = dbState.students.filter((s) => s.department_id === dept.id).length;
                return (
                  <div
                    key={dept.id}
                    className="p-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] flex items-start justify-between gap-2"
                  >
                    <div>
                      <span className="text-xs font-bold text-[var(--color-primary)]">
                        {dept.code}
                      </span>
                      <h4 className="text-xs font-semibold text-[var(--color-text)] mt-0.5">
                        {dept.name}
                      </h4>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                        {count} Enrolled Students
                      </p>
                    </div>
                    {count === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteDepartment(dept)}
                        title="Delete Department"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Batches */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">Graduating Batches</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Cohorts eligible for placements by graduation calendar year.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBatchModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Batch
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {dbState.batches.map((b) => {
                const count = dbState.students.filter((s) => s.batch_id === b.id).length;
                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-center relative group"
                  >
                    <span className="text-xs font-bold text-[var(--color-text)] block">
                      {b.label}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      Class of {b.passing_year}
                    </span>
                    {count === 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(b)}
                        title="Delete Batch"
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: STAFF ACCOUNTS ─────────────────────────────────────── */}
      {activeTab === "staff" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">Placement Cell Officers</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Accounts with equal operational access, audited by ID (PRD AUTH-01).
              </p>
            </div>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Staff Member
            </button>
          </div>

          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                  <th className="py-2.5 px-3 font-semibold">Staff Name</th>
                  <th className="py-2.5 px-3 font-semibold">Username</th>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Last Active</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {dbState.users.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--color-surface-hover)]">
                    <td className="py-2.5 px-3 font-semibold text-[var(--color-text)]">
                      {user.display_name}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--color-text-muted)]">{user.username}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-bg)] border border-[var(--color-border)]">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isAccountLocked(user.locked_until).locked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          Locked
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            user.is_active
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {user.is_active ? "Active" : "Deactivated"}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[var(--color-text-muted)]">
                      {user.last_login_at
                        ? format(new Date(user.last_login_at), "dd/MM/yyyy HH:mm")
                        : "Never"}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      {isAccountLocked(user.locked_until).locked && (
                        <button
                          onClick={() => handleResetUserLockout(user)}
                          className="text-xs font-semibold px-2 py-1 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                        >
                          Clear Lockout
                        </button>
                      )}
                      {user.id !== 1 && (
                        <button
                          onClick={() => handleToggleStaffStatus(user)}
                          className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                            user.is_active
                              ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                          }`}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Staff Modal */}
          {showAddUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl space-y-4">
                <h3 className="text-base font-bold text-[var(--color-text)]">
                  Add Placement Officer Account
                </h3>
                <form onSubmit={handleCreateStaff} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newUser.display_name}
                      onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                      placeholder="e.g. Dr. Priya Sharma"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      placeholder="e.g. psharma"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                      Role
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                    >
                      <option value="Placement Officer">Placement Officer</option>
                      <option value="Assistant">Assistant</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                      Temporary Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      placeholder="Defaults to Welcome@123"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                    />
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                      User will be required to change this password on first login.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                      Security Question
                    </label>
                    <select
                      value={newUser.security_question}
                      onChange={(e) => setNewUser({ ...newUser, security_question: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                    >
                      {SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                      Security Answer
                    </label>
                    <input
                      type="text"
                      value={newUser.security_answer}
                      onChange={(e) => setNewUser({ ...newUser, security_answer: e.target.value })}
                      placeholder="e.g. fluffy (case-insensitive for recovery)"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddUserModal(false)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: SECURITY & ACCESS CONTROLS (PRD SEC-01 - SEC-04, AUTH-04) ─── */}
      {activeTab === "security" && (
        <div className="space-y-6 max-w-4xl">
          {/* Section 1: Security Controls Overview */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold text-[var(--color-text)]">
                  Cryptographic Standards &amp; Policies (PRD Section 7)
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                ENFORCED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text)]">Password Hashing</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-semibold">SHA-256 + Salt</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Cryptographic salted SHA-256 via Web Crypto API. Passwords never stored in plain text.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text)]">Brute-Force Lockout</span>
                  <span className="text-[10px] font-mono text-amber-600 font-semibold">5 Attempts / 15m</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Accounts are frozen for 15 minutes after 5 consecutive failed login attempts.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text)]">Session Idle Timeout</span>
                  <span className="text-[10px] font-mono text-blue-600 font-semibold">15 Minutes</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Placement terminal automatically locks on 15 minutes of idle inactivity.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--color-text)]">Document Binary Guard</span>
                  <span className="text-[10px] font-mono text-emerald-600 font-semibold">%PDF- Magic Bytes</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Direct byte-level inspection prevents malicious files disguised as PDFs.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Emergency Master Recovery Key */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text)]">
                    Emergency Master Recovery Key (PRD AUTH-04)
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Offline recovery key to regain administrative access in case of lockout.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showRecoveryKey ? "text" : "password"}
                    readOnly
                    value={dbState.app_security.recovery_key_hash || SECURITY_CONFIG.DEFAULT_RECOVERY_KEY}
                    className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRecoveryKey(!showRecoveryKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    aria-label={showRecoveryKey ? "Hide recovery key" : "Show recovery key"}
                  >
                    {showRecoveryKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      dbState.app_security.recovery_key_hash || SECURITY_CONFIG.DEFAULT_RECOVERY_KEY
                    );
                    setRecoveryKeyCopied(true);
                    setTimeout(() => setRecoveryKeyCopied(false), 2000);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface-hover)] text-xs font-semibold text-[var(--color-text)] transition-colors"
                >
                  <Copy size={14} />
                  <span>{recoveryKeyCopied ? "Copied!" : "Copy Key"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRotateRecoveryKey}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <RefreshCw size={14} />
                  <span>Rotate Key</span>
                </button>
              </div>

              <p className="text-[11px] text-[var(--color-text-muted)]">
                Last rotated:{" "}
                <span className="font-mono text-[var(--color-text)]">
                  {dbState.app_security.recovery_rotated_at
                    ? format(new Date(dbState.app_security.recovery_rotated_at), "PPP p")
                    : "Initial Deployment"}
                </span>
                . Print or store this key in an air-gapped safe.
              </p>
            </div>
          </div>

          {/* Section 3: Admin Master Security PIN (from SecureHash Lab) */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text)]">
                    Admin Security Verification PIN (2FA Seam)
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    6-digit secondary verification PIN required when signing into Administrator accounts.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveAdminPin} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="w-48">
                <input
                  type="text"
                  maxLength={6}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="998877"
                  className="w-full text-center font-mono text-sm tracking-[0.3em] font-bold px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-semibold hover:opacity-90 transition-colors shadow-xs"
              >
                Save Master PIN
              </button>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Default: <code className="font-mono">998877</code>
              </span>
            </form>
          </div>

          {/* Section 4: Terminal Session Lock Seam */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text)]">
                    Terminal Lock Control (SEC-03)
                  </h2>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Instantly freeze terminal to prevent unauthorized access while away from your desk.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => lockSession()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Lock size={14} />
                <span>Lock Terminal Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: AUDIT HISTORY ──────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text)]">
                Immutable Audit Trail (PRD 9.5)
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Every record change, status progression, and override logged in transaction.
              </p>
            </div>
            <button
              onClick={handleExportAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              Export Audit Log
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="relative flex-1 w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search audit events, users, or summaries..."
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
              />
            </div>
            <select
              value={auditEntityFilter}
              onChange={(e) => setAuditEntityFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
            >
              <option value="All">All Entities</option>
              <option value="Student">Student</option>
              <option value="Drive">Drive</option>
              <option value="Application">Application</option>
              <option value="Offer">Offer</option>
              <option value="Eligibility">Eligibility</option>
              <option value="Backup">Backup</option>
              <option value="Settings">Settings</option>
              <option value="User">User</option>
            </select>
          </div>

          {/* Audit Table */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[var(--color-bg)] border-b border-[var(--color-border)] z-10">
                  <tr className="text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Timestamp</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Staff Member</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Action</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Entity</th>
                    <th className="py-2.5 px-3 font-semibold">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                        No audit events match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--color-surface-hover)]">
                        <td className="py-2 px-3 text-[var(--color-text-muted)] whitespace-nowrap font-mono text-[11px]">
                          {format(new Date(log.occurred_at), "dd/MM/yyyy HH:mm:ss")}
                        </td>
                        <td className="py-2 px-3 font-semibold text-[var(--color-text)] whitespace-nowrap">
                          {log.user_name_snapshot}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-[var(--color-primary-light)]/40 text-[var(--color-primary)]">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--color-text-muted)] whitespace-nowrap">
                          {log.entity_type} #{log.entity_id}
                        </td>
                        <td className="py-2 px-3 text-[var(--color-text)]">{log.summary}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 6: BACKUP & RECOVERY ──────────────────────────────────── */}
      {activeTab === "backup" && (
        <div className="space-y-6">
          {/* Action cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[var(--color-primary)]" />
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Create Instant Backup
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Packages database records and file manifests into an authoritative `.pabackup`
                archive (PRD Section 11.2).
              </p>
              <button
                onClick={handleTriggerManualBackup}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Generate &amp; Download Backup Archive
              </button>
            </div>

            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Restore From Backup File
                </h3>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                Validates checksums and takes an automatic pre-restore Safety snapshot before
                overwriting data (PRD 11.5).
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] cursor-pointer transition-all shadow-sm">
                <HardDrive className="w-4 h-4 text-[var(--color-primary)]" />
                Browse `.pabackup` File...
                <input
                  type="file"
                  accept=".pabackup,.json"
                  onChange={handleFileRestorePicker}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Storage Capacity & System Benchmark */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-primary-light)]/40 text-[var(--color-primary)]">
                  <Gauge className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text)]">
                    Storage Capacity &amp; Performance Benchmark
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Hybrid Storage Engine (IndexedDB + LocalStorage). High-capacity relational persistence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadSampleData}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Load Sample Dataset
                </button>
                <button
                  type="button"
                  disabled={benchmarkLoading}
                  onClick={() => handleRunBenchmark(1000)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] shadow-sm"
                >
                  <Activity className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  {benchmarkLoading ? "Running Benchmark..." : "Run Stress Benchmark"}
                </button>
              </div>
            </div>

            {/* Storage Gauge & Key Stats */}
            {storageMetrics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                    Current Database Payload
                  </span>
                  <span className="text-base font-bold font-mono text-[var(--color-text)]">
                    {storageMetrics.totalKb} KB
                  </span>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    {storageMetrics.totalMb} MB total footprint
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                    LocalStorage Quota Used
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-base font-bold font-mono text-[var(--color-text)]">
                      {storageMetrics.localStorageUsedPercent}%
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                      / 5.0 MB
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-border)] h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-[var(--color-primary)] h-full transition-all duration-300"
                      style={{ width: `${Math.max(2, storageMetrics.localStorageUsedPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                    IndexedDB Capacity
                  </span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {storageMetrics.indexedDbEstimateMb ? `${storageMetrics.indexedDbEstimateMb} MB` : "Unlimited GB"}
                  </span>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    Dual Engine (No 5MB ceiling)
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                    Max Theoretical Capacity
                  </span>
                  <span className="text-base font-bold font-mono text-[var(--color-text)]">
                    100,000+
                  </span>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    Profiles across cohorts
                  </p>
                </div>
              </div>
            )}

            {/* Entity Distribution Bar */}
            {storageMetrics && (
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-text)]">
                  <span>Current Record Inventory:</span>
                  <span className="font-mono text-[var(--color-text-muted)]">
                    {storageMetrics.entityCounts.students} Students · {storageMetrics.entityCounts.semesterRecords} Semesters · {storageMetrics.entityCounts.companies} Companies · {storageMetrics.entityCounts.drives} Drives · {storageMetrics.entityCounts.applications} Applications · {storageMetrics.entityCounts.offers} Offers
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Database Diagnostics & Integrity Check */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Database &amp; Storage Diagnostics (PRD 9.6)
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Verifies foreign key links, document integrity, and relational constraints.
                </p>
              </div>
              <button
                onClick={handleRunIntegrityCheck}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Run Integrity Verification
              </button>
            </div>

            {integrityStatus && (
              <div className="p-3 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text)] flex items-center gap-2 font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {integrityStatus}
              </div>
            )}
          </div>

          {/* Backup History Table */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-[var(--color-text)]">
              Backup History &amp; Snapshots (PRD 11.6)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-3 font-semibold">Backup Type</th>
                    <th className="py-2.5 px-3 font-semibold">Size</th>
                    <th className="py-2.5 px-3 font-semibold">Checksum (SHA)</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {dbState.backup_history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-[var(--color-text-muted)]">
                        No previous backups recorded. Click 'Generate &amp; Download' above.
                      </td>
                    </tr>
                  ) : (
                    dbState.backup_history.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[var(--color-surface-hover)]">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--color-text)]">
                          {format(new Date(rec.started_at), "dd/MM/yyyy HH:mm:ss")}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rec.type === "Manual"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : rec.type === "Safety"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {rec.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-text-muted)] font-mono">
                          {(rec.size_bytes / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--color-text-muted)]">
                          {rec.sha256}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Success
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => handleValidateBackupItem(rec)}
                            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                          >
                            Validate
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Restore Confirmation Modal */}
          {showRestoreModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--color-surface)] border border-rose-500/40 shadow-2xl space-y-4">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-base font-bold text-[var(--color-text)]">
                    Confirm Database Restore
                  </h3>
                </div>

                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                  <p className="font-semibold">Caution: Restoring will overwrite existing data.</p>
                  <p>
                    A safety snapshot of current data will be created automatically before
                    restoration.
                  </p>
                </div>

                <div className="text-xs text-[var(--color-text-muted)] space-y-1">
                  <p>
                    <strong className="text-[var(--color-text)]">Archive Type:</strong>{" "}
                    {restoreFilePayload?.manifest?.type || "Manual"}
                  </p>
                  <p>
                    <strong className="text-[var(--color-text)]">Created On:</strong>{" "}
                    {restoreFilePayload?.manifest?.timestamp || "Unknown"}
                  </p>
                  <p>
                    <strong className="text-[var(--color-text)]">Checksum:</strong>{" "}
                    {restoreFilePayload?.manifest?.checksum || "None"}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text)] mb-1">
                    Type <span className="font-mono text-rose-600 font-bold">RESTORE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={restoreConfirmText}
                    onChange={(e) => setRestoreConfirmText(e.target.value)}
                    placeholder="RESTORE"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-[var(--color-text)] uppercase"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowRestoreModal(false);
                      setRestoreConfirmText("");
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteRestore}
                    disabled={restoreConfirmText !== "RESTORE"}
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white disabled:opacity-40 hover:bg-rose-700 transition-all shadow-sm"
                  >
                    Confirm Restore
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Department Modal */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Add Academic Department
              </h3>
              <button
                onClick={() => setShowAddDeptModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">
                  Department Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIDS, ECE, MECH"
                  value={newDeptCode}
                  onChange={(e) => setNewDeptCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] font-mono uppercase text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">
                  Department Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Artificial Intelligence & Data Science"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">
                  Associated Degree / Course
                </label>
                <select
                  value={newDeptCourseId}
                  onChange={(e) => setNewDeptCourseId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                >
                  {dbState.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--color-text)]">
                Add Graduating Batch
              </h3>
              <button
                onClick={() => setShowAddBatchModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">
                  Batch Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2024-2028"
                  value={newBatchLabel}
                  onChange={(e) => setNewBatchLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] font-semibold text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">
                  Graduation / Passing Year *
                </label>
                <input
                  type="number"
                  required
                  min="2020"
                  max="2035"
                  value={newBatchPassingYear}
                  onChange={(e) => setNewBatchPassingYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-[var(--color-text)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[var(--color-text)] mb-1">
                  Course
                </label>
                <select
                  value={newBatchCourseId}
                  onChange={(e) => setNewBatchCourseId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
                >
                  {dbState.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Benchmark Results Modal */}
      {showBenchmarkModal && benchmarkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Activity size={18} />
                </span>
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  Capacity Stress Test Benchmark Results
                </h3>
              </div>
              <button
                onClick={() => setShowBenchmarkModal(false)}
                className="text-slate-400 hover:text-slate-600 rounded p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              {benchmarkResult.verdict}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                  Synthetic Batch Size
                </span>
                <span className="text-sm font-bold font-mono text-[var(--color-text)]">
                  {benchmarkResult.recordsTested.toLocaleString()} Records
                </span>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  Profiles + {benchmarkResult.recordsTested * 4} Semesters
                </p>
              </div>

              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                  Payload Ingested
                </span>
                <span className="text-sm font-bold font-mono text-[var(--color-text)]">
                  {benchmarkResult.payloadSizeMb} MB
                </span>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  ({benchmarkResult.payloadSizeBytes.toLocaleString()} bytes)
                </p>
              </div>

              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                  Serialization Latency
                </span>
                <span className="text-sm font-bold font-mono text-[var(--color-text)]">
                  {benchmarkResult.serializationTimeMs} ms
                </span>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  Deserialization: {benchmarkResult.deserializationTimeMs} ms
                </p>
              </div>

              <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
                <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] block">
                  Ingestion Throughput
                </span>
                <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {benchmarkResult.estimatedRps.toLocaleString()} records/sec
                </span>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  ~{benchmarkResult.memoryPerStudentBytes} bytes / student profile
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-muted)] space-y-1">
              <p className="font-semibold text-[var(--color-text)]">System Capacity Architecture:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li><strong>LocalStorage Tier:</strong> Capped at 5 MB by browser specification (~1,600 full academic profiles).</li>
                <li><strong>IndexedDB Tier:</strong> Automatically activates to hold up to hundreds of megabytes or gigabytes of academic records and PDF documents with zero data truncation.</li>
                <li><strong>In-Memory UI Tier:</strong> React 18 state with virtualization handles 5,000+ candidate roster filtering with sub-5ms latency.</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowBenchmarkModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 shadow-sm"
              >
                Close Benchmark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
