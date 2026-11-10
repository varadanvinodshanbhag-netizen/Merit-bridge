import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  Search,
  Plus,
  Download,
  Eye,
  Archive,
  RotateCcw,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from "lucide-react";
import clsx from "clsx";
import { db } from "@/db/storage";
import { Student, Gender } from "@/types";
import { exportToExcel, exportToCsv } from "@/services/exporter";
import { logAudit } from "@/services/audit";
import { useAuthStore } from "@/store/auth";
import { StudentProfileModal } from "./StudentProfileModal";

export default function StudentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const [dbState, setDbState] = useState(db.getState());
  const [search, setSearch] = useState("");
  const [filterCourseId, setFilterCourseId] = useState<number | "">("");
  const [filterDeptId, setFilterDeptId] = useState<number | "">("");
  const [filterBatchId, setFilterBatchId] = useState<number | "">("");
  const [filterPlaced, setFilterPlaced] = useState<"ALL" | "PLACED" | "NOT_PLACED">("ALL");
  const [showArchived, setShowArchived] = useState(false);

  const [sortField, setSortField] = useState<keyof Student>("registration_number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Student | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleteConfirmationReg, setDeleteConfirmationReg] = useState("");

  // Sync with database updates
  useEffect(() => {
    return db.subscribe(() => {
      setDbState(db.getState());
    });
  }, []);

  // Handle URL query action (e.g. ?action=add or ?id=1)
  useEffect(() => {
    const action = searchParams.get("action");
    const id = searchParams.get("id");
    if (action === "add") setShowAddModal(true);
    if (id) setSelectedStudentId(Number(id));
  }, [searchParams]);

  // Map of placed student IDs (has accepted offer)
  const placedStudentIds = useMemo(() => {
    const set = new Set<number>();
    const acceptedOffers = dbState.offers.filter((o) => o.offer_status === "Accepted");
    for (const offer of acceptedOffers) {
      const app = dbState.applications.find((a) => a.id === offer.application_id);
      if (app) set.add(app.student_id);
    }
    return set;
  }, [dbState.offers, dbState.applications]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return dbState.students.filter((s) => {
      // Archived toggle
      if (!showArchived && s.archived_at) return false;
      if (showArchived && !s.archived_at) return false;

      // Dropdown filters
      if (filterCourseId && s.course_id !== filterCourseId) return false;
      if (filterDeptId && s.department_id !== filterDeptId) return false;
      if (filterBatchId && s.batch_id !== filterBatchId) return false;

      // Placement status
      if (filterPlaced === "PLACED" && !placedStudentIds.has(s.id)) return false;
      if (filterPlaced === "NOT_PLACED" && placedStudentIds.has(s.id)) return false;

      // Search query (reg no, name, email, phone)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesReg = s.registration_number.toLowerCase().includes(q);
        const matchesName = s.full_name.toLowerCase().includes(q);
        const matchesEmail = s.email?.toLowerCase().includes(q) || false;
        const matchesPhone = s.phone?.includes(q) || false;
        if (!matchesReg && !matchesName && !matchesEmail && !matchesPhone) return false;
      }

      return true;
    });
  }, [
    dbState.students,
    showArchived,
    filterCourseId,
    filterDeptId,
    filterBatchId,
    filterPlaced,
    placedStudentIds,
    search,
  ]);

  // Sorting
  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    list.sort((a, b) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredStudents, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedStudents.length / pageSize) || 1;
  const paginatedStudents = sortedStudents.slice(
    pageIndex * pageSize,
    pageIndex * pageSize + pageSize
  );

  // Toggle sort
  const handleSort = (field: keyof Student) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Export filtered students
  const handleExport = (formatType: "xlsx" | "csv") => {
    const exportRows = sortedStudents.map((s) => {
      const course = dbState.courses.find((c) => c.id === s.course_id)?.code || "";
      const dept = dbState.departments.find((d) => d.id === s.department_id)?.code || "";
      const batch = dbState.batches.find((b) => b.id === s.batch_id)?.label || "";
      const isPlaced = placedStudentIds.has(s.id);
      return {
        "Registration Number": s.registration_number,
        "Full Name": s.full_name,
        Course: course,
        Department: dept,
        Batch: batch,
        "Passing Year": s.passing_year,
        CGPA: s.cgpa ?? "N/A",
        "Placed Status": isPlaced ? "Placed" : "Not Placed",
        Email: s.email || "",
        Phone: s.phone || "",
      };
    });

    const filters = {
      Search: search || "None",
      Course: filterCourseId ? dbState.courses.find((c) => c.id === filterCourseId)?.name : "All",
      Department: filterDeptId ? dbState.departments.find((d) => d.id === filterDeptId)?.name : "All",
      Placement: filterPlaced,
      Archived: showArchived ? "Yes" : "No",
    };

    if (formatType === "xlsx") {
      exportToExcel({
        filename: "MeritBridge_Students",
        data: exportRows,
        filtersApplied: filters,
        staffName: user?.name || "Placement Staff",
      });
    } else {
      exportToCsv({
        filename: "MeritBridge_Students",
        data: exportRows,
      });
    }
  };

  // Archive / Restore student
  const handleToggleArchive = (student: Student) => {
    const isArchived = Boolean(student.archived_at);
    const now = new Date().toISOString();

    db.setState((draft) => {
      const idx = draft.students.findIndex((s) => s.id === student.id);
      if (idx !== -1) {
        draft.students[idx].archived_at = isArchived ? null : now;
        draft.students[idx].archived_by = isArchived ? null : user?.id || 1;
        draft.students[idx].archive_reason = isArchived ? null : archiveReason || "Manual archive";
        draft.students[idx].updated_at = now;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: isArchived ? "RESTORE_STUDENT" : "ARCHIVE_STUDENT",
      entityType: "Student",
      entityId: student.registration_number,
      summary: isArchived
        ? `Restored student ${student.full_name} (${student.registration_number})`
        : `Archived student ${student.full_name} (${student.registration_number}). Reason: ${archiveReason}`,
      reason: archiveReason,
    });

    setArchiveTarget(null);
    setArchiveReason("");
  };

  // Permanent Delete student (PRD STU-08: Only archived with NO recruitment history)
  const handlePermanentDelete = () => {
    if (!deleteTarget) return;
    if (deleteConfirmationReg.trim().toUpperCase() !== deleteTarget.registration_number.toUpperCase()) {
      alert("Registration number does not match. Deletion cancelled.");
      return;
    }

    db.setState((draft) => {
      draft.students = draft.students.filter((s) => s.id !== deleteTarget.id);
      draft.semester_records = draft.semester_records.filter((r) => r.student_id !== deleteTarget.id);
      draft.backlogs = draft.backlogs.filter((b) => b.student_id !== deleteTarget.id);
      draft.student_documents = draft.student_documents.filter((d) => d.student_id !== deleteTarget.id);
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "DELETE_STUDENT_PERMANENT",
      entityType: "Student",
      entityId: deleteTarget.registration_number,
      summary: `Permanently deleted archived student tombstone: ${deleteTarget.full_name} (${deleteTarget.registration_number})`,
    });

    setDeleteTarget(null);
    setDeleteConfirmationReg("");
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Student Directory</span>
          </h1>
          <p className="mt-0.5 text-xs lg:text-sm text-slate-500 dark:text-slate-400">
            {showArchived ? "Archived Students Directory" : "Active Students Directory"} · {filteredStudents.length} records found
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport("xlsx")}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm transition-colors"
          >
            <Download size={14} className="text-slate-400" />
            Export Excel
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            <Plus size={15} />
            Add Student
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] dark:ring-0">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by registration number, name, email or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
            />
          </div>

          {/* Course filter */}
          <select
            value={filterCourseId}
            onChange={(e) => {
              setFilterCourseId(e.target.value ? Number(e.target.value) : "");
              setFilterDeptId("");
              setPageIndex(0);
            }}
            className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Courses</option>
            {dbState.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>

          {/* Department filter */}
          <select
            value={filterDeptId}
            onChange={(e) => {
              setFilterDeptId(e.target.value ? Number(e.target.value) : "");
              setPageIndex(0);
            }}
            className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Departments</option>
            {dbState.departments
              .filter((d) => !filterCourseId || d.course_id === filterCourseId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code}
                </option>
              ))}
          </select>

          {/* Batch filter */}
          <select
            value={filterBatchId}
            onChange={(e) => {
              setFilterBatchId(e.target.value ? Number(e.target.value) : "");
              setPageIndex(0);
            }}
            className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Batches</option>
            {dbState.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>

          {/* Placed filter */}
          <select
            value={filterPlaced}
            onChange={(e) => {
              setFilterPlaced(e.target.value as "ALL" | "PLACED" | "NOT_PLACED");
              setPageIndex(0);
            }}
            className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Placements</option>
            <option value="PLACED">Placed Only</option>
            <option value="NOT_PLACED">Not Placed Only</option>
          </select>

          {/* Archived Toggle */}
          <button
            onClick={() => {
              setShowArchived((prev) => !prev);
              setPageIndex(0);
            }}
            className={clsx(
              "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors shrink-0",
              showArchived
                ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
            )}
          >
            <Archive size={14} />
            {showArchived ? "Viewing Archived" : "View Archived"}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] dark:ring-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
                <th
                  onClick={() => handleSort("registration_number")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Reg Number {sortField === "registration_number" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th
                  onClick={() => handleSort("full_name")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Student Name {sortField === "full_name" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Course & Dept
                </th>
                <th
                  onClick={() => handleSort("passing_year")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Batch {sortField === "passing_year" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th
                  onClick={() => handleSort("cgpa")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  CGPA {sortField === "cgpa" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Placement Status
                </th>
                <th className="px-4 py-3.5 text-right font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400">
                    No students match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => {
                  const dept = dbState.departments.find((d) => d.id === s.department_id);
                  const isPlaced = placedStudentIds.has(s.id);

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedStudentId(s.id)}
                    >
                      <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {s.registration_number}
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{s.full_name}</p>
                        <p className="text-[11px] text-slate-400">{s.email || "No email"}</p>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {dept?.code || "ENG"}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                        {s.passing_year}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {s.cgpa !== null && s.cgpa !== undefined ? s.cgpa.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {isPlaced ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900 px-2.5 py-0.5 text-[11px] font-semibold">
                            Placed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-0.5 text-[11px] font-medium">
                            Not Placed
                          </span>
                        )}
                      </td>
                      <td
                        className="px-4 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedStudentId(s.id)}
                            title="View Full Profile"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye size={15} />
                          </button>
                          {s.archived_at ? (
                            <>
                              <button
                                onClick={() => setArchiveTarget(s)}
                                title="Restore Student"
                                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              >
                                <RotateCcw size={15} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(s)}
                                title="Permanent Delete (Tombstone)"
                                className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setArchiveTarget(s)}
                              title="Archive Student"
                              className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Archive size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/40 dark:bg-slate-900/20">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Showing {sortedStudents.length > 0 ? pageIndex * pageSize + 1 : 0} –{" "}
              {Math.min((pageIndex + 1) * pageSize, sortedStudents.length)} of {sortedStudents.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700 dark:text-slate-300">
              Page {pageIndex + 1} of {totalPages}
            </span>
            <button
              disabled={pageIndex >= totalPages - 1}
              onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Student Profile Modal (3 Sections: Personal + Docs, Academics, Placements) */}
      {selectedStudentId !== null && (
        <StudentProfileModal
          studentId={selectedStudentId}
          onClose={() => {
            setSelectedStudentId(null);
            searchParams.delete("id");
            setSearchParams(searchParams);
          }}
        />
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <AddStudentModal
          onClose={() => {
            setShowAddModal(false);
            searchParams.delete("action");
            setSearchParams(searchParams);
          }}
        />
      )}

      {/* Archive / Restore Confirmation Modal */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {archiveTarget.archived_at ? "Restore Student Record" : "Archive Student Record"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {archiveTarget.archived_at
                ? `Restore ${archiveTarget.full_name} (${archiveTarget.registration_number}) to the active directory?`
                : `Archiving hides ${archiveTarget.full_name} (${archiveTarget.registration_number}) from default placement metrics and applicant pickers. All past history remains preserved.`}
            </p>

            {!archiveTarget.archived_at && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                  Archive Reason (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transferred / Inactive / Duplicate"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setArchiveTarget(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleToggleArchive(archiveTarget)}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors",
                  archiveTarget.archived_at
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {archiveTarget.archived_at ? "Confirm Restore" : "Confirm Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Deletion Tombstone Modal (PRD STU-08) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-[#12151d] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle size={20} />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Permanent Student Deletion
              </h3>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This action permanently deletes all academic records, semester marks, and documents for{" "}
              <strong className="text-slate-800 dark:text-slate-200">{deleteTarget.full_name}</strong>. An immutable audit tombstone will be recorded.
            </p>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Type <span className="font-mono font-bold text-rose-600">{deleteTarget.registration_number}</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmationReg}
              onChange={(e) => setDeleteConfirmationReg(e.target.value)}
              placeholder="Enter registration number"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono uppercase text-slate-800 dark:text-slate-200"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deleteConfirmationReg.trim().toUpperCase() !== deleteTarget.registration_number.toUpperCase()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-40 transition-colors"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const state = db.getState();

  const [regNo, setRegNo] = useState("");
  const [name, setName] = useState("");
  const [courseId, setCourseId] = useState<number>(state.courses[0]?.id || 1);
  const [deptId, setDeptId] = useState<number>(state.departments[0]?.id || 1);
  const [batchId, setBatchId] = useState<number>(state.batches[0]?.id || 1);
  const [passingYear, setPassingYear] = useState<number>(2025);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("Male");
  const [cgpa, setCgpa] = useState<string>("");
  const [internshipStatus, setInternshipStatus] = useState<"None" | "Active" | "Completed">("None");
  const [internshipCompany, setInternshipCompany] = useState("");
  const [internshipRole, setInternshipRole] = useState("");
  const [internshipDuration, setInternshipDuration] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Cascade department and batch when course changes
  const availableDepts = state.departments.filter((d) => d.course_id === courseId);
  const availableBatches = state.batches.filter((b) => b.course_id === courseId);

  const handleCourseChange = (newCourseId: number) => {
    setCourseId(newCourseId);
    const depts = state.departments.filter((d) => d.course_id === newCourseId);
    if (depts.length > 0) setDeptId(depts[0].id);
    const bts = state.batches.filter((b) => b.course_id === newCourseId);
    if (bts.length > 0) {
      setBatchId(bts[0].id);
      setPassingYear(bts[0].passing_year);
    }
  };

  const handleBatchChange = (newBatchId: number) => {
    setBatchId(newBatchId);
    const b = state.batches.find((item) => item.id === newBatchId);
    if (b) setPassingYear(b.passing_year);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReg = regNo.trim().toUpperCase();
    if (!cleanReg) {
      setError("Registration number is required");
      return;
    }
    if (!name.trim()) {
      setError("Full name is required");
      return;
    }

    // Check uniqueness (PRD STU-03: unique across active & archived)
    const exists = state.students.some((s) => s.registration_number.toUpperCase() === cleanReg);
    if (exists) {
      setError(`Registration number "${cleanReg}" already exists in the database.`);
      return;
    }

    const now = new Date().toISOString();
    const nextId = state.students.length > 0 ? Math.max(...state.students.map((s) => s.id)) + 1 : 1;

    db.setState((draft) => {
      draft.students.push({
        id: nextId,
        registration_number: cleanReg,
        full_name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        gender,
        course_id: courseId,
        department_id: deptId,
        batch_id: batchId,
        passing_year: passingYear,
        cgpa: cgpa ? Number(cgpa) : null,
        internship_status: internshipStatus,
        internship_company: internshipStatus !== "None" ? internshipCompany.trim() || undefined : undefined,
        internship_role: internshipStatus !== "None" ? internshipRole.trim() || undefined : undefined,
        internship_duration: internshipStatus !== "None" ? internshipDuration.trim() || undefined : undefined,
        created_at: now,
        updated_at: now,
        created_by: user?.id || 1,
        updated_by: user?.id || 1,
      });
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "ADD_STUDENT",
      entityType: "Student",
      entityId: cleanReg,
      summary: `Registered new student ${name.trim()} (${cleanReg})`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-light)] text-[var(--color-brand)]">
              <Users size={18} />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Add New Student</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Registration No *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 21CSE105"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="Student full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Course *</label>
              <select
                value={courseId}
                onChange={(e) => handleCourseChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                {state.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Department *</label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                {availableDepts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Batch *</label>
              <select
                value={batchId}
                onChange={(e) => handleBatchChange(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                {availableBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Passing Year *</label>
              <input
                type="number"
                value={passingYear}
                onChange={(e) => setPassingYear(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">CGPA (0 - 10)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                placeholder="e.g. 8.50"
                value={cgpa}
                onChange={(e) => setCgpa(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Email</label>
              <input
                type="email"
                placeholder="student@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Phone</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Internship Details (Optional)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Internship Status</label>
                <select
                  value={internshipStatus}
                  onChange={(e) => setInternshipStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="None">None (Seeking / Not Enrolled)</option>
                  <option value="Active">Active Internship</option>
                  <option value="Completed">Completed Internship</option>
                </select>
              </div>

              {internshipStatus !== "None" && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Host Company</label>
                  <input
                    type="text"
                    placeholder="e.g. Bosch Rexroth, Tata Motors"
                    value={internshipCompany}
                    onChange={(e) => setInternshipCompany(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                </div>
              )}
            </div>

            {internshipStatus !== "None" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Role / Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Trainee Engineer, Full Stack"
                    value={internshipRole}
                    onChange={(e) => setInternshipRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 6 Months, Jan - Jun 2025"
                    value={internshipDuration}
                    onChange={(e) => setInternshipDuration(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-brand)] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
            >
              Save Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
