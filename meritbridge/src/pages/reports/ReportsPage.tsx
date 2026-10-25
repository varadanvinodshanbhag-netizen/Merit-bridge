import { useState, useEffect, useMemo } from "react";
import {
  Download,
  Printer,
  Filter,
  RotateCcw,
  FileSpreadsheet,
} from "lucide-react";
import { db, DatabaseState } from "../../db/storage";
import { calculateMetrics, MetricScope } from "../../services/metrics";
import { exportToExcel, exportToCsv } from "../../services/exporter";
import { calculateSemesterPercentage } from "../../services/academics";
import { format } from "date-fns";

type ReportId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9";

interface ReportMeta {
  id: ReportId;
  code: string;
  title: string;
  description: string;
  category: "Academic" | "Placement" | "Recruiter" | "Analysis";
}

const REPORT_CATALOG: ReportMeta[] = [
  {
    id: "R1",
    code: "R1",
    title: "Student Academic Record",
    description: "Semester marks, SGPA, CGPA, and backlog details for students in scope.",
    category: "Academic",
  },
  {
    id: "R2",
    code: "R2",
    title: "Student Placement History",
    description: "Applications, interview stages, offers, and joining status per student.",
    category: "Placement",
  },
  {
    id: "R3",
    code: "R3",
    title: "Company-wise Recruitment",
    description: "Recruiter breakdown: drives, applicants, selections, offers, and package ranges.",
    category: "Recruiter",
  },
  {
    id: "R4",
    code: "R4",
    title: "Department and Batch Outcomes",
    description: "Cohort size, placed students, placement percentage, and package stats per department.",
    category: "Placement",
  },
  {
    id: "R5",
    code: "R5",
    title: "Candidate Status Summary",
    description: "Detailed status of candidates (selected, rejected, pending, withdrawn) by drive.",
    category: "Placement",
  },
  {
    id: "R6",
    code: "R6",
    title: "Semester Performance Analysis",
    description: "Semester-wise grade distribution, average marks, and active backlog trends.",
    category: "Academic",
  },
  {
    id: "R7",
    code: "R7",
    title: "Salary & Compensation Analysis",
    description: "Highest, median, average, and lowest package distribution across departments.",
    category: "Analysis",
  },
  {
    id: "R8",
    code: "R8",
    title: "Interview Stage Conversion",
    description: "Recruitment funnel attrition, conversion rates, and pass rates at each round.",
    category: "Analysis",
  },
  {
    id: "R9",
    code: "R9",
    title: "Historical Comparison",
    description: "Year-over-year placed counts, offers, placement percentages, and CTC trends.",
    category: "Analysis",
  },
];

export default function ReportsPage() {
  const [dbState, setDbState] = useState<DatabaseState>(db.getState());
  const [selectedReportId, setSelectedReportId] = useState<ReportId>("R4");

  // Filter Bar state
  const [academicYearId, setAcademicYearId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [driveId, setDriveId] = useState<string>("");
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);

  useEffect(() => {
    return db.subscribe((state) => {
      setDbState(state);
    });
  }, []);

  const scope: MetricScope = useMemo(
    () => ({
      academic_year_id: academicYearId ? Number(academicYearId) : undefined,
      department_id: departmentId ? Number(departmentId) : undefined,
      batch_id: batchId ? Number(batchId) : undefined,
      company_id: companyId ? Number(companyId) : undefined,
      drive_id: driveId ? Number(driveId) : undefined,
      include_archived: includeArchived,
    }),
    [academicYearId, departmentId, batchId, companyId, driveId, includeArchived]
  );

  const metrics = useMemo(() => calculateMetrics(dbState, scope), [dbState, scope]);
  const activeReport = REPORT_CATALOG.find((r) => r.id === selectedReportId)!;

  const handleResetFilters = () => {
    setAcademicYearId("");
    setDepartmentId("");
    setBatchId("");
    setCompanyId("");
    setDriveId("");
    setIncludeArchived(false);
  };

  // ─── Generate Dynamic Report Data Rows ─────────────────────────────
  const reportData = useMemo(() => {
    // Filter scoped students
    const scopedStudents = dbState.students.filter((s) => {
      if (!includeArchived && s.archived_at) return false;
      if (departmentId && s.department_id !== Number(departmentId)) return false;
      if (batchId && s.batch_id !== Number(batchId)) return false;
      return true;
    });
    const scopedStudentIds = new Set(scopedStudents.map((s) => s.id));

    if (selectedReportId === "R1") {
      // Academic Record
      return scopedStudents.map((s) => {
        const dept = dbState.departments.find((d) => d.id === s.department_id);
        const batch = dbState.batches.find((b) => b.id === s.batch_id);
        const sems = dbState.semester_records.filter((r) => r.student_id === s.id);
        const backlogs = dbState.backlogs.filter((b) => b.student_id === s.id);
        const activeB = backlogs.filter((b) => b.status === "Active").length;
        const clearedB = backlogs.filter((b) => b.status === "Cleared").length;

        return {
          "Reg No": s.registration_number,
          "Student Name": s.full_name,
          Department: dept?.code || "—",
          Batch: batch?.label || "—",
          CGPA: s.cgpa !== null && s.cgpa !== undefined ? Number(s.cgpa).toFixed(2) : "—",
          "Semesters Recorded": sems.length,
          "Active Backlogs": activeB,
          "Cleared Backlogs": clearedB,
        };
      });
    }

    if (selectedReportId === "R2") {
      // Placement History per student
      return scopedStudents.map((s) => {
        const dept = dbState.departments.find((d) => d.id === s.department_id);
        const apps = dbState.applications.filter((a) => a.student_id === s.id);
        const appIds = new Set(apps.map((a) => a.id));
        const offers = dbState.offers.filter((o) => appIds.has(o.application_id));
        const acceptedOffers = offers.filter((o) => o.offer_status === "Accepted");
        const salaries = acceptedOffers.map((o) => o.annual_salary);
        const highestSalary = salaries.length > 0 ? Math.max(...salaries) : 0;
        const joined = offers.some((o) => o.joining_status === "Joined");

        return {
          "Reg No": s.registration_number,
          "Student Name": s.full_name,
          Department: dept?.code || "—",
          Applications: apps.length,
          "Offers Received": offers.length,
          "Offers Accepted": acceptedOffers.length,
          "Highest CTC (LPA)": highestSalary > 0 ? (highestSalary / 100000).toFixed(2) : "—",
          "Placement Status": acceptedOffers.length > 0 ? "Placed" : "Unplaced",
          "Joined Campus": joined ? "Yes" : "No",
        };
      });
    }

    if (selectedReportId === "R3") {
      // Company-wise recruitment
      return dbState.companies.map((c) => {
        const compDrives = dbState.drives.filter((d) => d.company_id === c.id);
        const driveIds = new Set(compDrives.map((d) => d.id));
        const compApps = dbState.applications.filter((a) => driveIds.has(a.drive_id));
        const appIds = new Set(compApps.map((a) => a.id));
        const compOffers = dbState.offers.filter((o) => appIds.has(o.application_id));
        const acceptedOffers = compOffers.filter((o) => o.offer_status === "Accepted");
        const joinedCount = compOffers.filter((o) => o.joining_status === "Joined").length;
        const salaries = acceptedOffers.map((o) => o.annual_salary).filter((s) => s > 0);
        const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 0;
        const avgSalary =
          salaries.length > 0
            ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)
            : 0;

        return {
          Company: c.name,
          Category: c.industry || "Technology",
          "Drives Conducted": compDrives.length,
          Applicants: compApps.length,
          Selected: compApps.filter((a) => a.final_outcome === "Selected").length,
          "Offers Made": compOffers.length,
          "Offers Accepted": acceptedOffers.length,
          Joined: joinedCount,
          "Highest Package (LPA)": maxSalary > 0 ? (maxSalary / 100000).toFixed(2) : "—",
          "Average Package (LPA)": avgSalary > 0 ? (avgSalary / 100000).toFixed(2) : "—",
        };
      });
    }

    if (selectedReportId === "R4") {
      // Department and Batch Outcomes
      return metrics.department_outcomes.map((d) => ({
        Department: d.department_name,
        Code: d.department_code,
        "Cohort Size": d.active_students,
        "Placed Students": d.placed_students,
        "Placement %": d.active_students > 0 ? `${d.placement_percentage}%` : "—",
        "Total Offers": d.total_offers,
        "Average CTC (LPA)": d.average_lpa > 0 ? `${d.average_lpa} LPA` : "—",
        "Highest CTC (LPA)": d.highest_lpa > 0 ? `${d.highest_lpa} LPA` : "—",
      }));
    }

    if (selectedReportId === "R5") {
      // Candidate Status by Drive
      const scopedDrives = dbState.drives.filter((d) => {
        if (companyId && d.company_id !== Number(companyId)) return false;
        if (driveId && d.id !== Number(driveId)) return false;
        return true;
      });
      const driveMap = new Map(scopedDrives.map((d) => [d.id, d]));

      const rows: Record<string, unknown>[] = [];
      for (const app of dbState.applications) {
        const drive = driveMap.get(app.drive_id);
        const student = dbState.students.find((s) => s.id === app.student_id);
        if (drive && student && (!scopedStudentIds || scopedStudentIds.has(student.id))) {
          const comp = dbState.companies.find((c) => c.id === drive.company_id);
          const dept = dbState.departments.find((d) => d.id === student.department_id);
          const offers = dbState.offers.filter((o) => o.application_id === app.id);
          const acceptedOffer = offers.find((o) => o.offer_status === "Accepted");

          rows.push({
            "Drive Title": drive.title,
            Company: comp?.name || "—",
            "Reg No": student.registration_number,
            "Student Name": student.full_name,
            Department: dept?.code || "—",
            "Final Outcome": app.final_outcome,
            "Offer Status": acceptedOffer ? "Accepted" : offers.length > 0 ? "Offered" : "None",
            "Offered Package": acceptedOffer ? `${(acceptedOffer.annual_salary / 100000).toFixed(2)} LPA` : "—",
          });
        }
      }
      return rows;
    }

    if (selectedReportId === "R6") {
      // Semester Performance
      const semMap = new Map<number, { count: number; totalPct: number; activeB: number }>();
      for (const sem of dbState.semester_records) {
        const curr = semMap.get(sem.semester_number) || { count: 0, totalPct: 0, activeB: 0 };
        curr.count++;
        curr.totalPct += calculateSemesterPercentage(sem.subjects) || 0;
        semMap.set(sem.semester_number, curr);
      }
      for (const b of dbState.backlogs) {
        if (b.status === "Active") {
          const curr = semMap.get(b.semester_number) || { count: 0, totalPct: 0, activeB: 0 };
          curr.activeB++;
          semMap.set(b.semester_number, curr);
        }
      }

      const rows = [];
      for (let s = 1; s <= 8; s++) {
        const data = semMap.get(s) || { count: 0, totalPct: 0, activeB: 0 };
        const avg = data.count > 0 ? Number((data.totalPct / data.count).toFixed(2)) : 0;
        rows.push({
          Semester: `Semester ${s}`,
          "Records Entered": data.count,
          "Average Marks %": avg > 0 ? `${avg}%` : "—",
          "Active Backlogs": data.activeB,
        });
      }
      return rows;
    }

    if (selectedReportId === "R7") {
      // Salary Analysis
      return metrics.department_outcomes.map((d) => ({
        Department: d.department_name,
        "Placed Students": d.placed_students,
        "Lowest CTC (LPA)": metrics.salaries.lowest_lpa > 0 ? `${metrics.salaries.lowest_lpa} LPA` : "—",
        "Average CTC (LPA)": d.average_lpa > 0 ? `${d.average_lpa} LPA` : "—",
        "Median CTC (LPA)": metrics.salaries.median_lpa > 0 ? `${metrics.salaries.median_lpa} LPA` : "—",
        "Highest CTC (LPA)": d.highest_lpa > 0 ? `${d.highest_lpa} LPA` : "—",
      }));
    }

    if (selectedReportId === "R8") {
      // Interview Stage Conversion Funnel
      return metrics.funnel.map((f, i) => ({
        Step: i + 1,
        "Funnel Stage": f.name,
        "Candidates Count": f.count,
        "Conversion from Applied": `${f.conversion_from_applied}%`,
        "Conversion from Previous": `${f.conversion_from_previous}%`,
      }));
    }

    if (selectedReportId === "R9") {
      // Historical Comparison
      return dbState.batches.map((b) => {
        const bMetrics = calculateMetrics(dbState, {
          batch_id: b.id,
          include_archived: includeArchived,
        });
        return {
          Batch: b.label,
          "Passing Year": b.passing_year,
          "Total Enrolled": bMetrics.total_active_students,
          "Unique Placed": bMetrics.placed_students,
          "Placement %": bMetrics.total_active_students > 0 ? `${bMetrics.placement_percentage}%` : "—",
          "Total Offers": bMetrics.total_offers,
          "Average Package": bMetrics.salaries.average_lpa > 0 ? `${bMetrics.salaries.average_lpa} LPA` : "—",
          "Highest Package": bMetrics.salaries.highest_lpa > 0 ? `${bMetrics.salaries.highest_lpa} LPA` : "—",
        };
      });
    }

    return [];
  }, [selectedReportId, dbState, includeArchived, departmentId, batchId, companyId, driveId, metrics]);

  // Export handlers
  const handleExportExcel = () => {
    exportToExcel({
      filename: `MeritBridge_${activeReport.code}_${activeReport.title.replace(/\s+/g, "_")}`,
      sheetName: activeReport.code,
      data: reportData,
      filtersApplied: {
        Report: `${activeReport.code} - ${activeReport.title}`,
        AcademicYear: academicYearId
          ? dbState.academic_years.find((y) => y.id === Number(academicYearId))?.label
          : "All",
        Department: departmentId
          ? dbState.departments.find((d) => d.id === Number(departmentId))?.code
          : "All",
        Batch: batchId ? dbState.batches.find((b) => b.id === Number(batchId))?.label : "All",
        Company: companyId
          ? dbState.companies.find((c) => c.id === Number(companyId))?.name
          : "All",
        IncludeArchived: includeArchived ? "Yes" : "No",
      },
    });
  };

  const handleExportCsv = () => {
    exportToCsv({
      filename: `MeritBridge_${activeReport.code}_${activeReport.title.replace(/\s+/g, "_")}`,
      data: reportData,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-only CSS */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, header, .no-print {
            display: none !important;
          }
          .printable-report {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Screen Header & Top Action Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Official Reports
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Generate and export institutional placement audits and performance records (R1–R9).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Export Excel
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-primary)] text-white hover:opacity-90 transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Selector Pills */}
      <div className="no-print p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-2">
          Select Standard Report (PRD Section 10.3)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {REPORT_CATALOG.map((rpt) => {
            const isSelected = selectedReportId === rpt.id;
            return (
              <button
                key={rpt.id}
                onClick={() => setSelectedReportId(rpt.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]/40 text-[var(--color-primary)] shadow-sm"
                    : "border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs">
                    {rpt.code}. {rpt.title}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      isSelected
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
                    }`}
                  >
                    {rpt.category}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                  {rpt.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scope Filter Bar */}
      <div className="no-print p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            Report Scope Filters
          </div>
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline font-medium"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Filters
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1">
              Academic Year
            </label>
            <select
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Academic Years</option>
              {dbState.academic_years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1">
              Department
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Departments</option>
              {dbState.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} - {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1">
              Batch
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Batches</option>
              {dbState.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1">
              Company
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Companies</option>
              {dbState.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-muted)] mb-1">
              Drive
            </label>
            <select
              value={driveId}
              onChange={(e) => setDriveId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              <option value="">All Drives</option>
              {dbState.drives
                .filter((d) => (!companyId ? true : d.company_id === Number(companyId)))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center pt-5">
            <label className="relative flex items-center gap-2 cursor-pointer text-xs select-none">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--color-primary)] border-[var(--color-border)] focus:ring-[var(--color-primary)]"
              />
              <span className="text-xs font-medium text-[var(--color-text)]">
                Include archived
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ─── Printable Document Surface ─────────────────────────────────── */}
      <div className="printable-report p-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-md space-y-6">
        {/* Institutional Header (PRD Section 10.3) */}
        <div className="border-b-2 border-[var(--color-primary)] pb-4 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-sm shadow">
                MB
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)] leading-tight">
                  {dbState.institution.name}
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase font-semibold">
                  MeritBridge Placement Management &amp; Analytics
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              {dbState.institution.address} · {dbState.institution.contact_details}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block px-2.5 py-1 rounded-md bg-[var(--color-primary)] text-white text-xs font-bold tracking-wide">
              {activeReport.code} OFFICIAL REPORT
            </span>
            <p className="text-xs font-bold text-[var(--color-text)] mt-1.5">
              {activeReport.title}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Generated: {format(new Date(), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block">
              Placement Rate
            </span>
            <span className="text-xl font-bold text-[var(--color-primary)]">
              {metrics.total_active_students > 0 ? `${metrics.placement_percentage}%` : "—"}
            </span>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {metrics.placed_students} of {metrics.total_active_students} placed
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block">
              Total Offers
            </span>
            <span className="text-xl font-bold text-[var(--color-text)]">
              {metrics.total_offers}
            </span>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {metrics.accepted_offers} accepted offers
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block">
              Average Package
            </span>
            <span className="text-xl font-bold text-[var(--color-text)]">
              {metrics.salaries.average_lpa > 0 ? `${metrics.salaries.average_lpa} LPA` : "—"}
            </span>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Median: {metrics.salaries.median_lpa > 0 ? `${metrics.salaries.median_lpa} LPA` : "—"}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-[var(--color-text-muted)] block">
              Highest Package
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.salaries.highest_lpa > 0 ? `${metrics.salaries.highest_lpa} LPA` : "—"}
            </span>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Records in report: {reportData.length}
            </p>
          </div>
        </div>

        {/* Applied Filters metadata bar */}
        <div className="text-xs text-[var(--color-text-muted)] flex flex-wrap items-center gap-x-4 gap-y-1 py-1 border-b border-[var(--color-border)]">
          <span className="font-semibold text-[var(--color-text)]">Filters Applied:</span>
          <span>
            Academic Year:{" "}
            {academicYearId
              ? dbState.academic_years.find((y) => y.id === Number(academicYearId))?.label
              : "All"}
          </span>
          <span>
            Department:{" "}
            {departmentId
              ? dbState.departments.find((d) => d.id === Number(departmentId))?.code
              : "All"}
          </span>
          <span>
            Batch:{" "}
            {batchId ? dbState.batches.find((b) => b.id === Number(batchId))?.label : "All"}
          </span>
          <span>Archived: {includeArchived ? "Included" : "Excluded"}</span>
        </div>

        {/* Report Data Table */}
        {reportData.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--color-text-muted)]">
            No records found matching the selected report parameters and filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]">
                  {Object.keys(reportData[0]).map((col) => (
                    <th key={col} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {reportData.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    {Object.values(row).map((val, cellIdx) => (
                      <td
                        key={cellIdx}
                        className="py-2.5 px-3 text-[var(--color-text)] whitespace-nowrap"
                      >
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Institutional Document Footer */}
        <div className="pt-6 border-t border-[var(--color-border)] flex justify-between items-center text-[11px] text-[var(--color-text-muted)]">
          <span>MeritBridge · Institutional Placement Cell</span>
          <span>Confidential — Internal Academic &amp; Placement Record</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}
