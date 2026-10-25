import { useState, useRef } from "react";
import {
  X,
  User,
  GraduationCap,
  Briefcase,
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Download,
  Pencil,
} from "lucide-react";
import clsx from "clsx";
import { db } from "@/db/storage";
import {
  SubjectMark,
  SemesterRecord,
  StudentDocument,
  DocumentCategory,
  Gender,
} from "@/types";
import {
  calculateSemesterPercentage,
  calculateAggregatePercentage,
  calculateCgpa,
  getActiveBacklogCount,
} from "@/services/academics";
import { logAudit } from "@/services/audit";
import { useAuthStore } from "@/store/auth";
import { validatePdfMagicBytes, sha256Hex } from "@/services/security";

interface Props {
  studentId: number;
  onClose: () => void;
}

export function StudentProfileModal({ studentId, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const state = db.getState();
  const student = state.students.find((s) => s.id === studentId);
  const course = state.courses.find((c) => c.id === student?.course_id);
  const dept = state.departments.find((d) => d.id === student?.department_id);
  const batch = state.batches.find((b) => b.id === student?.batch_id);

  const [activeTab, setActiveTab] = useState<"PERSONAL" | "ACADEMICS" | "PLACEMENTS">("PERSONAL");
  const [docCategory, setDocCategory] = useState<DocumentCategory>("Resume");
  const [docTitle, setDocTitle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Semester management state
  const [showAddSemester, setShowAddSemester] = useState(false);
  const [editingSemRecord, setEditingSemRecord] = useState<SemesterRecord | null>(null);
  const [newSemNumber, setNewSemNumber] = useState(1);
  const [newSemSgpa, setNewSemSgpa] = useState("");
  const [newSubjects, setNewSubjects] = useState<
    { name: string; code: string; obtained: string; max: string; credits: string }[]
  >([{ name: "Engineering Mathematics", code: "MAT101", obtained: "82", max: "100", credits: "4" }]);

  // New backlog state
  const [showAddBacklog, setShowAddBacklog] = useState(false);
  const [backlogSubjName, setBacklogSubjName] = useState("");
  const [backlogSubjCode, setBacklogSubjCode] = useState("");
  const [backlogSemNum, setBacklogSemNum] = useState(1);

  // Edit Personal Details state
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [editName, setEditName] = useState(student?.full_name || "");
  const [editEmail, setEditEmail] = useState(student?.email || "");
  const [editPhone, setEditPhone] = useState(student?.phone || "");
  const [editGender, setEditGender] = useState<Gender>(student?.gender || "Male");
  const [editPassingYear, setEditPassingYear] = useState(student?.passing_year || 2025);
  const [editCgpa, setEditCgpa] = useState(student?.cgpa !== null && student?.cgpa !== undefined ? String(student.cgpa) : "");

  if (!student) return null;

  const semesters = state.semester_records.filter((r) => r.student_id === student.id);
  const backlogs = state.backlogs.filter((b) => b.student_id === student.id);
  const documents = state.student_documents.filter((d) => d.student_id === student.id);
  const applications = state.applications.filter((a) => a.student_id === student.id);

  const offers = state.offers.filter((o) =>
    applications.some((a) => a.id === o.application_id)
  );

  const activeBacklogs = getActiveBacklogCount(backlogs);
  const aggregatePercentage = calculateAggregatePercentage(semesters);
  const computedCgpa = calculateCgpa(course, semesters, student.cgpa);
  const isPlaced = offers.some((o) => o.offer_status === "Accepted");

  // ─── PDF Upload Handler (PRD DOC-01: PDF only, max 25MB, Magic Byte Verified) ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate PDF extension and mime type
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setUploadError("Only PDF documents (.pdf) are allowed.");
      return;
    }

    // Validate 25MB limit
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("Document exceeds maximum size of 25 MB.");
      return;
    }

    // Inspect binary magic bytes (%PDF-)
    const magicCheck = await validatePdfMagicBytes(file);
    if (!magicCheck.valid) {
      setUploadError(magicCheck.reason || "Security violation: File header fails PDF binary magic byte check.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const authenticSha256 = (await sha256Hex(arrayBuffer)).toUpperCase();

      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        const dataUrl = uploadEvt.target?.result as string;
        const now = new Date().toISOString();
        const docId = Date.now();

        db.setState((draft) => {
          draft.student_documents.push({
            id: docId,
            student_id: student.id,
            category: docCategory,
            title: docTitle.trim() || file.name,
            original_filename: file.name,
            relative_path: `documents/${student.registration_number}/${file.name}`,
            size_bytes: file.size,
            sha256: authenticSha256,
            uploaded_at: now,
            uploaded_by: user?.id || 1,
            data_url: dataUrl,
          });
        });

        logAudit({
          userId: user?.id || 1,
          userName: user?.name || "Placement Staff",
          action: "UPLOAD_DOCUMENT",
          entityType: "Document",
          entityId: file.name,
          summary: `Uploaded PDF (${docCategory}) for student ${student.registration_number} [SHA-256: ${authenticSha256.slice(0, 12)}...]`,
        });

        setDocTitle("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to process document.";
      setUploadError(`Document processing error: ${msg}`);
    }
  };

  const handleDeleteDocument = (doc: StudentDocument) => {
    if (!confirm(`Delete "${doc.original_filename}"? This action is audited.`)) return;

    db.setState((draft) => {
      draft.student_documents = draft.student_documents.filter((d) => d.id !== doc.id);
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "DELETE_DOCUMENT",
      entityType: "Document",
      entityId: doc.original_filename,
      summary: `Removed PDF ${doc.original_filename} from student ${student.registration_number}`,
    });
  };

  // ─── Semester Record Handlers ─────────────────────────────────────────────
  const handleStartAddSemester = () => {
    setEditingSemRecord(null);
    const nextSem = semesters.length > 0 ? Math.max(...semesters.map((s) => s.semester_number)) + 1 : 1;
    setNewSemNumber(nextSem);
    setNewSemSgpa("");
    setNewSubjects([
      { name: "Subject 1", code: "SUB101", obtained: "80", max: "100", credits: "4" },
      { name: "Subject 2", code: "SUB102", obtained: "75", max: "100", credits: "4" },
    ]);
    setShowAddSemester(true);
  };

  const handleStartEditSemester = (sem: SemesterRecord) => {
    setEditingSemRecord(sem);
    setNewSemNumber(sem.semester_number);
    setNewSemSgpa(sem.sgpa !== null && sem.sgpa !== undefined ? String(sem.sgpa) : "");
    setNewSubjects(
      sem.subjects.map((s) => ({
        name: s.subject_name,
        code: s.subject_code || "",
        obtained: String(s.marks_obtained),
        max: String(s.max_marks),
        credits: String(s.credits || 4),
      }))
    );
    setShowAddSemester(true);
  };

  const handleSaveSemester = () => {
    if (newSubjects.length === 0) {
      alert("Please enter at least one subject.");
      return;
    }
    const semId = editingSemRecord ? editingSemRecord.id : Date.now();

    const createdSubjects: SubjectMark[] = newSubjects.map((s, idx) => ({
      id: semId + idx + 1,
      semester_record_id: semId,
      subject_name: s.name.trim() || `Subject ${idx + 1}`,
      subject_code: s.code.trim() || undefined,
      marks_obtained: Number(s.obtained) || 0,
      max_marks: Number(s.max) || 100,
      credits: Number(s.credits) || null,
    }));

    db.setState((draft) => {
      if (editingSemRecord) {
        const idx = draft.semester_records.findIndex((r) => r.id === editingSemRecord.id);
        if (idx !== -1) {
          draft.semester_records[idx].semester_number = Number(newSemNumber);
          draft.semester_records[idx].sgpa = newSemSgpa ? Number(newSemSgpa) : null;
          draft.semester_records[idx].subjects = createdSubjects;
        }
      } else {
        draft.semester_records.push({
          id: semId,
          student_id: student.id,
          semester_number: Number(newSemNumber),
          sgpa: newSemSgpa ? Number(newSemSgpa) : null,
          subjects: createdSubjects,
        });
      }

      // Update student CGPA if configured as MeanOfSgpa
      const updatedSems = draft.semester_records.filter((r) => r.student_id === student.id);
      const newCgpa = calculateCgpa(course, updatedSems, student.cgpa);
      const stIdx = draft.students.findIndex((s) => s.id === student.id);
      if (stIdx !== -1) {
        draft.students[stIdx].cgpa = newCgpa;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: editingSemRecord ? "UPDATE_SEMESTER_RECORD" : "ADD_SEMESTER_RECORD",
      entityType: "Academics",
      entityId: student.registration_number,
      summary: `${editingSemRecord ? "Updated" : "Added"} semester ${newSemNumber} marks for student ${student.registration_number}`,
    });

    setShowAddSemester(false);
    setEditingSemRecord(null);
  };

  // ─── Backlog Handlers ───────────────────────────────────────────────────────
  const handleAddBacklog = () => {
    if (!backlogSubjName.trim()) return;
    const now = new Date().toISOString();

    db.setState((draft) => {
      draft.backlogs.push({
        id: Date.now(),
        student_id: student.id,
        subject_name: backlogSubjName.trim(),
        subject_code: backlogSubjCode.trim() || undefined,
        semester_number: Number(backlogSemNum),
        status: "Active",
        created_at: now,
        updated_at: now,
      });
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "ADD_BACKLOG",
      entityType: "Academics",
      entityId: student.registration_number,
      summary: `Logged active backlog in ${backlogSubjName} for ${student.registration_number}`,
    });

    setBacklogSubjName("");
    setBacklogSubjCode("");
    setShowAddBacklog(false);
  };

  const handleMarkBacklogCleared = (backlogId: number) => {
    const now = new Date().toISOString();

    db.setState((draft) => {
      const b = draft.backlogs.find((item) => item.id === backlogId);
      if (b) {
        b.status = "Cleared";
        b.cleared_on = now.split("T")[0];
        b.updated_at = now;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "CLEAR_BACKLOG",
      entityType: "Academics",
      entityId: student.registration_number,
      summary: `Marked backlog ${backlogId} as Cleared for student ${student.registration_number}`,
    });
  };

  const handleSavePersonal = () => {
    if (!editName.trim()) {
      alert("Student name is required.");
      return;
    }
    const now = new Date().toISOString();
    db.setState((draft) => {
      const s = draft.students.find((item) => item.id === student.id);
      if (s) {
        s.full_name = editName.trim();
        s.email = editEmail.trim() || undefined;
        s.phone = editPhone.trim() || undefined;
        s.gender = editGender;
        s.passing_year = Number(editPassingYear);
        if (editCgpa.trim()) {
          s.cgpa = Number(editCgpa);
        }
        s.updated_at = now;
        s.updated_by = user?.id || 1;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UPDATE_STUDENT",
      entityType: "Student",
      entityId: student.registration_number,
      summary: `Updated personal details for student ${student.registration_number}`,
    });

    setIsEditingPersonal(false);
  };

  const handleDeleteSemester = (semId: number) => {
    if (!confirm("Are you sure you want to delete this semester record? CGPA will be recalculated.")) return;

    db.setState((draft) => {
      draft.semester_records = draft.semester_records.filter((r) => r.id !== semId);
      const updatedSems = draft.semester_records.filter((r) => r.student_id === student.id);
      const newCgpa = calculateCgpa(course, updatedSems, student.cgpa);
      const s = draft.students.find((item) => item.id === student.id);
      if (s) {
        s.cgpa = newCgpa;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "DELETE_SEMESTER_RECORD",
      entityType: "Academics",
      entityId: student.registration_number,
      summary: `Deleted semester record #${semId} for ${student.registration_number}`,
    });
  };

  const handleDeleteBacklog = (backlogId: number) => {
    if (!confirm("Are you sure you want to delete this backlog entry?")) return;

    db.setState((draft) => {
      draft.backlogs = draft.backlogs.filter((b) => b.id !== backlogId);
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "DELETE_BACKLOG",
      entityType: "Academics",
      entityId: student.registration_number,
      summary: `Deleted backlog entry #${backlogId} for ${student.registration_number}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        {/* Profile Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand)] text-white text-sm font-bold shadow-sm shadow-[#9e2040]/25">
              {student.full_name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {student.full_name}
                </h2>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {student.registration_number}
                </span>
                {isPlaced ? (
                  <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900 px-2 py-0.5 text-[10px] font-bold">
                    Placed
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 text-[10px] font-medium">
                    Not Placed
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {dept?.name} ({dept?.code}) · {course?.code} · Batch {batch?.label} (Passing {student.passing_year})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 3 Nav Tabs (PRD Section 5.2 #STU-06) */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 gap-6 bg-white dark:bg-[#12151d]">
          <button
            onClick={() => setActiveTab("PERSONAL")}
            className={clsx(
              "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "PERSONAL"
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <User size={15} />
            Personal Details & Documents
          </button>

          <button
            onClick={() => setActiveTab("ACADEMICS")}
            className={clsx(
              "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "ACADEMICS"
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <GraduationCap size={15} />
            Academics & Backlogs
            {activeBacklogs > 0 && (
              <span className="rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 px-1.5 py-0.2 text-[10px] font-bold">
                {activeBacklogs}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("PLACEMENTS")}
            className={clsx(
              "flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "PLACEMENTS"
                ? "border-[var(--color-brand)] text-[var(--color-brand)]"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Briefcase size={15} />
            Placements & Offers
            {offers.length > 0 && (
              <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-bold">
                {offers.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ─── TAB 1: PERSONAL DETAILS & DOCUMENTS ─────────────────────────── */}
          {activeTab === "PERSONAL" && (
            <div className="space-y-6">
              {/* Personal attributes card */}
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    General Information
                  </h3>
                  {!isEditingPersonal ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPersonal(true)}
                      className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
                    >
                      Edit Details
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingPersonal(false)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePersonal}
                        className="px-3 py-1 rounded-lg bg-[var(--color-brand)] text-xs font-semibold text-white shadow-xs"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {!isEditingPersonal ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <p className="text-slate-400 text-[11px]">Email</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {student.email || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Phone</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {student.phone || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Gender</p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {student.gender || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-[11px]">Passing Year</p>
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {student.passing_year}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Phone
                      </label>
                      <input
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Gender
                      </label>
                      <select
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as Gender)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Passing Year
                      </label>
                      <input
                        type="number"
                        value={editPassingYear}
                        onChange={(e) => setEditPassingYear(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                        Baseline CGPA
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editCgpa}
                        onChange={(e) => setEditCgpa(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Student Documents (DOC-01 to DOC-07) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Student PDF Documents
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Resumes, marksheets and certificates (PDF only, max 25 MB)
                    </p>
                  </div>
                </div>

                {uploadError && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle size={15} />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Upload bar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900/60">
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                  >
                    <option value="Resume">Resume</option>
                    <option value="Marksheet">Marksheet</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Identity Document">Identity Document</option>
                    <option value="Internship Certificate">Internship Certificate</option>
                    <option value="Other">Other</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Document title (optional)"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-700 dark:text-slate-300"
                  />

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] shrink-0 transition-colors"
                  >
                    <Upload size={14} />
                    Upload PDF
                  </button>
                </div>

                {/* Documents table */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400">
                        <th className="px-4 py-2.5 text-left font-semibold">Category</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Title / Filename</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Size</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Uploaded</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {documents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                            No documents attached yet.
                          </td>
                        </tr>
                      ) : (
                        documents.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                {doc.category}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800 dark:text-slate-200">{doc.title}</p>
                              <p className="text-[10px] text-slate-400">{doc.original_filename}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">
                              {(doc.size_bytes / 1024).toFixed(1)} KB
                            </td>
                            <td className="px-4 py-3 text-slate-500">{doc.uploaded_at.split("T")[0]}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {doc.data_url && (
                                  <a
                                    href={doc.data_url}
                                    download={doc.original_filename}
                                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    title="Download PDF"
                                  >
                                    <Download size={14} />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteDocument(doc)}
                                  className="p-1 text-slate-400 hover:text-rose-500"
                                  title="Delete Document"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── TAB 2: ACADEMICS & BACKLOGS ─────────────────────────────────── */}
          {activeTab === "ACADEMICS" && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Current CGPA
                  </p>
                  <p className="mt-1 text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                    {computedCgpa !== null && computedCgpa !== undefined
                      ? computedCgpa.toFixed(2)
                      : "—"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Calculation: {course?.cgpa_method || "Manual"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Aggregate Percentage
                  </p>
                  <p className="mt-1 text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                    {aggregatePercentage !== null ? `${aggregatePercentage}%` : "—"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Across recorded semesters</p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/30 text-center">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Active Backlogs
                  </p>
                  <p
                    className={clsx(
                      "mt-1 text-2xl font-bold font-mono",
                      activeBacklogs > 0 ? "text-rose-600" : "text-emerald-600"
                    )}
                  >
                    {activeBacklogs}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {backlogs.length - activeBacklogs} Cleared History
                  </p>
                </div>
              </div>

              {/* Semesters list */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Semester Records ({semesters.length})
                  </h3>
                  <button
                    onClick={handleStartAddSemester}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors"
                  >
                    <Plus size={14} />
                    Add Semester
                  </button>
                </div>

                {semesters.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
                    No semester marks recorded yet. Click "Add Semester" to record subjects.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {semesters.map((sem) => {
                      const semPercentage = calculateSemesterPercentage(sem.subjects);
                      return (
                        <div
                          key={sem.id}
                          className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 overflow-hidden"
                        >
                          <div className="flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/60 px-4 py-2.5 border-b border-slate-200/60 dark:border-slate-800">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                              Semester {sem.semester_number}
                            </span>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              {sem.sgpa && (
                                <span className="text-slate-600 dark:text-slate-300">
                                  SGPA: <strong>{sem.sgpa.toFixed(2)}</strong>
                                </span>
                              )}
                              {semPercentage !== null && (
                                <span className="text-[var(--color-brand)] font-semibold">
                                  {semPercentage}%
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleStartEditSemester(sem)}
                                title="Edit Semester Record"
                                className="p-1 rounded text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSemester(sem.id)}
                                title="Delete Semester Record"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          <table className="w-full text-xs">
                            <thead className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium">Subject</th>
                                <th className="px-4 py-2 text-left font-medium">Code</th>
                                <th className="px-4 py-2 text-right font-medium">Obtained</th>
                                <th className="px-4 py-2 text-right font-medium">Max</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {sem.subjects.map((s) => (
                                <tr key={s.id}>
                                  <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">
                                    {s.subject_name}
                                  </td>
                                  <td className="px-4 py-2 font-mono text-slate-400">{s.subject_code || "-"}</td>
                                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {s.marks_obtained}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-slate-400">{s.max_marks}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Backlogs Manager */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Backlogs Tracker
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Active backlogs affect placement eligibility. Cleared history is preserved.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddBacklog(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    <Plus size={14} />
                    Record Backlog
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400">
                        <th className="px-4 py-2.5 text-left font-semibold">Subject</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Code</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Semester</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {backlogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            Zero backlogs recorded. Excellent standing.
                          </td>
                        </tr>
                      ) : (
                        backlogs.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                              {b.subject_name}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-slate-400">{b.subject_code || "-"}</td>
                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                              Sem {b.semester_number}
                            </td>
                            <td className="px-4 py-2.5">
                              {b.status === "Active" ? (
                                <span className="rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 px-2 py-0.5 text-[10px] font-bold">
                                  Active
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                                  Cleared ({b.cleared_on})
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {b.status === "Active" && (
                                  <button
                                    onClick={() => handleMarkBacklogCleared(b.id)}
                                    className="text-xs font-semibold text-emerald-600 hover:underline"
                                  >
                                    Mark Cleared
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBacklog(b.id)}
                                  title="Delete Backlog"
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add / Edit Semester Dialog */}
              {showAddSemester && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      {editingSemRecord ? `Edit Semester ${editingSemRecord.semester_number} Marks` : "New Semester Record"}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSemester(false);
                        setEditingSemRecord(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 rounded p-1"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Semester Number *</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newSemNumber}
                        onChange={(e) => setNewSemNumber(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">SGPA (optional)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 8.40"
                        value={newSemSgpa}
                        onChange={(e) => setNewSemSgpa(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Subjects editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Subjects & Marks ({newSubjects.length})
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setNewSubjects((prev) => [
                            ...prev,
                            { name: `Subject ${prev.length + 1}`, code: `SUB${prev.length + 1}`, obtained: "80", max: "100", credits: "4" },
                          ])
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-brand)] hover:underline"
                      >
                        <Plus size={12} /> Add Subject
                      </button>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {newSubjects.map((sub, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200/70 dark:border-slate-700">
                          <input
                            type="text"
                            placeholder="Subject Name"
                            value={sub.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, name: val } : s)));
                            }}
                            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs bg-slate-50 dark:bg-slate-900"
                          />
                          <input
                            type="text"
                            placeholder="Code"
                            value={sub.code}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, code: val } : s)));
                            }}
                            className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-mono bg-slate-50 dark:bg-slate-900 uppercase"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="Obt"
                              value={sub.obtained}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, obtained: val } : s)));
                              }}
                              className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-mono text-right bg-slate-50 dark:bg-slate-900"
                            />
                            <span className="text-slate-400 text-xs">/</span>
                            <input
                              type="number"
                              placeholder="Max"
                              value={sub.max}
                              onChange={(e) => {
                                const val = e.target.value;
                                setNewSubjects((prev) => prev.map((s, i) => (i === idx ? { ...s, max: val } : s)));
                              }}
                              className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-mono text-right bg-slate-50 dark:bg-slate-900"
                            />
                          </div>
                          {newSubjects.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setNewSubjects((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddSemester(false);
                        setEditingSemRecord(null);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSemester}
                      className="px-4 py-1.5 text-xs font-semibold bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white rounded-xl shadow-sm transition-colors"
                    >
                      {editingSemRecord ? "Update Semester" : "Save Semester"}
                    </button>
                  </div>
                </div>
              )}

              {/* Add Backlog Dialog */}
              {showAddBacklog && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Record New Backlog
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Subject Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Engineering Mathematics"
                        value={backlogSubjName}
                        onChange={(e) => setBacklogSubjName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Subject Code</label>
                      <input
                        type="text"
                        placeholder="e.g. MAT201"
                        value={backlogSubjCode}
                        onChange={(e) => setBacklogSubjCode(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">Semester</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={backlogSemNum}
                        onChange={(e) => setBacklogSemNum(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowAddBacklog(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddBacklog}
                      className="px-4 py-1.5 text-xs font-semibold bg-[var(--color-brand)] text-white rounded-xl shadow-sm"
                    >
                      Save Backlog
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── TAB 3: PLACEMENTS & OFFERS (PRD Section 5.8 & OFR-06) ────────── */}
          {activeTab === "PLACEMENTS" && (
            <div className="space-y-6">
              {/* Placed summary banner */}
              <div
                className={clsx(
                  "flex items-center justify-between rounded-2xl border p-4",
                  isPlaced
                    ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
                    : "bg-slate-50/70 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      isPlaced ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600"
                    )}
                  >
                    <Briefcase size={20} />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isPlaced ? "Placed Student" : "Placement Pending"}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {offers.filter((o) => o.offer_status === "Accepted").length} accepted offer(s) recorded
                    </p>
                  </div>
                </div>
              </div>

              {/* Offers Held Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Offers Held ({offers.length})
                </h3>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400">
                        <th className="px-4 py-2.5 text-left font-semibold">Designation</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Annual Package</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Offer Date</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Offer Status</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Joining Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {offers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            No offers recorded yet.
                          </td>
                        </tr>
                      ) : (
                        offers.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {o.designation}
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-emerald-600">
                              ₹{(o.annual_salary / 100000).toFixed(2)} LPA
                            </td>
                            <td className="px-4 py-3 text-slate-500">{o.offer_date}</td>
                            <td className="px-4 py-3">
                              <span
                                className={clsx(
                                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                  o.offer_status === "Accepted" &&
                                    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
                                  o.offer_status === "Pending" &&
                                    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                                  o.offer_status === "Declined" &&
                                    "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                                )}
                              >
                                {o.offer_status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={clsx(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  o.joining_status === "Joined"
                                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                )}
                              >
                                {o.joining_status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Drive Applications Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Drive Applications ({applications.length})
                </h3>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400">
                        <th className="px-4 py-2.5 text-left font-semibold">Drive Title</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Company</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Applied Date</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Final Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {applications.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                            No drive applications submitted.
                          </td>
                        </tr>
                      ) : (
                        applications.map((app) => {
                          const drive = state.drives.find((d) => d.id === app.drive_id);
                          const comp = state.companies.find((c) => c.id === drive?.company_id);
                          return (
                            <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                {drive?.title || "Recruitment Drive"}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                {comp?.name || "Company"}
                              </td>
                              <td className="px-4 py-3 text-slate-500">{app.applied_date}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={clsx(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                    app.final_outcome === "Selected" &&
                                      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
                                    app.final_outcome === "Pending" &&
                                      "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                                    app.final_outcome === "Rejected" &&
                                      "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
                                    app.final_outcome === "Withdrawn" &&
                                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                  )}
                                >
                                  {app.final_outcome}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
