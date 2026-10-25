import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
  Cell,
} from "recharts";
import {
  TrendingUp,
  Building2,
  Users,
  Award,
  DollarSign,
  Download,
  Filter,
  BarChart3,
  Table as TableIcon,
  RotateCcw,
} from "lucide-react";
import { db, DatabaseState } from "../../db/storage";
import { calculateMetrics, MetricScope } from "../../services/metrics";
import { exportToExcel } from "../../services/exporter";

export default function AnalyticsPage() {
  const [dbState, setDbState] = useState<DatabaseState>(db.getState());
  const [activeTab, setActiveTab] = useState<
    "overview" | "departments" | "companies" | "funnel" | "salary" | "trends"
  >("overview");

  // Filters (PRD ANA-01)
  const [academicYearId, setAcademicYearId] = useState<string>("");
  const [batchId, setBatchId] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [driveId, setDriveId] = useState<string>("");
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);

  // View mode: chart or data table (PRD ANA-03)
  const [showTable, setShowTable] = useState<boolean>(false);

  useEffect(() => {
    return db.subscribe((state) => {
      setDbState(state);
    });
  }, []);

  const scope: MetricScope = useMemo(
    () => ({
      academic_year_id: academicYearId ? Number(academicYearId) : undefined,
      batch_id: batchId ? Number(batchId) : undefined,
      department_id: departmentId ? Number(departmentId) : undefined,
      company_id: companyId ? Number(companyId) : undefined,
      drive_id: driveId ? Number(driveId) : undefined,
      include_archived: includeArchived,
    }),
    [academicYearId, batchId, departmentId, companyId, driveId, includeArchived]
  );

  // Compute metrics using authoritative engine (PRD ANA-04 & Section 6.1)
  const metrics = useMemo(() => calculateMetrics(dbState, scope), [dbState, scope]);

  const handleResetFilters = () => {
    setAcademicYearId("");
    setBatchId("");
    setDepartmentId("");
    setCompanyId("");
    setDriveId("");
    setIncludeArchived(false);
  };

  // Companies data breakdown
  const companyAnalytics = useMemo(() => {
    const list = dbState.companies.map((comp) => {
      const compDrives = dbState.drives.filter((d) => d.company_id === comp.id);
      const compDriveIds = new Set(compDrives.map((d) => d.id));

      const compApps = dbState.applications.filter((a) => compDriveIds.has(a.drive_id));
      const compAppIds = new Set(compApps.map((a) => a.id));

      const compOffers = dbState.offers.filter((o) => compAppIds.has(o.application_id));
      const acceptedOffers = compOffers.filter((o) => o.offer_status === "Accepted");

      const salaries = acceptedOffers.map((o) => o.annual_salary).filter((s) => s > 0);
      const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 0;
      const avgSalary =
        salaries.length > 0
          ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length)
          : 0;

      return {
        company_id: comp.id,
        name: comp.name,
        drives_count: compDrives.length,
        applied_count: compApps.length,
        selected_count: compApps.filter((a) => a.final_outcome === "Selected").length,
        total_offers: compOffers.length,
        accepted_offers: acceptedOffers.length,
        max_lpa: Number((maxSalary / 100000).toFixed(2)),
        avg_lpa: Number((avgSalary / 100000).toFixed(2)),
      };
    });

    return list.sort((a, b) => b.accepted_offers - a.accepted_offers);
  }, [dbState]);

  // Salary Tier Distribution
  const salaryTiers = useMemo(() => {
    const tiers = [
      { name: "< 4 LPA", count: 0, range: "0 - 4" },
      { name: "4 - 6 LPA", count: 0, range: "4 - 6" },
      { name: "6 - 10 LPA", count: 0, range: "6 - 10" },
      { name: "10 - 15 LPA", count: 0, range: "10 - 15" },
      { name: "15+ LPA", count: 0, range: "15+" },
    ];

    // Get placed students with highest accepted offer
    const placedStudents = new Map<number, number>();
    for (const offer of dbState.offers) {
      if (offer.offer_status === "Accepted") {
        const app = dbState.applications.find((a) => a.id === offer.application_id);
        if (app) {
          const curr = placedStudents.get(app.student_id) || 0;
          if (offer.annual_salary > curr) {
            placedStudents.set(app.student_id, offer.annual_salary);
          }
        }
      }
    }

    for (const salary of placedStudents.values()) {
      const lpa = salary / 100000;
      if (lpa < 4) tiers[0].count++;
      else if (lpa < 6) tiers[1].count++;
      else if (lpa < 10) tiers[2].count++;
      else if (lpa < 15) tiers[3].count++;
      else tiers[4].count++;
    }

    return tiers;
  }, [dbState]);

  // Trends by batch / academic year
  const batchTrends = useMemo(() => {
    return dbState.batches.map((b) => {
      const batchMetrics = calculateMetrics(dbState, {
        batch_id: b.id,
        include_archived: includeArchived,
      });
      return {
        batch: b.label,
        passing_year: b.passing_year,
        active_students: batchMetrics.total_active_students,
        placed_students: batchMetrics.placed_students,
        placement_rate: batchMetrics.placement_percentage,
        avg_lpa: batchMetrics.salaries.average_lpa,
        highest_lpa: batchMetrics.salaries.highest_lpa,
      };
    });
  }, [dbState, includeArchived]);

  const handleExportData = () => {
    let exportData: Record<string, unknown>[] = [];
    let filename = `MeritBridge_Analytics_${activeTab}`;

    if (activeTab === "departments") {
      exportData = metrics.department_outcomes.map((d) => ({
        Department: d.department_name,
        Code: d.department_code,
        "Total Students": d.active_students,
        "Placed Students": d.placed_students,
        "Placement %": `${d.placement_percentage}%`,
        "Total Offers": d.total_offers,
        "Highest Package (LPA)": d.highest_lpa,
        "Average Package (LPA)": d.average_lpa,
      }));
    } else if (activeTab === "companies") {
      exportData = companyAnalytics.map((c) => ({
        Company: c.name,
        "Drives Conducted": c.drives_count,
        Applications: c.applied_count,
        Selected: c.selected_count,
        "Total Offers": c.total_offers,
        "Accepted Offers": c.accepted_offers,
        "Highest Package (LPA)": c.max_lpa,
        "Average Package (LPA)": c.avg_lpa,
      }));
    } else if (activeTab === "funnel") {
      exportData = metrics.funnel.map((f) => ({
        Stage: f.name,
        Count: f.count,
        "Conversion from Applied": `${f.conversion_from_applied}%`,
        "Conversion from Previous": `${f.conversion_from_previous}%`,
      }));
    } else if (activeTab === "salary") {
      exportData = salaryTiers.map((t) => ({
        "Salary Tier": t.name,
        "Placed Students": t.count,
      }));
    } else if (activeTab === "trends") {
      exportData = batchTrends.map((t) => ({
        Batch: t.batch,
        "Passing Year": t.passing_year,
        "Total Students": t.active_students,
        "Placed Students": t.placed_students,
        "Placement Rate (%)": t.placement_rate,
        "Avg LPA": t.avg_lpa,
        "Highest LPA": t.highest_lpa,
      }));
    } else {
      // Overview export
      exportData = [
        { Metric: "Total Students in Cohort", Value: metrics.total_active_students },
        { Metric: "Unique Placed Students", Value: metrics.placed_students },
        { Metric: "Placement Percentage", Value: `${metrics.placement_percentage}%` },
        { Metric: "Active Drives", Value: metrics.active_drives },
        { Metric: "Total Offers Extended", Value: metrics.total_offers },
        { Metric: "Accepted Offers", Value: metrics.accepted_offers },
        { Metric: "Joined Count", Value: metrics.joined_count },
        { Metric: "Students with Multiple Offers", Value: metrics.multiple_offers_count },
        { Metric: "Highest Package (LPA)", Value: metrics.salaries.highest_lpa },
        { Metric: "Median Package (LPA)", Value: metrics.salaries.median_lpa },
        { Metric: "Average Package (LPA)", Value: metrics.salaries.average_lpa },
        { Metric: "Lowest Package (LPA)", Value: metrics.salaries.lowest_lpa },
      ];
    }

    exportToExcel({
      filename,
      data: exportData,
      filtersApplied: {
        AcademicYear: academicYearId
          ? dbState.academic_years.find((y) => y.id === Number(academicYearId))?.label
          : "All",
        Batch: batchId ? dbState.batches.find((b) => b.id === Number(batchId))?.label : "All",
        Department: departmentId
          ? dbState.departments.find((d) => d.id === Number(departmentId))?.code
          : "All",
        Company: companyId
          ? dbState.companies.find((c) => c.id === Number(companyId))?.name
          : "All",
        Drive: driveId ? dbState.drives.find((d) => d.id === Number(driveId))?.title : "All",
        IncludeArchived: includeArchived ? "Yes" : "No",
      },
    });
  };

  const hasActiveFilters =
    Boolean(academicYearId) ||
    Boolean(batchId) ||
    Boolean(departmentId) ||
    Boolean(companyId) ||
    Boolean(driveId) ||
    includeArchived;

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            Placement Analytics
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Authoritative placement trends, conversion pipeline, and compensation analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTable(!showTable)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showTable
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
            }`}
            title="Toggle between chart and raw data view"
          >
            {showTable ? <BarChart3 className="w-4 h-4" /> : <TableIcon className="w-4 h-4" />}
            {showTable ? "View Charts" : "View Data Table"}
          </button>
          <button
            onClick={handleExportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-[var(--color-primary)]" />
            Export View
          </button>
        </div>
      </div>

      {/* Scope Filter Bar (PRD ANA-01) */}
      <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            Scope Filters
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          )}
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
                  {b.label} ({b.passing_year})
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

      {/* Navigation Tabs (PRD ANA-02) */}
      <div className="border-b border-[var(--color-border)]">
        <nav className="flex space-x-6">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "departments", label: "Departments & Batches", icon: Users },
            { id: "companies", label: "Companies", icon: Building2 },
            { id: "funnel", label: "Conversion Funnel", icon: TrendingUp },
            { id: "salary", label: "Salary & Packages", icon: DollarSign },
            { id: "trends", label: "Trends", icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-xs transition-colors ${
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

      {/* ─── TAB 1: OVERVIEW ────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Placement Rate
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--color-text)]">
                  {metrics.total_active_students > 0 ? `${metrics.placement_percentage}%` : "—"}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {metrics.placed_students} / {metrics.total_active_students} students
                </span>
              </div>
              <div className="mt-3 w-full bg-[var(--color-bg)] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-100"
                  style={{ width: `${Math.min(metrics.placement_percentage, 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Total Offers Extended
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--color-text)]">
                  {metrics.total_offers}
                </span>
                <span className="text-xs text-[var(--color-primary)] font-semibold">
                  {metrics.accepted_offers} Accepted
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                {metrics.multiple_offers_count} students with multiple offers
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Average Package
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--color-text)]">
                  {metrics.salaries.average_lpa > 0 ? `${metrics.salaries.average_lpa} LPA` : "—"}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Median:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {metrics.salaries.median_lpa > 0 ? `${metrics.salaries.median_lpa} LPA` : "—"}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Highest Package
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--color-primary)]">
                  {metrics.salaries.highest_lpa > 0 ? `${metrics.salaries.highest_lpa} LPA` : "—"}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Lowest:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {metrics.salaries.lowest_lpa > 0 ? `${metrics.salaries.lowest_lpa} LPA` : "—"}
                </span>
              </p>
            </div>
          </div>

          {/* Department Placement Summary & Funnel Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Comparison Chart */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
              <h2 className="text-sm font-bold text-[var(--color-text)] mb-4 flex items-center justify-between">
                <span>Placement % by Department</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  Target: 100%
                </span>
              </h2>
              {metrics.department_outcomes.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                  No department data found.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.department_outcomes}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="department_code"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                      />
                      <YAxis
                        unit="%"
                        domain={[0, 100]}
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface)",
                          borderColor: "var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "var(--color-text)",
                        }}
                        formatter={(val: any) => [`${val}%`, "Placement Rate"]}
                      />
                      <Bar isAnimationActive={false} dataKey="placement_percentage" fill="#9e2040" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Quick Conversion Funnel */}
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
              <h2 className="text-sm font-bold text-[var(--color-text)] mb-4 flex items-center justify-between">
                <span>Recruitment Funnel Progress</span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  Applied to Joined
                </span>
              </h2>
              <div className="space-y-3">
                {metrics.funnel.map((stage, idx) => {
                  const maxCount = metrics.funnel[0]?.count || 1;
                  const pctOfTotal = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                  return (
                    <div key={stage.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[var(--color-bg)] flex items-center justify-center text-[10px] text-[var(--color-text-muted)] font-bold">
                            {idx + 1}
                          </span>
                          {stage.name}
                        </span>
                        <div className="space-x-3 text-[11px]">
                          <span className="font-bold text-[var(--color-text)]">{stage.count}</span>
                          <span className="text-[var(--color-text-muted)]">
                            ({stage.conversion_from_applied}% of applied)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-[var(--color-bg)] rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-100"
                          style={{
                            width: `${Math.min(pctOfTotal, 100)}%`,
                            opacity: 1 - idx * 0.12,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: DEPARTMENTS & BATCHES ──────────────────────────────── */}
      {activeTab === "departments" && (
        <div className="space-y-6">
          {!showTable ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active vs Placed Students */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
                  Cohort Size vs Placed Students
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.department_outcomes}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="department_code"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                      />
                      <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface)",
                          borderColor: "var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend />
                      <Bar
                        isAnimationActive={false}
                        name="Active Students"
                        dataKey="active_students"
                        fill="#cbd5e1"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        isAnimationActive={false}
                        name="Placed Students"
                        dataKey="placed_students"
                        fill="#9e2040"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Package by Department */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
                  Average & Highest Package by Department (LPA)
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.department_outcomes}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="department_code"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                      />
                      <YAxis
                        unit=" LPA"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-surface)",
                          borderColor: "var(--color-border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => [`${val} LPA`]}
                      />
                      <Legend />
                      <Bar
                        isAnimationActive={false}
                        name="Average Package"
                        dataKey="average_lpa"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        isAnimationActive={false}
                        name="Highest Package"
                        dataKey="highest_lpa"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : null}

          {/* Department Breakdown Table */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">
              Department Outcome Statistics
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3 font-semibold">Department</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Cohort Size</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Placed</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Placement %</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Offers</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Avg Package</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Highest Package</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {metrics.department_outcomes.map((d) => (
                    <tr
                      key={d.department_id}
                      className="hover:bg-[var(--color-surface-hover)] transition-colors"
                    >
                      <td className="py-2.5 px-3 font-medium text-[var(--color-text)]">
                        {d.department_name} ({d.department_code})
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                        {d.active_students}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[var(--color-text)]">
                        {d.placed_students}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--color-primary)]">
                        {d.active_students > 0 ? `${d.placement_percentage}%` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                        {d.total_offers}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[var(--color-text)]">
                        {d.average_lpa > 0 ? `${d.average_lpa} LPA` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[var(--color-text)]">
                        {d.highest_lpa > 0 ? `${d.highest_lpa} LPA` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: COMPANIES ──────────────────────────────────────────── */}
      {activeTab === "companies" && (
        <div className="space-y-6">
          {!showTable && companyAnalytics.length > 0 ? (
            <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
                Recruiter Placement & Offer Distribution
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={companyAnalytics.slice(0, 10)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      angle={-20}
                      textAnchor="end"
                      tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--color-surface)",
                        borderColor: "var(--color-border)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend />
                    <Bar
                      isAnimationActive={false}
                      name="Applications"
                      dataKey="applied_count"
                      fill="#94a3b8"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      isAnimationActive={false}
                      name="Offers Made"
                      dataKey="total_offers"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      isAnimationActive={false}
                      name="Accepted Offers"
                      dataKey="accepted_offers"
                      fill="#9e2040"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          {/* Companies Table */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">
              Company-wise Recruitment Performance
            </h3>
            {companyAnalytics.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">
                No company records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)]">
                      <th className="py-2.5 px-3 font-semibold">Company</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Drives</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Applied</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Selected</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Offers</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Accepted Offers</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Max Package</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Avg Package</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {companyAnalytics.map((comp) => (
                      <tr
                        key={comp.company_id}
                        className="hover:bg-[var(--color-surface-hover)] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-[var(--color-text)]">
                          {comp.name}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                          {comp.drives_count}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                          {comp.applied_count}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--color-text)]">
                          {comp.selected_count}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                          {comp.total_offers}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[var(--color-primary)]">
                          {comp.accepted_offers}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-[var(--color-text)]">
                          {comp.max_lpa > 0 ? `${comp.max_lpa} LPA` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[var(--color-text-muted)]">
                          {comp.avg_lpa > 0 ? `${comp.avg_lpa} LPA` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: CONVERSION FUNNEL ──────────────────────────────────── */}
      {activeTab === "funnel" && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-1">
              End-to-End Recruitment Conversion Funnel
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-6">
              Conversion rates at each milestone from initial application to campus joining (PRD
              Section 6.1).
            </p>

            <div className="space-y-6 max-w-2xl mx-auto">
              {metrics.funnel.map((stage, idx) => {
                const maxCount = metrics.funnel[0]?.count || 1;
                const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                return (
                  <div key={stage.name} className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-text)]">
                          {stage.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-bold text-base text-[var(--color-text)]">
                          {stage.count}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-[11px]">
                          {stage.conversion_from_applied}% of total
                        </span>
                        {idx > 0 && (
                          <span className="text-[var(--color-primary)] font-semibold text-[11px]">
                            {stage.conversion_from_previous}% step rate
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full bg-[var(--color-bg)] rounded-lg h-5 overflow-hidden p-0.5 border border-[var(--color-border)]">
                      <div
                        className="bg-[var(--color-primary)] h-full rounded transition-all duration-100"
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          opacity: 1 - idx * 0.15,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: SALARY & PACKAGES ─────────────────────────────────── */}
      {activeTab === "salary" && (
        <div className="space-y-6">
          {/* Salary KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                Highest Package
              </span>
              <span className="text-2xl font-bold text-[var(--color-primary)]">
                {metrics.salaries.highest_lpa > 0 ? `${metrics.salaries.highest_lpa} LPA` : "—"}
              </span>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                ₹{metrics.salaries.highest_inr.toLocaleString("en-IN")}/yr
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                Average Package
              </span>
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {metrics.salaries.average_lpa > 0 ? `${metrics.salaries.average_lpa} LPA` : "—"}
              </span>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                ₹{metrics.salaries.average_inr.toLocaleString("en-IN")}/yr
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                Median Package
              </span>
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {metrics.salaries.median_lpa > 0 ? `${metrics.salaries.median_lpa} LPA` : "—"}
              </span>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                ₹{metrics.salaries.median_inr.toLocaleString("en-IN")}/yr
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <span className="text-xs text-[var(--color-text-muted)] block mb-1">
                Lowest Package
              </span>
              <span className="text-2xl font-bold text-[var(--color-text)]">
                {metrics.salaries.lowest_lpa > 0 ? `${metrics.salaries.lowest_lpa} LPA` : "—"}
              </span>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                ₹{metrics.salaries.lowest_inr.toLocaleString("en-IN")}/yr
              </p>
            </div>
          </div>

          {/* Salary Bracket Distribution */}
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
              Placed Student Distribution by Salary Tier
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salaryTiers}
                  margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(val: any) => [`${val} students`, "Placed"]}
                  />
                  <Bar isAnimationActive={false} dataKey="count" fill="#9e2040" radius={[4, 4, 0, 0]}>
                    {salaryTiers.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === salaryTiers.length - 1 ? "#10b981" : "#9e2040"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 6: TRENDS ────────────────────────────────────────────── */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
            <h3 className="text-sm font-bold text-[var(--color-text)] mb-4">
              Year-over-Year Placement Rate & Salary Trends
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={batchTrends}
                  margin={{ top: 10, right: 20, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="batch"
                    tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="left"
                    unit="%"
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    unit=" LPA"
                    tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    isAnimationActive={false}
                    yAxisId="left"
                    type="monotone"
                    dataKey="placement_rate"
                    name="Placement %"
                    stroke="#9e2040"
                    strokeWidth={2}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    isAnimationActive={false}
                    yAxisId="right"
                    type="monotone"
                    dataKey="avg_lpa"
                    name="Average LPA"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    isAnimationActive={false}
                    yAxisId="right"
                    type="monotone"
                    dataKey="highest_lpa"
                    name="Highest LPA"
                    stroke="#10b981"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
