import { useState, useMemo, useEffect } from "react";
import {
  Building2,
  Search,
  Download,
  Plus,
  Pencil,
  Eye,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";
import clsx from "clsx";
import { db } from "@/db/storage";
import { Student, InternshipStatus } from "@/types";
import { exportToExcel, exportToCsv } from "@/services/exporter";
import { logAudit } from "@/services/audit";
import { useAuthStore } from "@/store/auth";
import { StudentProfileModal } from "../students/StudentProfileModal";

export default function InternshipsPage() {
  const user = useAuthStore((s) => s.user);
  const [dbState, setDbState] = useState(db.getState());

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "NONE">("ALL");
  const [filterDeptId, setFilterDeptId] = useState<number | "">("");
  const [filterCompany, setFilterCompany] = useState<string>("");

  const [sortField, setSortField] = useState<"name" | "company" | "status" | "duration">("status");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  // Modals
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<number | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Sync with DB
  useEffect(() => {
    return db.subscribe(() => {
      setDbState(db.getState());
    });
  }, []);

  // Department map & active students
  const activeStudents = useMemo(() => {
    return dbState.students.filter((s) => !s.archived_at);
  }, [dbState.students]);

  // Unique companies hosting interns
  const hostCompanies = useMemo(() => {
    const set = new Set<string>();
    for (const s of activeStudents) {
      if (s.internship_company?.trim()) {
        set.add(s.internship_company.trim());
      }
    }
    return Array.from(set).sort();
  }, [activeStudents]);

  // KPI Metrics
  const metrics = useMemo(() => {
    let active = 0;
    let completed = 0;
    let none = 0;
    for (const s of activeStudents) {
      if (s.internship_status === "Active") active++;
      else if (s.internship_status === "Completed") completed++;
      else none++;
    }
    return {
      active,
      completed,
      none,
      total: activeStudents.length,
      companiesCount: hostCompanies.length,
    };
  }, [activeStudents, hostCompanies]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return activeStudents.filter((s) => {
      // Status filter
      if (filterStatus === "ACTIVE" && s.internship_status !== "Active") return false;
      if (filterStatus === "COMPLETED" && s.internship_status !== "Completed") return false;
      if (filterStatus === "NONE" && s.internship_status && s.internship_status !== "None") return false;

      // Department filter
      if (filterDeptId && s.department_id !== filterDeptId) return false;

      // Company filter
      if (filterCompany && s.internship_company?.toLowerCase() !== filterCompany.toLowerCase()) return false;

      // Search query (Student Name, Reg No, Company, Role)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = s.full_name.toLowerCase().includes(q);
        const matchesReg = s.registration_number.toLowerCase().includes(q);
        const matchesCompany = s.internship_company?.toLowerCase().includes(q) || false;
        const matchesRole = s.internship_role?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesReg && !matchesCompany && !matchesRole) return false;
      }

      return true;
    });
  }, [activeStudents, filterStatus, filterDeptId, filterCompany, search]);

  // Sorted Students
  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    list.sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortField === "name") {
        valA = a.full_name;
        valB = b.full_name;
      } else if (sortField === "company") {
        valA = a.internship_company || "";
        valB = b.internship_company || "";
      } else if (sortField === "status") {
        valA = a.internship_status || "None";
        valB = b.internship_status || "None";
      } else if (sortField === "duration") {
        valA = a.internship_duration || "";
        valB = b.internship_duration || "";
      }
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredStudents, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(sortedStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = pageIndex * pageSize;
    return sortedStudents.slice(start, start + pageSize);
  }, [sortedStudents, pageIndex, pageSize]);

  // Sort Handler
  const handleSort = (field: "name" | "company" | "status" | "duration") => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Export Handler
  const handleExport = (fmt: "xlsx" | "csv") => {
    const exportData = filteredStudents.map((s) => {
      const dept = dbState.departments.find((d) => d.id === s.department_id);
      return {
        "Registration Number": s.registration_number,
        "Student Name": s.full_name,
        Department: dept?.code || "—",
        "Internship Status": s.internship_status || "None",
        "Host Organization": s.internship_company || "—",
        "Role / Designation": s.internship_role || "—",
        "Duration / Timeline": s.internship_duration || "—",
      };
    });

    const opts = {
      filename: "Internship_Tracker_Report",
      sheetName: "Internships",
      data: exportData,
      filtersApplied: {
        Status: filterStatus,
        Department: filterDeptId ? dbState.departments.find((d) => d.id === filterDeptId)?.code : "All",
        Company: filterCompany || "All",
        Search: search || undefined,
      },
      staffName: user?.name || "Placement Staff",
    };

    if (fmt === "xlsx") exportToExcel(opts);
    else exportToCsv(opts);
  };

  return (
    <div className="space-y-6 select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Internship Tracker
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Industry Experience
            </span>
          </div>
          <p className="mt-0.5 text-xs lg:text-sm text-slate-500 dark:text-slate-400">
            Industry training assignments, active interns, host companies, and completion records.
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
            onClick={() => setIsAssignModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            <Plus size={15} />
            Assign Internship
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Interns</p>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
            {metrics.active}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Currently undergoing industry training
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed</p>
            <CheckCircle2 size={16} className="text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
            {metrics.completed}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Completed internship assignments
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Seeking Internship</p>
            <Clock size={16} className="text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
            {metrics.none}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Students needing internship placement
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Host Companies</p>
            <Building2 size={16} className="text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-slate-100">
            {metrics.companiesCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Partner industry recruiters
          </p>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-sm space-y-3">
        {/* Quick Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => {
              setFilterStatus("ALL");
              setPageIndex(0);
            }}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2",
              filterStatus === "ALL"
                ? "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <span>All Candidates</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
              {metrics.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterStatus("ACTIVE");
              setPageIndex(0);
            }}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2",
              filterStatus === "ACTIVE"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Active Interns</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {metrics.active}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterStatus("COMPLETED");
              setPageIndex(0);
            }}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2",
              filterStatus === "COMPLETED"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Completed Internships</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
              {metrics.completed}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterStatus("NONE");
              setPageIndex(0);
            }}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2",
              filterStatus === "NONE"
                ? "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] font-semibold"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <span>Seeking / None</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
              {metrics.none}
            </span>
          </button>
        </div>

        {/* Inputs row */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by student name, reg number, host company, or role..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPageIndex(0);
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
            />
          </div>

          <select
            value={filterDeptId}
            onChange={(e) => {
              setFilterDeptId(e.target.value ? Number(e.target.value) : "");
              setPageIndex(0);
            }}
            className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Departments</option>
            {dbState.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>

          <select
            value={filterCompany}
            onChange={(e) => {
              setFilterCompany(e.target.value);
              setPageIndex(0);
            }}
            className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            <option value="">All Host Companies</option>
            {hostCompanies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Internship Table */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40">
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Student & Reg No {sortField === "name" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Department
                </th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Internship Status {sortField === "status" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th
                  onClick={() => handleSort("company")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Host Organization {sortField === "company" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Role / Domain
                </th>
                <th
                  onClick={() => handleSort("duration")}
                  className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-700"
                >
                  Duration {sortField === "duration" ? (sortOrder === "asc" ? "↑" : "↓") : ""}
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
                    No internship records match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => {
                  const dept = dbState.departments.find((d) => d.id === s.department_id);

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => setEditingStudent(s)}
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{s.full_name}</p>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">{s.registration_number}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {dept?.code || "ENG"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {s.internship_status === "Active" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 px-2.5 py-0.5 text-[11px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Intern
                          </span>
                        ) : s.internship_status === "Completed" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60 px-2.5 py-0.5 text-[11px] font-bold">
                            <CheckCircle2 size={12} className="text-blue-500" />
                            Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-0.5 text-[11px] font-medium">
                            Seeking / None
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.internship_company ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 size={13} className="text-slate-400 shrink-0" />
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {s.internship_company}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.internship_role ? (
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {s.internship_role}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.internship_duration ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[11px] font-mono">
                            {s.internship_duration}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingStudent(s)}
                            title="Update Internship"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setSelectedStudentForProfile(s.id)}
                            title="View Student Profile"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Eye size={14} />
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

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPageIndex(0);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>
              Showing {sortedStudents.length === 0 ? 0 : pageIndex * pageSize + 1}–
              {Math.min((pageIndex + 1) * pageSize, sortedStudents.length)} of {sortedStudents.length} records
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPageIndex((p) => Math.max(p - 1, 0))}
              disabled={pageIndex === 0}
              className="rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="font-mono">
              {pageIndex + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPageIndex((p) => Math.min(p + 1, totalPages - 1))}
              disabled={pageIndex >= totalPages - 1}
              className="rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Edit / Update Single Student Internship Modal */}
      {editingStudent && (
        <EditInternshipModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={() => {
            setEditingStudent(null);
            setDbState(db.getState());
          }}
        />
      )}

      {/* Assign Internship to Any Student Modal */}
      {isAssignModalOpen && (
        <AssignInternshipModal
          students={activeStudents}
          departments={dbState.departments}
          onClose={() => setIsAssignModalOpen(false)}
          onSaved={() => {
            setIsAssignModalOpen(false);
            setDbState(db.getState());
          }}
        />
      )}

      {/* Full Student Profile Modal (Shows compact Internship & Industry card inside) */}
      {selectedStudentForProfile !== null && (
        <StudentProfileModal
          studentId={selectedStudentForProfile}
          onClose={() => setSelectedStudentForProfile(null)}
        />
      )}
    </div>
  );
}

// ─── Modal to Edit Existing Student's Internship ──────────────────────────────
interface EditInternshipModalProps {
  student: Student;
  onClose: () => void;
  onSaved: () => void;
}

function EditInternshipModal({ student, onClose, onSaved }: EditInternshipModalProps) {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<InternshipStatus>(student.internship_status || "None");
  const [company, setCompany] = useState(student.internship_company || "");
  const [role, setRole] = useState(student.internship_role || "");
  const [duration, setDuration] = useState(student.internship_duration || "");

  const handleSave = () => {
    const now = new Date().toISOString();
    db.setState((draft) => {
      const idx = draft.students.findIndex((s) => s.id === student.id);
      if (idx !== -1) {
        draft.students[idx].internship_status = status;
        draft.students[idx].internship_company = status !== "None" ? company.trim() || undefined : undefined;
        draft.students[idx].internship_role = status !== "None" ? role.trim() || undefined : undefined;
        draft.students[idx].internship_duration = status !== "None" ? duration.trim() || undefined : undefined;
        draft.students[idx].updated_at = now;
        draft.students[idx].updated_by = user?.id || 1;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UPDATE_INTERNSHIP",
      entityType: "Student",
      entityId: student.registration_number,
      summary: `Updated internship record for ${student.full_name} (${student.registration_number}): ${status} at ${company || "N/A"}`,
    });

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Update Internship Record
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {student.full_name} · <span className="font-mono">{student.registration_number}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Internship Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["Active", "Completed", "None"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={clsx(
                    "py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-center",
                    status === st
                      ? st === "Active"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : st === "Completed"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {st === "Active" ? "Active Intern" : st === "Completed" ? "Completed" : "None / Seeking"}
                </button>
              ))}
            </div>
          </div>

          {status !== "None" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Host Organization / Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bosch Ltd, Tata Motors, L&T"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role / Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. Trainee Mechanical Engineer, CAD Design Intern"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Duration / Timeline
                </label>
                <input
                  type="text"
                  placeholder="e.g. 6 Months, 3 Months, Summer 2026"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
                <div className="flex items-center gap-1.5 mt-2">
                  {["1 Month", "3 Months", "6 Months", "1 Year"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors"
          >
            Save Record
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal to Assign Internship to Any Student ────────────────────────────────
interface AssignInternshipModalProps {
  students: Student[];
  departments: { id: number; code: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function AssignInternshipModal({ students, departments, onClose, onSaved }: AssignInternshipModalProps) {
  const user = useAuthStore((s) => s.user);
  const [selectedStudentId, setSelectedStudentId] = useState<number | "">("");
  const [status, setStatus] = useState<InternshipStatus>("Active");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [duration, setDuration] = useState("6 Months");
  const [studentSearch, setStudentSearch] = useState("");

  const filteredCandidates = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 50);
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.registration_number.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const handleSave = () => {
    if (!selectedStudentId) return;
    const target = students.find((s) => s.id === selectedStudentId);
    if (!target) return;

    const now = new Date().toISOString();
    db.setState((draft) => {
      const idx = draft.students.findIndex((s) => s.id === target.id);
      if (idx !== -1) {
        draft.students[idx].internship_status = status;
        draft.students[idx].internship_company = status !== "None" ? company.trim() || undefined : undefined;
        draft.students[idx].internship_role = status !== "None" ? role.trim() || undefined : undefined;
        draft.students[idx].internship_duration = status !== "None" ? duration.trim() || undefined : undefined;
        draft.students[idx].updated_at = now;
        draft.students[idx].updated_by = user?.id || 1;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "ASSIGN_INTERNSHIP",
      entityType: "Student",
      entityId: target.registration_number,
      summary: `Assigned ${status} internship to ${target.full_name} (${target.registration_number}) at ${company || "N/A"}`,
    });

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Assign Student Internship
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select student and record industry internship details.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Student Candidate <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Search student by name or reg no..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full mb-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(Number(e.target.value) || "")}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="">-- Choose Candidate --</option>
              {filteredCandidates.map((s) => {
                const dept = departments.find((d) => d.id === s.department_id);
                return (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.registration_number}) · {dept?.code || "ENG"}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Internship Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["Active", "Completed", "None"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatus(st)}
                  className={clsx(
                    "py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-center",
                    status === st
                      ? st === "Active"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : st === "Completed"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        : "border-slate-400 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-400"
                  )}
                >
                  {st === "Active" ? "Active Intern" : st === "Completed" ? "Completed" : "None / Seeking"}
                </button>
              ))}
            </div>
          </div>

          {status !== "None" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Host Organization / Company <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bosch Ltd, Tata Motors, L&T, TVS Motor"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role / Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. Trainee Engineer, Embedded Systems Intern"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Duration / Timeline
                </label>
                <input
                  type="text"
                  placeholder="e.g. 6 Months, 3 Months, Summer 2026"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
                <div className="flex items-center gap-1.5 mt-2">
                  {["1 Month", "3 Months", "6 Months", "1 Year"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors"
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/20">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedStudentId || (status !== "None" && !company.trim())}
            onClick={handleSave}
            className="rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] disabled:opacity-40 transition-colors"
          >
            Assign Internship
          </button>
        </div>
      </div>
    </div>
  );
}
