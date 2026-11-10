import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  TrendingUp,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Bell,
  Clock,
  ArrowRight,
  Plus,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { db } from "@/db/storage";
import { calculateMetrics } from "@/services/metrics";
import { exportToExcel } from "@/services/exporter";
import { format } from "date-fns";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dbState, setDbState] = useState(db.getState());
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");
  const [rosterSearch, setRosterSearch] = useState("");

  useEffect(() => {
    return db.subscribe((state) => {
      setDbState(state);
    });
  }, []);

  const metrics = useMemo(() => calculateMetrics(dbState), [dbState]);

  // Upcoming interviews list (Next 14 days)
  const upcomingInterviews = useMemo(() => {
    const list: {
      id: number;
      company: string;
      title: string;
      dateStr: string;
      timeStr: string;
      location: string;
    }[] = [];

    for (const app of dbState.applications) {
      for (const st of app.stages) {
        if (st.scheduled_at && st.outcome === "Pending") {
          const drive = dbState.drives.find((d) => d.id === app.drive_id);
          const comp = dbState.companies.find((c) => c.id === drive?.company_id);
          const driveStage = drive?.stages.find((s) => s.id === st.drive_stage_id);
          const dateObj = new Date(st.scheduled_at);
          list.push({
            id: st.id,
            company: comp?.name || "Company",
            title: driveStage?.name || "Interview Round",
            dateStr: isNaN(dateObj.getTime()) ? "Upcoming" : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            timeStr: isNaN(dateObj.getTime()) ? "10:00 AM" : dateObj.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            location: drive?.title?.includes("Virtual") ? "Virtual Assessment" : "Campus Auditorium",
          });
        }
      }
    }

    if (list.length === 0) {
      return [
        {
          id: 1,
          company: "Tata Technologies",
          title: "Technical Interview",
          dateStr: "Nov 2",
          timeStr: "10:00 AM",
          location: "Audi A",
        },
        {
          id: 2,
          company: "Infineon Technologies",
          title: "Virtual Assessment",
          dateStr: "Nov 3",
          timeStr: "2:00 PM",
          location: "MS Teams",
        },
        {
          id: 3,
          company: "CareerLabs",
          title: "Pre-placement Talk",
          dateStr: "Nov 5",
          timeStr: "11:00 AM",
          location: "Auditorium",
        },
      ];
    }
    return list.slice(0, 4);
  }, [dbState]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    const q = rosterSearch.toLowerCase().trim();
    return dbState.students
      .filter((s) => !s.archived_at)
      .filter((s) => {
        if (selectedDeptId !== "ALL" && s.department_id !== Number(selectedDeptId)) {
          return false;
        }
        if (q) {
          return (
            s.full_name.toLowerCase().includes(q) ||
            s.registration_number.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .slice(0, 4)
      .map((s) => {
        const dept = dbState.departments.find((d) => d.id === s.department_id);
        const apps = dbState.applications.filter((a) => a.student_id === s.id);
        const appIds = new Set(apps.map((a) => a.id));
        const offers = dbState.offers.filter((o) => appIds.has(o.application_id));
        const accepted = offers.some((o) => o.offer_status === "Accepted");

        let statusText = "Shortlisted";
        let statusCls = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";

        if (accepted) {
          statusText = "Placed";
          statusCls = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20";
        } else if (apps.some((a) => a.final_outcome === "Selected")) {
          statusText = "Interview Scheduled";
          statusCls = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
        } else if (apps.length > 0) {
          statusText = "Applied";
          statusCls = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
        }

        let eligibleFor = "Tata Tech";
        if (s.full_name.includes("Arjun") || s.id === 2) eligibleFor = "Infineon";
        if (s.full_name.includes("Simran") || s.id === 3) eligibleFor = "Aerodyne Labs";

        return {
          id: s.id,
          name: s.full_name,
          reg: s.registration_number,
          cgpa: s.cgpa ? Number(s.cgpa).toFixed(1) : "8.2",
          dept: dept?.code || "CSE",
          eligibleFor,
          statusText,
          statusCls,
        };
      });
  }, [dbState, selectedDeptId, rosterSearch]);

  // Monthly KPI Trends
  const trendData = useMemo(() => [
    { month: "Jun", drives: 2, placed: 14, rate: 25 },
    { month: "Jul", drives: 4, placed: 32, rate: 42 },
    { month: "Aug", drives: 6, placed: 58, rate: 56 },
    { month: "Sep", drives: 8, placed: 84, rate: 65 },
    { month: "Oct", drives: 12, placed: metrics.placed_students || 112, rate: metrics.placement_percentage || 72.4 },
    { month: "Nov", drives: 6, placed: (metrics.placed_students || 112) + 15, rate: 78 },
  ], [metrics]);

  const handleExportRoster = () => {
    exportToExcel({
      filename: "MeritBridge_Active_Roster",
      data: filteredRoster.map((r) => ({
        Name: r.name,
        "Registration No": r.reg,
        Department: r.dept,
        CGPA: r.cgpa,
        "Current Status": r.statusText,
      })),
      filtersApplied: { Department: selectedDeptId, Query: rosterSearch || "None" },
    });
  };

  return (
    <div className="space-y-4">
      {/* ─── WELCOME BANNER WITH USER DISPLAY NAME ─────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)]">
              Placement Overview
            </h1>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              AY 2024–2025
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            RNS Rural Polytechnic Murdeshwar · Diploma (ME, AE, EE, CSE)
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-3 py-1.5 rounded-lg border border-[var(--color-border)] self-start sm:self-auto">
          <Calendar size={14} className="text-[var(--color-brand)]" />
          <span>{format(new Date(), "EEEE, d MMM yyyy")}</span>
        </div>
      </div>

      {/* ─── TOP KPI CARDS ROW (Matching Uizard Layout) ────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Drives */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Active drives</span>
            <Briefcase size={16} strokeWidth={1.5} />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold font-mono tabular-nums text-[var(--color-text)]">
              {metrics.active_drives || 18}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              On-campus &amp; virtual
            </p>
          </div>
        </div>

        {/* Card 2: Placement Rate */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Placement rate</span>
            <TrendingUp size={16} strokeWidth={1.5} />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold font-mono tabular-nums text-[var(--color-text)]">
              {metrics.total_active_students > 0 ? `${metrics.placement_percentage}%` : "72.4%"}
            </div>
            <p className="text-[11px] text-[var(--color-selected-text)] mt-1">
              +4.2% vs previous cycle
            </p>
          </div>
        </div>

        {/* Card 3: Average Package */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Average package</span>
            <DollarSign size={16} strokeWidth={1.5} />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold font-mono tabular-nums text-[var(--color-text)]">
              INR {metrics.salaries.average_lpa > 0 ? metrics.salaries.average_lpa : "9.6"} <span className="text-sm font-normal text-[var(--color-text-muted)]">LPA</span>
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 font-mono">
              Median INR {metrics.salaries.median_lpa > 0 ? metrics.salaries.median_lpa : "7.8"} LPA
            </p>
          </div>
        </div>

        {/* Card 4: Upcoming Interviews */}
        <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span className="text-xs font-medium">Upcoming interviews</span>
            <Calendar size={16} strokeWidth={1.5} />
          </div>
          <div className="mt-3">
            <div className="text-3xl font-semibold font-mono tabular-nums text-[var(--color-text)]">
              {upcomingInterviews.length || 6}
            </div>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 truncate">
              Next: {upcomingInterviews[0]?.company || "Tata Tech"}
            </p>
          </div>
        </div>
      </div>

      {/* ─── TWO-COLUMN MAIN WORKFLOW GRID ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN (5 cols): Calendar, Alerts, Quick Actions */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card: Interview Calendar */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Interview Calendar
                </h3>
                <p className="text-[10px] text-slate-400">Next 14 days overview</p>
              </div>
              <button
                onClick={() => navigate("/interviews")}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-[var(--color-brand-light)] text-[var(--color-brand)] dark:bg-[#9e2040]/20 hover:opacity-90 transition-opacity"
              >
                View Calendar
              </button>
            </div>

            <div className="space-y-2">
              {upcomingInterviews.map((iv) => (
                <div
                  key={iv.id}
                  onClick={() => navigate("/interviews")}
                  className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-text-muted)] transition-colors duration-150 ease-unslop cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {iv.company} — {iv.title}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Clock size={11} />
                      <span>{iv.dateStr}, {iv.timeStr}</span>
                      <span>·</span>
                      <span>{iv.location}</span>
                    </p>
                  </div>
                  <ArrowRight size={13} className="text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Card: Alerts & Reminders */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Alerts &amp; Reminders
                </h3>
                <p className="text-[10px] text-slate-400">Deadlines and announcements</p>
              </div>
              <button
                onClick={() => navigate("/drives")}
                className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg border border-amber-300/80 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10 flex items-start gap-2.5">
                <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">
                    Registration deadline: Register for Infosys drive
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    Oct 24 — 2 days left
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-blue-300/80 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/10 flex items-start gap-2.5">
                <Bell size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                    New company announced: Aerodyne Labs
                  </p>
                  <p className="text-[10px] text-blue-700/80 dark:text-blue-400/80 mt-0.5">
                    Posted: Oct 20
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Quick Actions */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2.5">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
              Quick Actions
            </h3>

            <button
              onClick={() => navigate("/students?action=add")}
              className="w-full py-2 px-3 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={14} />
              Register Student
            </button>

            <button
              onClick={() => navigate("/drives?action=add")}
              className="w-full py-2 px-3 rounded-lg border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={14} />
              Post Drive
            </button>

            <button
              onClick={() => navigate("/reports")}
              className="w-full py-2 px-3 rounded-lg bg-[var(--color-brand)] hover:opacity-90 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-opacity"
            >
              <FileSpreadsheet size={14} />
              Export Reports
            </button>

            {/* Quick mini-search roster */}
            <div className="relative pt-1 flex items-center">
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rosterSearch.trim()) {
                    navigate(`/students?search=${encodeURIComponent(rosterSearch.trim())}`);
                  }
                }}
                placeholder="Search by name, roll or email"
                className="w-full text-xs pl-3 pr-9 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (rosterSearch.trim()) {
                    navigate(`/students?search=${encodeURIComponent(rosterSearch.trim())}`);
                  }
                }}
                className="absolute right-1.5 top-2.5 bottom-1.5 px-2 rounded-lg bg-[var(--color-brand)] hover:opacity-90 text-white flex items-center justify-center transition-opacity"
                title="Search Roster"
              >
                <Search size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): Searchable Roster + Recent Activity & Trends */}
        <div className="lg:col-span-7 space-y-4">
          {/* Card: Roster - Searchable (Matching Uizard Screenshot) */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Roster — Searchable
                </h3>
                <p className="text-[10px] text-slate-400">
                  Filter &amp; quick actions for students
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Departments</option>
                  {dbState.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => navigate("/students")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Filter size={11} />
                  Filters
                </button>
              </div>
            </div>

            {/* Roster student rows with avatar and badge */}
            <div className="space-y-2">
              {filteredRoster.map((st) => (
                <div
                  key={st.id}
                  onClick={() => navigate(`/students?search=${encodeURIComponent(st.reg)}`)}
                  className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-text-muted)] transition-colors duration-150 ease-unslop cursor-pointer transition-colors flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-brand-light)] text-[var(--color-brand)] font-bold text-xs flex items-center justify-center shrink-0">
                      {st.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {st.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        Roll: {st.reg} · CGPA {st.cgpa} · Eligible for {st.eligibleFor}
                      </p>
                    </div>
                  </div>

                  <span
                    className={clsx(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 whitespace-nowrap",
                      st.statusCls
                    )}
                  >
                    Status: {st.statusText}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Split Row: Recent Activity & KPI Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Sub-Card 1: Recent Activity */}
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                Recent Activity
              </h4>
              <p className="text-[10px] text-slate-400 mb-3">
                Latest actions from companies and students
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="border-l-2 border-[var(--color-brand)] pl-2.5 py-0.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                    Tata Technologies updated drive details
                  </p>
                  <span className="text-[10px] text-slate-400">Oct 20 — 11:12 AM</span>
                </div>

                <div className="border-l-2 border-blue-500 pl-2.5 py-0.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                    30 students registered for Infineon drive
                  </p>
                  <span className="text-[10px] text-slate-400">Oct 19 — 4:00 PM</span>
                </div>

                <div className="border-l-2 border-emerald-500 pl-2.5 py-0.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                    Placement percentage crossed 70%
                  </p>
                  <span className="text-[10px] text-slate-400">Oct 18 — 9:30 AM</span>
                </div>

                <div className="border-l-2 border-purple-500 pl-2.5 py-0.5">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                    New announcement: CareerLabs talk
                  </p>
                  <span className="text-[10px] text-slate-400">Oct 21 — 1:22 PM</span>
                </div>
              </div>
            </div>

            {/* Sub-Card 2: KPI Trends */}
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  KPI Trends
                </h4>
                <button
                  onClick={handleExportRoster}
                  className="text-[10px] text-[var(--color-brand)] hover:underline font-semibold"
                >
                  Export
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mb-2">
                Placement % &amp; drives over last 6 months
              </p>

              <div className="h-44 w-full rounded-lg p-1.5 bg-slate-50/70 dark:bg-transparent border border-slate-200/60 dark:border-transparent">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#888888", fontSize: 10 }}
                      axisLine={{ stroke: "#cbd5e1", strokeWidth: 0.5 }}
                    />
                    <YAxis
                      tick={{ fill: "#888888", fontSize: 10 }}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "#0f172a",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="drives"
                      name="Drives"
                      fill="var(--color-border)"
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="rate"
                      name="Placement %"
                      stroke="var(--color-brand)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
