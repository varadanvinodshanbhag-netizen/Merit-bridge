import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Briefcase,
  Search,
  Plus,
  Users,
  Calendar,
  X,
  ChevronRight,
  Award,
  ShieldCheck,
  Trash2,
  Pencil,
  CheckCircle2,
} from "lucide-react";
import clsx from "clsx";
import { db } from "@/db/storage";
import {
  Drive,
  CriteriaRule,
  EligibilityVerdict,
  StageOutcome,
  Offer,
} from "@/types";
import { evaluateStudentEligibility } from "@/services/eligibility";
import { logAudit } from "@/services/audit";
import { useAuthStore } from "@/store/auth";

export default function DrivesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [dbState, setDbState] = useState(db.getState());
  const [search, setSearch] = useState("");
  const [filterYearId, setFilterYearId] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [selectedDriveId, setSelectedDriveId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState<Drive | null>(null);

  useEffect(() => {
    return db.subscribe(() => {
      setDbState(db.getState());
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowCreateModal(true);
    const driveId = searchParams.get("id");
    if (driveId) setSelectedDriveId(Number(driveId));
  }, [searchParams]);

  const filteredDrives = useMemo(() => {
    return dbState.drives.filter((d) => {
      if (filterYearId && d.academic_year_id !== filterYearId) return false;
      if (filterStatus && d.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const comp = dbState.companies.find((c) => c.id === d.company_id);
        const matchesTitle = d.title.toLowerCase().includes(q);
        const matchesCompany = comp?.name.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesCompany) return false;
      }
      return true;
    });
  }, [dbState.drives, dbState.companies, filterYearId, filterStatus, search]);

  const selectedDrive = dbState.drives.find((d) => d.id === selectedDriveId);

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Placement Drives
          </h1>
          <p className="mt-0.5 text-xs lg:text-sm text-slate-500 dark:text-slate-400">
            Manage recruitment drives, eligibility checking, stage pipeline, and offers
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors self-start sm:self-auto"
        >
          <Plus size={15} />
          Create Placement Drive
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search drives by title or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
          />
        </div>

        <select
          value={filterYearId}
          onChange={(e) => setFilterYearId(e.target.value ? Number(e.target.value) : "")}
          className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          <option value="">All Academic Years</option>
          {dbState.academic_years.map((y) => (
            <option key={y.id} value={y.id}>
              Year {y.label}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          <option value="">All Statuses</option>
          <option value="Registration Open">Registration Open</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Drives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrives.map((d) => {
          const comp = dbState.companies.find((c) => c.id === d.company_id);
          const year = dbState.academic_years.find((y) => y.id === d.academic_year_id);
          const driveApps = dbState.applications.filter((a) => a.drive_id === d.id);
          const selectedCount = driveApps.filter((a) => a.final_outcome === "Selected").length;

          return (
            <div
              key={d.id}
              onClick={() => setSelectedDriveId(d.id)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand-light)] text-[var(--color-brand)] font-bold text-sm shadow-sm">
                      <Briefcase size={20} />
                    </span>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-brand)] transition-colors">
                        {d.title}
                      </h3>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {comp?.name} · Year {year?.label}
                      </p>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0",
                      d.status === "In Progress" && "bg-blue-50 text-blue-700 border border-blue-200/60",
                      d.status === "Registration Open" && "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
                      d.status === "Completed" && "bg-purple-50 text-purple-700 border border-purple-200/60",
                      d.status === "Cancelled" && "bg-rose-50 text-rose-700 border border-rose-200/60"
                    )}
                  >
                    {d.status}
                  </span>
                </div>

                <p className="mt-3.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {d.description || "Campus recruitment drive."}
                </p>

                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Calendar size={13} className="text-slate-400" />
                    {d.drive_date}
                  </span>
                  <span>{d.stages.length} Stages</span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    Applicants / Selected
                  </p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {driveApps.length} applied · {selectedCount} selected
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDrive(d);
                    }}
                    title="Edit Drive"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  <span className="flex items-center gap-1 text-[var(--color-brand)] font-semibold text-xs group-hover:translate-x-1 transition-transform">
                    Manage <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drive Detail Modal (Eligibility, Pipeline, Offers) */}
      {selectedDrive && (
        <DriveDetailModal
          drive={selectedDrive}
          onEdit={() => setEditingDrive(selectedDrive)}
          onClose={() => {
            setSelectedDriveId(null);
            searchParams.delete("id");
            setSearchParams(searchParams);
          }}
        />
      )}

      {/* Create / Edit Drive Modal */}
      {(showCreateModal || editingDrive) && (
        <DriveModal
          initialDrive={editingDrive}
          onClose={() => {
            setShowCreateModal(false);
            setEditingDrive(null);
            searchParams.delete("action");
            setSearchParams(searchParams);
          }}
        />
      )}
    </div>
  );
}

// ─── Drive Detail View (3 Tabs: Eligibility, Stages/Applicants, Offers) ───────
function DriveDetailModal({
  drive,
  onEdit,
  onClose,
}: {
  drive: Drive;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"ELIGIBLE" | "PIPELINE" | "OFFERS">("ELIGIBLE");
  const [dbState, setDbState] = useState(db.getState());

  const [overrideStudentId, setOverrideStudentId] = useState<number | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<EligibilityVerdict>("Eligible");
  const [overrideReason, setOverrideReason] = useState("");

  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterVerdictFilter, setRosterVerdictFilter] = useState<string>("ALL");
  const [rosterDeptFilter, setRosterDeptFilter] = useState<number | "">("");

  const [showIssueOfferModal, setShowIssueOfferModal] = useState(false);
  const [offerAppId, setOfferAppId] = useState<number | null>(null);
  const [offerDesignation, setOfferDesignation] = useState("");
  const [offerSalaryLpa, setOfferSalaryLpa] = useState("6.5");

  useEffect(() => {
    return db.subscribe(() => {
      setDbState(db.getState());
    });
  }, []);

  const company = dbState.companies.find((c) => c.id === drive.company_id);
  const criteriaSet = dbState.criteria_sets.find((cs) => cs.id === drive.criteria_set_id) || {
    id: drive.criteria_set_id,
    rules: [],
  };

  // Run eligibility engine for all active students (PRD Section 6.2)
  const eligibilityEvaluations = useMemo(() => {
    return dbState.students
      .filter((s) => !s.archived_at)
      .map((student) => {
        const studentSems = dbState.semester_records.filter((r) => r.student_id === student.id);
        const studentBacklogs = dbState.backlogs.filter((b) => b.student_id === student.id);
        const override = dbState.eligibility_overrides.find(
          (o) => o.drive_id === drive.id && o.student_id === student.id && !o.removed_at
        );

        return {
          student,
          evaluation: evaluateStudentEligibility({
            student,
            criteriaSet,
            semesters: studentSems,
            backlogs: studentBacklogs,
            driveId: drive.id,
            override,
          }),
        };
      });
  }, [dbState.students, dbState.semester_records, dbState.backlogs, dbState.eligibility_overrides, criteriaSet, drive.id]);

  const applications = dbState.applications.filter((a) => a.drive_id === drive.id);
  const offers = dbState.offers.filter((o) => applications.some((a) => a.id === o.application_id));

  // 1. Bulk Add Eligible Students to Drive
  const handleBulkApplyEligible = () => {
    const eligibleStudents = eligibilityEvaluations
      .filter((e) => e.evaluation.effectiveStatus === "Eligible")
      .map((e) => e.student);

    if (eligibleStudents.length === 0) {
      alert("No eligible students found to add.");
      return;
    }

    const now = new Date().toISOString();
    let addedCount = 0;

    db.setState((draft) => {
      let nextAppId = draft.applications.length > 0
        ? Math.max(...draft.applications.map((a) => a.id)) + 1
        : 1;

      for (const s of eligibleStudents) {
        const alreadyApplied = draft.applications.some(
          (a) => a.drive_id === drive.id && a.student_id === s.id
        );
        if (!alreadyApplied) {
          draft.applications.push({
            id: nextAppId++,
            drive_id: drive.id,
            student_id: s.id,
            applied_date: now.split("T")[0],
            final_outcome: "Pending",
            stages: drive.stages.map((st, i) => ({
              id: Date.now() + nextAppId + i,
              application_id: nextAppId,
              drive_stage_id: st.id,
              outcome: "Pending",
              updated_at: now,
              updated_by: user?.id || 1,
            })),
            created_at: now,
            updated_at: now,
          });
          addedCount++;
        }
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "BULK_APPLY_ELIGIBLE",
      entityType: "Drive",
      entityId: drive.title,
      summary: `Bulk added ${addedCount} eligible candidates to drive ${drive.title}`,
    });

    alert(`Successfully registered ${addedCount} eligible students for ${drive.title}!`);
  };

  // Bulk Register specific selected candidates (Allows manual override / special skills inclusion)
  const handleBulkRegisterSelected = () => {
    if (selectedCandidateIds.length === 0) return;
    const now = new Date().toISOString();
    let addedCount = 0;

    db.setState((draft) => {
      let nextAppId = draft.applications.length > 0
        ? Math.max(...draft.applications.map((a) => a.id)) + 1
        : 1;

      for (const sId of selectedCandidateIds) {
        const alreadyApplied = draft.applications.some(
          (a) => a.drive_id === drive.id && a.student_id === sId
        );
        if (!alreadyApplied) {
          draft.applications.push({
            id: nextAppId++,
            drive_id: drive.id,
            student_id: sId,
            applied_date: now.split("T")[0],
            final_outcome: "Pending",
            stages: drive.stages.map((st, i) => ({
              id: Date.now() + nextAppId + i,
              application_id: nextAppId,
              drive_stage_id: st.id,
              outcome: "Pending",
              updated_at: now,
              updated_by: user?.id || 1,
            })),
            created_at: now,
            updated_at: now,
          });
          addedCount++;
        }
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "BULK_APPLY_SELECTED",
      entityType: "Drive",
      entityId: drive.title,
      summary: `Manually enrolled ${addedCount} selected candidate(s) to drive ${drive.title}`,
    });

    setSelectedCandidateIds([]);
    alert(`Enrolled ${addedCount} selected candidate(s) into ${drive.title}!`);
  };

  // Unenroll a student from drive
  const handleUnenrollStudent = (studentId: number) => {
    const app = dbState.applications.find((a) => a.drive_id === drive.id && a.student_id === studentId);
    if (!app) return;
    const hasOffer = dbState.offers.some((o) => o.application_id === app.id);
    if (hasOffer) {
      alert("Cannot unenroll candidate who already holds a recorded placement offer.");
      return;
    }

    db.setState((draft) => {
      draft.applications = draft.applications.filter((a) => a.id !== app.id);
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UNENROLL_STUDENT_DRIVE",
      entityType: "Drive",
      entityId: drive.id,
      summary: `Removed student ID ${studentId} from drive ${drive.title}`,
    });
  };

  // Filter roster by search, department, and verdict
  const filteredCandidates = useMemo(() => {
    return eligibilityEvaluations.filter(({ student, evaluation }) => {
      if (rosterVerdictFilter !== "ALL" && evaluation.effectiveStatus !== rosterVerdictFilter) return false;
      if (rosterDeptFilter && student.department_id !== rosterDeptFilter) return false;
      if (rosterSearch.trim()) {
        const q = rosterSearch.toLowerCase().trim();
        const matchesName = student.full_name.toLowerCase().includes(q);
        const matchesReg = student.registration_number.toLowerCase().includes(q);
        if (!matchesName && !matchesReg) return false;
      }
      return true;
    });
  }, [eligibilityEvaluations, rosterVerdictFilter, rosterDeptFilter, rosterSearch]);

  const allVisibleSelected =
    filteredCandidates.length > 0 &&
    filteredCandidates.every((c) => selectedCandidateIds.includes(c.student.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredCandidates.map((c) => c.student.id));
      setSelectedCandidateIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = filteredCandidates.map((c) => c.student.id);
      setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Register an individual student
  const handleRegisterStudent = (studentId: number) => {
    const student = dbState.students.find((s) => s.id === studentId);
    if (!student) return;
    const now = new Date().toISOString();

    db.setState((draft) => {
      const alreadyApplied = draft.applications.some(
        (a) => a.drive_id === drive.id && a.student_id === studentId
      );
      if (!alreadyApplied) {
        const nextAppId = draft.applications.length > 0
          ? Math.max(...draft.applications.map((a) => a.id)) + 1
          : 1;

        draft.applications.push({
          id: nextAppId,
          drive_id: drive.id,
          student_id: studentId,
          applied_date: now.split("T")[0],
          final_outcome: "Pending",
          stages: drive.stages.map((st, i) => ({
            id: Date.now() + nextAppId + i,
            application_id: nextAppId,
            drive_stage_id: st.id,
            outcome: "Pending",
            updated_at: now,
            updated_by: user?.id || 1,
          })),
          created_at: now,
          updated_at: now,
        });
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "REGISTER_STUDENT_DRIVE",
      entityType: "Drive",
      entityId: drive.id,
      summary: `Registered student ${student.full_name} (${student.registration_number}) to drive ${drive.title}`,
    });
  };

  // Remove an applicant from drive
  const handleRemoveApplicant = (appId: number) => {
    const app = dbState.applications.find((a) => a.id === appId);
    if (!app) return;
    const hasOffer = dbState.offers.some((o) => o.application_id === appId);
    if (hasOffer) {
      alert("Cannot remove candidate: an offer has already been issued/recorded for this application.");
      return;
    }
    const student = dbState.students.find((s) => s.id === app.student_id);
    if (!confirm(`Remove ${student?.full_name || "candidate"} from this drive?`)) return;

    db.setState((draft) => {
      draft.applications = draft.applications.filter((a) => a.id !== appId);
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "REMOVE_APPLICANT",
      entityType: "Drive",
      entityId: drive.id,
      summary: `Removed candidate ${student?.full_name || appId} from drive ${drive.title}`,
    });
  };

  // 2. Save Manual Eligibility Override (PRD 6.2 #5)
  const handleSaveOverride = () => {
    if (!overrideStudentId || !overrideReason.trim()) {
      alert("Please specify the override reason.");
      return;
    }

    const now = new Date().toISOString();

    db.setState((draft) => {
      // Remove any existing active override for this student and drive
      const existing = draft.eligibility_overrides.find(
        (o) => o.drive_id === drive.id && o.student_id === overrideStudentId && !o.removed_at
      );
      if (existing) {
        existing.removed_at = now;
        existing.removed_by = user?.id || 1;
        existing.removal_reason = "Replaced by newer override";
      }

      draft.eligibility_overrides.push({
        id: Date.now(),
        drive_id: drive.id,
        student_id: overrideStudentId,
        override_status: overrideStatus,
        reason: overrideReason.trim(),
        created_by: user?.id || 1,
        created_at: now,
      });
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "ELIGIBILITY_OVERRIDE",
      entityType: "Drive",
      entityId: drive.id,
      summary: `Eligibility override set to ${overrideStatus} for student ${overrideStudentId}. Reason: ${overrideReason}`,
      reason: overrideReason,
    });

    setOverrideStudentId(null);
    setOverrideReason("");
  };

  // 3. Advance Stage Result
  const handleUpdateStageResult = (
    applicationId: number,
    stageId: number,
    outcome: StageOutcome
  ) => {
    const now = new Date().toISOString();

    db.setState((draft) => {
      const app = draft.applications.find((a) => a.id === applicationId);
      if (app) {
        let stRes = app.stages.find((s) => s.drive_stage_id === stageId);
        if (!stRes) {
          stRes = {
            id: Date.now(),
            application_id: applicationId,
            drive_stage_id: stageId,
            outcome,
            updated_at: now,
            updated_by: user?.id || 1,
          };
          app.stages.push(stRes);
        } else {
          stRes.outcome = outcome;
          stRes.updated_at = now;
          stRes.updated_by = user?.id || 1;
        }

        // Automatic recommendation (PRD APP-02)
        if (outcome === "Failed") {
          app.final_outcome = "Rejected";
        }
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "STAGE_RESULT_UPDATE",
      entityType: "Application",
      entityId: applicationId,
      summary: `Stage ${stageId} outcome marked ${outcome} for app #${applicationId}`,
    });
  };

  // 4. Mark Selected and Add Offer (PRD OFR-01 shortcut)
  const handleOpenAddOffer = (appId: number) => {
    setOfferAppId(appId);
    setOfferDesignation(company?.job_roles[0]?.designation || "Software Engineer");
    setShowIssueOfferModal(true);
  };

  const handleSaveOffer = () => {
    if (!offerAppId) return;
    const salaryRupees = Math.round(Number(offerSalaryLpa) * 100000);
    const now = new Date().toISOString();

    db.setState((draft) => {
      const app = draft.applications.find((a) => a.id === offerAppId);
      if (app) {
        app.final_outcome = "Selected";
      }

      draft.offers.push({
        id: Date.now(),
        application_id: offerAppId,
        offer_date: now.split("T")[0],
        designation: offerDesignation.trim(),
        annual_salary: salaryRupees,
        offer_status: "Accepted",
        acceptance_date: now.split("T")[0],
        joining_status: "Pending",
        created_at: now,
        updated_at: now,
      });
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "ISSUE_OFFER",
      entityType: "Offer",
      entityId: offerAppId,
      summary: `Issued and marked Accepted offer: ${offerDesignation} (₹${offerSalaryLpa} LPA) for app #${offerAppId}`,
    });

    setShowIssueOfferModal(false);
    setOfferAppId(null);
  };

  const handleUpdateDriveStatus = (newStatus: Drive["status"]) => {
    const now = new Date().toISOString();
    db.setState((draft) => {
      const d = draft.drives.find((item) => item.id === drive.id);
      if (d) {
        d.status = newStatus;
        d.updated_at = now;
      }
    });
    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UPDATE_DRIVE_STATUS",
      entityType: "Drive",
      entityId: drive.id,
      summary: `Updated drive status to "${newStatus}" for ${drive.title}`,
    });
  };

  const handleDeleteDrive = () => {
    if (applications.length > 0) {
      alert("Cannot delete drive: student applications have already been recorded. Please mark as Cancelled instead.");
      return;
    }
    if (!confirm(`Are you sure you want to delete drive "${drive.title}"?`)) return;

    db.setState((draft) => {
      draft.drives = draft.drives.filter((item) => item.id !== drive.id);
    });
    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "DELETE_DRIVE",
      entityType: "Drive",
      entityId: drive.id,
      summary: `Deleted recruitment drive "${drive.title}"`,
    });
    onClose();
  };

  const handleUpdateOfferStatus = (offerId: number, newStatus: Offer["offer_status"]) => {
    const now = new Date().toISOString();
    db.setState((draft) => {
      const o = draft.offers.find((item) => item.id === offerId);
      if (o) {
        o.offer_status = newStatus;
        o.updated_at = now;
        if (newStatus === "Accepted" && !o.acceptance_date) {
          o.acceptance_date = now.split("T")[0];
        }
      }
    });
    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UPDATE_OFFER_STATUS",
      entityType: "Offer",
      entityId: offerId,
      summary: `Updated offer #${offerId} status to ${newStatus}`,
    });
  };

  const handleUpdateJoiningStatus = (offerId: number, newJoining: Offer["joining_status"]) => {
    const now = new Date().toISOString();
    db.setState((draft) => {
      const o = draft.offers.find((item) => item.id === offerId);
      if (o) {
        o.joining_status = newJoining;
        o.updated_at = now;
      }
    });
    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UPDATE_JOINING_STATUS",
      entityType: "Offer",
      entityId: offerId,
      summary: `Updated offer #${offerId} joining status to ${newJoining}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand)] text-white shadow-sm font-bold">
              <Briefcase size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {drive.title}
                </h2>
                <select
                  value={drive.status}
                  onChange={(e) => handleUpdateDriveStatus(e.target.value as Drive["status"])}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none"
                >
                  <option value="Registration Open">Registration Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Partner: <strong className="text-slate-700 dark:text-slate-300">{company?.name}</strong> · Scheduled: {drive.drive_date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Edit Drive Details"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
              >
                <Pencil size={13} />
                <span className="hidden sm:inline">Edit Drive</span>
              </button>
            )}
            {applications.length === 0 && (
              <button
                type="button"
                onClick={handleDeleteDrive}
                title="Delete Recruitment Drive"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Delete Drive</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-xl">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 gap-6 bg-white dark:bg-[#12151d]">
          <button
            onClick={() => setActiveTab("ELIGIBLE")}
            className={clsx(
              "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "ELIGIBLE"
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <ShieldCheck size={15} />
            Eligibility Evaluation ({eligibilityEvaluations.filter((e) => e.evaluation.effectiveStatus === "Eligible").length} Eligible)
          </button>

          <button
            onClick={() => setActiveTab("PIPELINE")}
            className={clsx(
              "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "PIPELINE"
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Users size={15} />
            Applicant Pipeline ({applications.length})
          </button>

          <button
            onClick={() => setActiveTab("OFFERS")}
            className={clsx(
              "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "OFFERS"
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Award size={15} />
            Offers & Selections ({offers.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ─── TAB 1: ELIGIBILITY EVALUATION ───────────────────────────────── */}
          {activeTab === "ELIGIBLE" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Candidate Eligibility Roster
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {eligibilityEvaluations.filter((e) => e.evaluation.effectiveStatus === "Eligible").length} Eligible · {applications.length} Enrolled in Drive
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedCandidateIds.length > 0 && (
                    <button
                      onClick={handleBulkRegisterSelected}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
                    >
                      <Users size={14} />
                      Enroll Selected ({selectedCandidateIds.length})
                    </button>
                  )}
                  <button
                    onClick={handleBulkApplyEligible}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors"
                  >
                    <CheckCircle2 size={14} />
                    Auto-Enroll All Eligible ({eligibilityEvaluations.filter((e) => e.evaluation.effectiveStatus === "Eligible" && !applications.some((a) => a.student_id === e.student.id)).length})
                  </button>
                </div>
              </div>

              {/* Roster Filters Toolbar */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-2.5 text-xs">
                <div className="relative flex-1 w-full">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search candidate by name or registration number..."
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                  />
                </div>

                <select
                  value={rosterDeptFilter}
                  onChange={(e) => setRosterDeptFilter(e.target.value ? Number(e.target.value) : "")}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-300 w-full sm:w-auto"
                >
                  <option value="">All Departments</option>
                  {dbState.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} · {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={rosterVerdictFilter}
                  onChange={(e) => setRosterVerdictFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-medium text-slate-700 dark:text-slate-300 w-full sm:w-auto"
                >
                  <option value="ALL">All Verdicts</option>
                  <option value="Eligible">Eligible Only</option>
                  <option value="Ineligible">Ineligible Only</option>
                  <option value="Needs Review">Needs Review</option>
                </select>
              </div>

              {/* Roster table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-3 py-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          className="rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                        />
                      </th>
                      <th className="px-3 py-3 text-left font-semibold">Reg Number</th>
                      <th className="px-3 py-3 text-left font-semibold">Student Name</th>
                      <th className="px-3 py-3 text-left font-semibold">Dept</th>
                      <th className="px-3 py-3 text-left font-semibold">CGPA</th>
                      <th className="px-3 py-3 text-left font-semibold">Internship</th>
                      <th className="px-3 py-3 text-left font-semibold">Verdict</th>
                      <th className="px-3 py-3 text-left font-semibold">Rule Explanations</th>
                      <th className="px-3 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCandidates.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                          No candidates found matching the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredCandidates.map(({ student, evaluation }) => {
                        const isSelected = selectedCandidateIds.includes(student.id);
                        const isEnrolled = applications.some((a) => a.student_id === student.id);
                        const dept = dbState.departments.find((d) => d.id === student.department_id);

                        return (
                          <tr
                            key={student.id}
                            className={clsx(
                              "hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors",
                              isSelected && "bg-indigo-50/30 dark:bg-indigo-950/20"
                            )}
                          >
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedCandidateIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== student.id) : [...prev, student.id]
                                  );
                                }}
                                className="rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                              />
                            </td>
                            <td className="px-3 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                              {student.registration_number}
                            </td>
                            <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {student.full_name}
                            </td>
                            <td className="px-3 py-3">
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                                {dept?.code || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-mono font-bold">
                              {student.cgpa !== null && student.cgpa !== undefined ? student.cgpa.toFixed(2) : "—"}
                            </td>
                            <td className="px-3 py-3">
                              {student.internship_status === "Active" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 px-2 py-0.5 rounded-md">
                                  Active: {student.internship_company || "Company"}
                                </span>
                              ) : student.internship_status === "Completed" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 px-2 py-0.5 rounded-md">
                                  Done: {student.internship_company || "Company"}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={clsx(
                                  "rounded-full px-2.5 py-0.5 text-[10px] font-bold inline-block",
                                  evaluation.effectiveStatus === "Eligible" &&
                                    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200",
                                  evaluation.effectiveStatus === "Needs Review" &&
                                    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200",
                                  evaluation.effectiveStatus === "Ineligible" &&
                                    "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200"
                                )}
                              >
                                {evaluation.effectiveStatus}
                                {evaluation.override && " (Override)"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-500 max-w-xs truncate" title={evaluation.explanation.map((e) => e.detail).join("; ")}>
                              {evaluation.explanation.map((e) => e.detail).join("; ")}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {isEnrolled ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50">
                                      <CheckCircle2 size={11} /> Enrolled
                                    </span>
                                    <button
                                      onClick={() => handleUnenrollStudent(student.id)}
                                      className="text-[11px] text-rose-500 hover:text-rose-700 font-medium hover:underline"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleRegisterStudent(student.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-xs transition-colors"
                                  >
                                    Enroll
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setOverrideStudentId(student.id);
                                    setOverrideStatus(evaluation.effectiveStatus === "Eligible" ? "Ineligible" : "Eligible");
                                  }}
                                  className="text-[11px] font-semibold text-[var(--color-brand)] hover:underline ml-1"
                                >
                                  Override
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 2: APPLICANT PIPELINE & STAGES ──────────────────────────── */}
          {activeTab === "PIPELINE" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Recruitment Stage Pipeline
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Advance candidates through scheduled stages: {drive.stages.map((s) => s.name).join(" → ")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Candidate</th>
                      {drive.stages.map((st) => (
                        <th key={st.id} className="px-4 py-3 text-center font-semibold">
                          {st.name}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left font-semibold">Final Outcome</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {applications.length === 0 ? (
                      <tr>
                        <td colSpan={drive.stages.length + 3} className="px-4 py-8 text-center text-slate-400">
                          No candidates registered for this drive yet.
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => {
                        const student = dbState.students.find((s) => s.id === app.student_id);
                        return (
                          <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900 dark:text-slate-100">{student?.full_name}</p>
                              <p className="text-[10px] font-mono text-slate-400">{student?.registration_number}</p>
                            </td>

                            {drive.stages.map((st) => {
                              const res = app.stages.find((s) => s.drive_stage_id === st.id);
                              const outcome = res?.outcome || "Pending";
                              return (
                                <td key={st.id} className="px-4 py-3 text-center">
                                  <select
                                    value={outcome}
                                    onChange={(e) =>
                                      handleUpdateStageResult(app.id, st.id, e.target.value as StageOutcome)
                                    }
                                    className={clsx(
                                      "rounded-lg px-2 py-1 text-[10px] font-bold border cursor-pointer",
                                      outcome === "Passed" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                      outcome === "Failed" && "bg-rose-50 text-rose-700 border-rose-200",
                                      outcome === "Pending" && "bg-slate-100 text-slate-600 border-slate-200"
                                    )}
                                  >
                                    <option value="Pending">Pending</option>
                                    <option value="Passed">Passed</option>
                                    <option value="Failed">Failed</option>
                                    <option value="Withdrawn">Withdrawn</option>
                                  </select>
                                </td>
                              );
                            })}

                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              <span
                                className={clsx(
                                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                  app.final_outcome === "Selected" && "bg-emerald-50 text-emerald-700",
                                  app.final_outcome === "Rejected" && "bg-rose-50 text-rose-700",
                                  app.final_outcome === "Pending" && "bg-amber-50 text-amber-700"
                                )}
                              >
                                {app.final_outcome}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                {app.final_outcome !== "Selected" && (
                                  <button
                                    onClick={() => handleOpenAddOffer(app.id)}
                                    className="text-xs font-semibold text-emerald-600 hover:underline"
                                  >
                                    Mark Selected & Add Offer
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveApplicant(app.id)}
                                  title="Remove Candidate from Drive"
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── TAB 3: OFFERS & SELECTIONS ──────────────────────────────────── */}
          {activeTab === "OFFERS" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Recorded Placement Offers
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Track Accepted, Pending, and Joined candidate packages.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Student</th>
                      <th className="px-4 py-3 text-left font-semibold">Designation</th>
                      <th className="px-4 py-3 text-left font-semibold">Salary Package</th>
                      <th className="px-4 py-3 text-left font-semibold">Offer Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Joining Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {offers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                          No placement offers released for this drive yet.
                        </td>
                      </tr>
                    ) : (
                      offers.map((offer) => {
                        const app = dbState.applications.find((a) => a.id === offer.application_id);
                        const student = dbState.students.find((s) => s.id === app?.student_id);
                        return (
                          <tr key={offer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900 dark:text-slate-100">{student?.full_name}</p>
                              <p className="font-mono text-[10px] text-slate-400">{student?.registration_number}</p>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {offer.designation}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                              ₹{(offer.annual_salary / 100000).toFixed(2)} LPA
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={offer.offer_status}
                                onChange={(e) => handleUpdateOfferStatus(offer.id, e.target.value as Offer["offer_status"])}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                              >
                                <option value="Accepted">Accepted</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Pending">Pending</option>
                                <option value="Expired">Expired</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={offer.joining_status}
                                onChange={(e) => handleUpdateJoiningStatus(offer.id, e.target.value as Offer["joining_status"])}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Joined">Joined</option>
                                <option value="Did Not Join">Did Not Join</option>
                                <option value="Offer Revoked">Offer Revoked</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Override Modal */}
        {overrideStudentId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Staff Eligibility Override
              </h3>
              <p className="text-xs text-slate-500">
                Overrides persist across recalculations until explicitly removed (PRD 6.2 #5).
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Override Verdict:
                </label>
                <select
                  value={overrideStatus}
                  onChange={(e) => setOverrideStatus(e.target.value as EligibilityVerdict)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
                >
                  <option value="Eligible">Eligible</option>
                  <option value="Ineligible">Ineligible</option>
                  <option value="Needs Review">Needs Review</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Mandatory Reason / Justification:
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Approved special exception by Placement Committee due to exceptional project work"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setOverrideStudentId(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOverride}
                  className="rounded-xl bg-[var(--color-brand)] px-5 py-2 text-xs font-semibold text-white shadow-sm"
                >
                  Confirm Override
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Offer Modal */}
        {showIssueOfferModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Issue Placement Offer
              </h3>
              <p className="text-xs text-slate-500">
                Marks candidate Selected and logs immutable offer history (PRD OFR-01).
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Designation / Role Title:
                </label>
                <input
                  type="text"
                  value={offerDesignation}
                  onChange={(e) => setOfferDesignation(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Annual Package (LPA in Lakhs):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={offerSalaryLpa}
                  onChange={(e) => setOfferSalaryLpa(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowIssueOfferModal(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOffer}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-semibold text-white shadow-sm"
                >
                  Record Offer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drive Modal (Create & Edit) ─────────────────────────────────────────────
function DriveModal({
  initialDrive,
  onClose,
}: {
  initialDrive?: Drive | null;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const state = db.getState();

  const isEdit = Boolean(initialDrive);
  const initialCriteria = initialDrive
    ? state.criteria_sets.find((cs) => cs.id === initialDrive.criteria_set_id)
    : null;
  const initialMinCgpa =
    initialCriteria?.rules.find((r) => r.rule_type === "MIN_CGPA")?.numeric_value ?? 6.5;
  const initialMaxBacklogs =
    initialCriteria?.rules.find((r) => r.rule_type === "MAX_ACTIVE_BACKLOGS")?.numeric_value ?? 0;

  const initialCompanyId = initialDrive?.company_id ?? (state.companies[0]?.id || 1);
  const initialCompany = state.companies.find((c) => c.id === initialCompanyId);
  const initialDeptRule = initialCriteria?.rules.find((r) => r.rule_type === "ALLOWED_DEPARTMENTS");
  const initialDeptIds = initialDeptRule?.item_ids ?? (initialCompany?.department_ids || []);

  const [companyId, setCompanyId] = useState<number>(initialCompanyId);
  const [departmentIds, setDepartmentIds] = useState<number[]>(initialDeptIds);
  const [yearId, setYearId] = useState<number>(initialDrive?.academic_year_id ?? (state.academic_years[0]?.id || 2));
  const [title, setTitle] = useState(initialDrive?.title ?? "");
  const [description, setDescription] = useState(initialDrive?.description ?? "");
  const [date, setDate] = useState(initialDrive?.drive_date ?? new Date().toISOString().split("T")[0]);
  const [minCgpa, setMinCgpa] = useState(String(initialMinCgpa));
  const [maxBacklogs, setMaxBacklogs] = useState(String(initialMaxBacklogs));
  const [stages] = useState(["Aptitude Test", "Technical Interview", "HR Round"]);
  const [error, setError] = useState<string | null>(null);

  const handleCompanyChange = (newCompanyId: number) => {
    setCompanyId(newCompanyId);
    const comp = state.companies.find((c) => c.id === newCompanyId);
    if (comp?.department_ids && comp.department_ids.length > 0) {
      setDepartmentIds(comp.department_ids);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Drive title is required.");
      return;
    }
    if (departmentIds.length === 0) {
      setError("Department selection is compulsory for placement drives. Please select at least one department.");
      return;
    }

    const now = new Date().toISOString();

    if (isEdit && initialDrive) {
      db.setState((draft) => {
        const d = draft.drives.find((item) => item.id === initialDrive.id);
        if (d) {
          d.company_id = companyId;
          d.academic_year_id = yearId;
          d.title = title.trim();
          d.description = description.trim() || undefined;
          d.drive_date = date;
          d.updated_at = now;
        }

        const cs = draft.criteria_sets.find((c) => c.id === initialDrive.criteria_set_id);
        if (cs) {
          const minRule = cs.rules.find((r) => r.rule_type === "MIN_CGPA");
          if (minRule) minRule.numeric_value = Number(minCgpa);
          const maxRule = cs.rules.find((r) => r.rule_type === "MAX_ACTIVE_BACKLOGS");
          if (maxRule) maxRule.numeric_value = Number(maxBacklogs);

          const deptRule = cs.rules.find((r) => r.rule_type === "ALLOWED_DEPARTMENTS");
          if (deptRule) {
            deptRule.item_ids = departmentIds;
          } else {
            cs.rules.push({
              id: Date.now() + 3,
              criteria_set_id: cs.id,
              rule_type: "ALLOWED_DEPARTMENTS",
              item_ids: departmentIds,
            });
          }
        }
      });

      logAudit({
        userId: user?.id || 1,
        userName: user?.name || "Placement Staff",
        action: "UPDATE_DRIVE",
        entityType: "Drive",
        entityId: initialDrive.id,
        summary: `Updated placement drive ${title.trim()} (Departments: ${departmentIds.map((id) => state.departments.find((d) => d.id === id)?.code).join(", ")})`,
      });
    } else {
      const driveId = state.drives.length > 0 ? Math.max(...state.drives.map((d) => d.id)) + 1 : 1;
      const criteriaSetId = Date.now();

      const criteriaRules: CriteriaRule[] = [
        {
          id: criteriaSetId + 1,
          criteria_set_id: criteriaSetId,
          rule_type: "MIN_CGPA",
          numeric_value: Number(minCgpa),
        },
        {
          id: criteriaSetId + 2,
          criteria_set_id: criteriaSetId,
          rule_type: "MAX_ACTIVE_BACKLOGS",
          numeric_value: Number(maxBacklogs),
        },
        {
          id: criteriaSetId + 3,
          criteria_set_id: criteriaSetId,
          rule_type: "ALLOWED_DEPARTMENTS",
          item_ids: departmentIds,
        },
      ];

      db.setState((draft) => {
        draft.criteria_sets.push({
          id: criteriaSetId,
          rules: criteriaRules,
        });

        draft.drives.push({
          id: driveId,
          company_id: companyId,
          academic_year_id: yearId,
          title: title.trim(),
          description: description.trim() || undefined,
          drive_date: date,
          status: "Registration Open",
          criteria_set_id: criteriaSetId,
          stages: stages.map((st, i) => ({
            id: driveId * 100 + i + 1,
            drive_id: driveId,
            name: st,
            stage_type: "Technical",
            sequence: i + 1,
          })),
          roles: [],
          created_at: now,
          updated_at: now,
        });
      });

      logAudit({
        userId: user?.id || 1,
        userName: user?.name || "Placement Staff",
        action: "CREATE_DRIVE",
        entityType: "Drive",
        entityId: title.trim(),
        summary: `Created recruitment drive ${title.trim()} with ${departmentIds.length} eligible departments`,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-light)] text-[var(--color-brand)]">
              <Briefcase size={18} />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {isEdit ? "Edit Placement Drive" : "Create Placement Drive"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-700">{error}</div>}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Recruiter Company *</label>
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 font-medium"
              >
                {state.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Academic Year *</label>
              <select
                value={yearId}
                onChange={(e) => setYearId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 font-medium"
              >
                {state.academic_years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Drive Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. TCS Campus Recruitment 2025"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 font-semibold"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Eligible Department(s) * <span className="text-rose-500 font-bold">(Compulsory in Placement Drive)</span>
              </label>
              <span className="text-[10px] text-slate-400">
                {departmentIds.length === 0 ? "None selected" : `${departmentIds.length} selected`}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {state.departments.map((dept) => {
                const isChecked = departmentIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setDepartmentIds((prev) =>
                        isChecked ? prev.filter((id) => id !== dept.id) : [...prev, dept.id]
                      );
                    }}
                    className={clsx(
                      "flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                      isChecked
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)] ring-1 ring-[var(--color-brand)]"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <span>{dept.code}</span>
                    <span className="text-[10px] opacity-75">{dept.name.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Description</label>
            <textarea
              rows={2}
              placeholder="Drive description or hiring specifications..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Scheduled Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Min CGPA</label>
              <input
                type="number"
                step="0.1"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Max Backlogs</label>
              <input
                type="number"
                value={maxBacklogs}
                onChange={(e) => setMaxBacklogs(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-brand)] px-5 py-2 font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
            >
              {isEdit ? "Update Drive" : "Save Drive"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
