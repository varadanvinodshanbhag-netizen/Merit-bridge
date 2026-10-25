import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Clock,
} from "lucide-react";
import clsx from "clsx";
import { db } from "@/db/storage";
import { StageOutcome } from "@/types";
import { logAudit } from "@/services/audit";
import { useAuthStore } from "@/store/auth";

export default function InterviewsPage() {
  const user = useAuthStore((s) => s.user);
  const [dbState, setDbState] = useState(db.getState());
  const [search, setSearch] = useState("");
  const [filterCompanyId, setFilterCompanyId] = useState<number | "">("");

  useEffect(() => {
    return db.subscribe(() => {
      setDbState(db.getState());
    });
  }, []);

  // Upcoming interviews (PRD APP-07 / DSH-04: scheduled stage results within 30 days)
  const interviewEvents = useMemo(() => {
    const list: {
      applicationId: number;
      stageResultId: number;
      driveId: number;
      driveTitle: string;
      companyName: string;
      studentName: string;
      studentReg: string;
      stageName: string;
      stageType: string;
      scheduledAt: string;
      outcome: StageOutcome;
    }[] = [];

    for (const app of dbState.applications) {
      const student = dbState.students.find((s) => s.id === app.student_id);
      const drive = dbState.drives.find((d) => d.id === app.drive_id);
      const company = drive ? dbState.companies.find((c) => c.id === drive.company_id) : null;

      if (student && drive && company) {
        for (const st of app.stages) {
          const driveStage = drive.stages.find((ds) => ds.id === st.drive_stage_id);
          const scheduled = st.scheduled_at || drive.drive_date;

          list.push({
            applicationId: app.id,
            stageResultId: st.id,
            driveId: drive.id,
            driveTitle: drive.title,
            companyName: company.name,
            studentName: student.full_name,
            studentReg: student.registration_number,
            stageName: driveStage?.name || "Interview Stage",
            stageType: driveStage?.stage_type || "Technical",
            scheduledAt: scheduled,
            outcome: st.outcome,
          });
        }
      }
    }

    return list;
  }, [dbState.applications, dbState.students, dbState.drives, dbState.companies]);

  const filteredInterviews = useMemo(() => {
    return interviewEvents.filter((iv) => {
      if (filterCompanyId) {
        const drive = dbState.drives.find((d) => d.id === iv.driveId);
        if (drive?.company_id !== filterCompanyId) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesStudent = iv.studentName.toLowerCase().includes(q) || iv.studentReg.toLowerCase().includes(q);
        const matchesCompany = iv.companyName.toLowerCase().includes(q);
        const matchesStage = iv.stageName.toLowerCase().includes(q);
        if (!matchesStudent && !matchesCompany && !matchesStage) return false;
      }
      return true;
    });
  }, [interviewEvents, filterCompanyId, search, dbState.drives]);

  const handleUpdateOutcome = (appId: number, stageResId: number, newOutcome: StageOutcome) => {
    const now = new Date().toISOString();

    db.setState((draft) => {
      const app = draft.applications.find((a) => a.id === appId);
      if (app) {
        const st = app.stages.find((s) => s.id === stageResId);
        if (st) {
          st.outcome = newOutcome;
          st.updated_at = now;
          st.updated_by = user?.id || 1;
        }
        if (newOutcome === "Failed") {
          app.final_outcome = "Rejected";
        } else if (newOutcome === "Passed") {
          const allPassed = app.stages.every((s) => (s.id === stageResId ? true : s.outcome === "Passed"));
          if (allPassed) {
            app.final_outcome = "Selected";
          }
        }
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "UPDATE_INTERVIEW_OUTCOME",
      entityType: "Application",
      entityId: appId,
      summary: `Marked interview outcome ${newOutcome} for app #${appId}`,
    });
  };

  const handleUpdateSchedule = (appId: number, stageResId: number, newDate: string) => {
    if (!newDate) return;
    const now = new Date().toISOString();

    db.setState((draft) => {
      const app = draft.applications.find((a) => a.id === appId);
      if (app) {
        const st = app.stages.find((s) => s.id === stageResId);
        if (st) {
          st.scheduled_at = newDate;
          st.updated_at = now;
          st.updated_by = user?.id || 1;
        }
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "RESCHEDULE_INTERVIEW",
      entityType: "Application",
      entityId: appId,
      summary: `Rescheduled interview round to ${newDate} for app #${appId}`,
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Interview Schedules & Outcomes
        </h1>
        <p className="mt-0.5 text-xs lg:text-sm text-slate-500 dark:text-slate-400">
          Monitor upcoming rounds, technical interviews, and update candidate progression
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by student, company, or round title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
          />
        </div>

        <select
          value={filterCompanyId}
          onChange={(e) => setFilterCompanyId(e.target.value ? Number(e.target.value) : "")}
          className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          <option value="">All Companies</option>
          {dbState.companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Interviews List */}
      <div className="rounded-2xl border border-slate-200/70 dark:border-slate-800/80 bg-white dark:bg-[#12151d] shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400">
                <th className="px-4 py-3.5 text-left font-semibold">Scheduled Date</th>
                <th className="px-4 py-3.5 text-left font-semibold">Candidate</th>
                <th className="px-4 py-3.5 text-left font-semibold">Company & Drive</th>
                <th className="px-4 py-3.5 text-left font-semibold">Round</th>
                <th className="px-4 py-3.5 text-left font-semibold">Current Outcome</th>
                <th className="px-4 py-3.5 text-right font-semibold">Update Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredInterviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-400">
                    No scheduled interviews found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredInterviews.map((iv, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-slate-400 shrink-0" />
                        <input
                          type="date"
                          value={iv.scheduledAt}
                          onChange={(e) =>
                            handleUpdateSchedule(iv.applicationId, iv.stageResultId, e.target.value)
                          }
                          className="bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-[var(--color-brand)] rounded px-1.5 py-0.5 text-xs text-slate-700 dark:text-slate-300 font-mono transition-colors focus:outline-none cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{iv.studentName}</p>
                      <p className="font-mono text-[10px] text-slate-400">{iv.studentReg}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{iv.companyName}</p>
                      <p className="text-[11px] text-slate-400 truncate max-w-xs">{iv.driveTitle}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        {iv.stageName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={clsx(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-bold inline-block",
                          iv.outcome === "Passed" && "bg-emerald-50 text-emerald-700 border border-emerald-200",
                          iv.outcome === "Failed" && "bg-rose-50 text-rose-700 border border-rose-200",
                          iv.outcome === "Pending" && "bg-amber-50 text-amber-700 border border-amber-200",
                          iv.outcome === "Withdrawn" && "bg-slate-100 text-slate-600 border border-slate-200"
                        )}
                      >
                        {iv.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <select
                        value={iv.outcome}
                        onChange={(e) =>
                          handleUpdateOutcome(iv.applicationId, iv.stageResultId, e.target.value as StageOutcome)
                        }
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Passed">Mark Passed</option>
                        <option value="Failed">Mark Failed</option>
                        <option value="Withdrawn">Withdrawn</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
