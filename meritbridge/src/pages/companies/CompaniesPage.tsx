import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Building2,
  Search,
  Plus,
  MapPin,
  Globe,
  Archive,
  RotateCcw,
  Trash2,
  X,
  Filter,
  Pencil,
} from "lucide-react";
import clsx from "clsx";
import { db } from "@/db/storage";
import { Company, CompanyContact } from "@/types";
import { logAudit } from "@/services/audit";
import { useAuthStore } from "@/store/auth";

export default function CompaniesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const [dbState, setDbState] = useState(db.getState());
  const [search, setSearch] = useState("");
  const [filterIndustry, setFilterIndustry] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Advanced Filters Drawer (Matching Uizard Prototype Screen)
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [filterYear, setFilterYear] = useState("2026");
  const [branches, setBranches] = useState<string[]>(["Computer Science"]);
  const [minCgpa, setMinCgpa] = useState("7.50");
  const [maxCgpa, setMaxCgpa] = useState("9.50");
  const [minSalary, setMinSalary] = useState("7.50");
  const [maxSalary, setMaxSalary] = useState("15.0");
  const [jobTypes, setJobTypes] = useState<string[]>(["Full-time"]);
  const [dateFrom, setDateFrom] = useState("2026-02-01");
  const [dateTo, setDateTo] = useState("2026-12-31");
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    return db.subscribe(() => {
      setDbState(db.getState());
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") setShowAddModal(true);
  }, [searchParams]);

  // Distinct industries for filter
  const industries = useMemo(() => {
    const set = new Set<string>();
    for (const c of dbState.companies) {
      if (c.industry) set.add(c.industry);
    }
    return Array.from(set);
  }, [dbState.companies]);

  // Filtered companies
  const filteredCompanies = useMemo(() => {
    return dbState.companies.filter((c) => {
      if (!showArchived && c.status === "Archived") return false;
      if (showArchived && c.status !== "Archived") return false;

      if (filterIndustry && c.industry !== filterIndustry) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesIndustry = c.industry?.toLowerCase().includes(q) || false;
        const matchesLocation = c.location?.toLowerCase().includes(q) || false;
        if (!matchesName && !matchesIndustry && !matchesLocation) return false;
      }

      return true;
    });
  }, [dbState.companies, showArchived, filterIndustry, search]);

  // Archive / Restore Company
  const handleToggleArchive = (company: Company) => {
    const isArchived = company.status === "Archived";
    const now = new Date().toISOString();

    db.setState((draft) => {
      const idx = draft.companies.findIndex((c) => c.id === company.id);
      if (idx !== -1) {
        draft.companies[idx].status = isArchived ? "Active" : "Archived";
        draft.companies[idx].updated_at = now;
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: isArchived ? "RESTORE_COMPANY" : "ARCHIVE_COMPANY",
      entityType: "Company",
      entityId: company.name,
      summary: `${isArchived ? "Restored" : "Archived"} company ${company.name}`,
    });
  };

  // Delete Company (PRD 6.4: Only with NO recorded drives)
  const handleDeleteCompany = (company: Company) => {
    const hasDrives = dbState.drives.some((d) => d.company_id === company.id);
    if (hasDrives) {
      alert(`Cannot delete ${company.name}: has recruitment drives recorded. Please archive instead.`);
      return;
    }

    if (!confirm(`Permanently delete ${company.name}? This action is audited.`)) return;

    db.setState((draft) => {
      draft.companies = draft.companies.filter((c) => c.id !== company.id);
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: "DELETE_COMPANY",
      entityType: "Company",
      entityId: company.name,
      summary: `Permanently deleted company ${company.name}`,
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Company Directory
          </h1>
          <p className="mt-0.5 text-xs lg:text-sm text-slate-500 dark:text-slate-400">
            {filteredCompanies.length} partner organizations & recruiters recorded
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-colors self-start sm:self-auto"
        >
          <Plus size={15} />
          Add Company
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] dark:ring-0">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by company name, industry, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
          />
        </div>

        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          className="w-full md:w-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
        >
          <option value="">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowFiltersDrawer((prev) => !prev)}
          className={clsx(
            "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors shrink-0",
            showFiltersDrawer
              ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
              : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60"
          )}
        >
          <Filter size={14} />
          <span>{showFiltersDrawer ? "Hide Filters" : "Advanced Filters"}</span>
        </button>

        <button
          onClick={() => setShowArchived((prev) => !prev)}
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

      {/* Companies Grid & Advanced Filters Side Panel */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCompanies.map((c) => {
              const drives = dbState.drives.filter((d) => d.company_id === c.id);
              const activeDrives = drives.filter(
                (d) => d.status === "In Progress" || d.status === "Registration Open"
              );

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCompany(c)}
                  className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white dark:bg-[#12151d] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] dark:ring-0 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150 cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-brand-light)] text-[var(--color-brand)] font-bold text-sm shadow-sm">
                          {c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-brand)] transition-colors">
                            {c.name}
                          </h3>
                          <p className="text-[11px] text-slate-400">{c.industry || "General Industry"}</p>
                        </div>
                      </div>

                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          c.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/60"
                        )}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      {c.location && (
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{c.location}</span>
                        </div>
                      )}
                      {c.website && (
                        <div className="flex items-center gap-2">
                          <Globe size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate text-blue-600 dark:text-blue-400">{c.website}</span>
                        </div>
                      )}
                      {c.department_ids && c.department_ids.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] text-slate-400 font-medium mr-1">Depts:</span>
                          {c.department_ids.map((dId) => {
                            const d = dbState.departments.find((dep) => dep.id === dId);
                            return d ? (
                              <span
                                key={d.id}
                                className="rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 px-1.5 py-0.5 text-[10px] font-bold"
                              >
                                {d.code}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                        Recruitment Drives
                      </p>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {drives.length} total ({activeDrives.length} active)
                      </p>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingCompany(c)}
                        title="Edit Company Details"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleArchive(c)}
                        title={c.status === "Archived" ? "Restore" : "Archive"}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {c.status === "Archived" ? <RotateCcw size={14} /> : <Archive size={14} />}
                      </button>
                      {drives.length === 0 && (
                        <button
                          onClick={() => handleDeleteCompany(c)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {showFiltersDrawer && (
          <div className="w-80 shrink-0 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#161922] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] dark:ring-0 space-y-4 text-xs animate-in slide-in-from-right-4 duration-75">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Advanced Filters</h3>
              <button onClick={() => setShowFiltersDrawer(false)} className="text-slate-400 hover:text-slate-200">
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Company</label>
              <input
                type="text"
                placeholder="Search company name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Academic Year</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Branches</label>
              <div className="space-y-1.5">
                {["Computer Science", "Electronics", "Mechanical", "Civil"].map((branch) => {
                  const isChecked = branches.includes(branch);
                  return (
                    <label key={branch} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) setBranches(branches.filter((b) => b !== branch));
                          else setBranches([...branches, branch]);
                        }}
                        className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                      />
                      <span>{branch}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">CGPA Cutoff</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={minCgpa}
                  onChange={(e) => setMinCgpa(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="number"
                  step="0.1"
                  value={maxCgpa}
                  onChange={(e) => setMaxCgpa(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Salary Range (LPA)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minSalary}
                  onChange={(e) => setMinSalary(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="number"
                  value={maxSalary}
                  onChange={(e) => setMaxSalary(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Job Type</label>
              <div className="space-y-1.5">
                {["Full-time", "Internship", "Contract"].map((type) => {
                  const isChecked = jobTypes.includes(type);
                  return (
                    <label key={type} className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) setJobTypes(jobTypes.filter((t) => t !== type));
                          else setJobTypes([...jobTypes, type]);
                        }}
                        className="rounded text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                      />
                      <span>{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Drive Date</label>
              <div className="space-y-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
              <label className="flex items-center justify-between cursor-pointer text-slate-600 dark:text-slate-300">
                <span>Show Upcoming</span>
                <input
                  type="checkbox"
                  checked={showUpcoming}
                  onChange={(e) => setShowUpcoming(e.target.checked)}
                  className="rounded text-[var(--color-brand)]"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer text-slate-600 dark:text-slate-300">
                <span>Show Past</span>
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(e) => setShowPast(e.target.checked)}
                  className="rounded text-[var(--color-brand)]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setBranches(["Computer Science"]);
                  setMinCgpa("7.50");
                  setMaxCgpa("9.50");
                  setMinSalary("7.50");
                  setMaxSalary("15.0");
                  setJobTypes(["Full-time"]);
                }}
                className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-center"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersDrawer(false)}
                className="py-2 px-3 rounded-xl bg-[var(--color-brand)] hover:opacity-90 text-white font-semibold text-center"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Company Modal */}
      {showAddModal && (
        <CompanyModal
          onClose={() => {
            setShowAddModal(false);
            searchParams.delete("action");
            setSearchParams(searchParams);
          }}
        />
      )}

      {/* View Company Detail Modal */}
      {selectedCompany && (
        <CompanyDetailModal
          company={selectedCompany}
          onEdit={() => {
            const comp = selectedCompany;
            setSelectedCompany(null);
            setEditingCompany(comp);
          }}
          onClose={() => setSelectedCompany(null)}
        />
      )}

      {/* Edit Company Modal */}
      {editingCompany && (
        <CompanyModal
          initialData={editingCompany}
          onClose={() => setEditingCompany(null)}
        />
      )}
    </div>
  );
}

// ─── Company Form Modal ───────────────────────────────────────────────────────
function CompanyModal({
  initialData,
  onClose,
}: {
  initialData?: Company | null;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const state = db.getState();

  const [name, setName] = useState(initialData?.name || "");
  const [industry, setIndustry] = useState(initialData?.industry || "");
  const [location, setLocation] = useState(initialData?.location || "");
  const [website, setWebsite] = useState(initialData?.website || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(initialData?.department_ids || []);
  const [contactName, setContactName] = useState(initialData?.contacts[0]?.name || "");
  const [contactEmail, setContactEmail] = useState(initialData?.contacts[0]?.email || "");
  const [contactPhone, setContactPhone] = useState(initialData?.contacts[0]?.phone || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Company name is required");
      return;
    }

    const norm = cleanName.toLowerCase();
    const exists = state.companies.some(
      (c) => c.name_normalized === norm && c.id !== initialData?.id
    );
    if (exists) {
      setError(`Company "${cleanName}" already exists.`);
      return;
    }

    const now = new Date().toISOString();
    const nextId = state.companies.length > 0
      ? Math.max(...state.companies.map((c) => c.id)) + 1
      : 1;

    db.setState((draft) => {
      const contacts: CompanyContact[] = contactName
        ? [
            {
              id: Date.now(),
              company_id: initialData ? initialData.id : nextId,
              name: contactName.trim(),
              designation: "Campus Recruiter",
              email: contactEmail.trim(),
              phone: contactPhone.trim(),
              is_primary: true,
            },
          ]
        : [];

      if (initialData) {
        const comp = draft.companies.find((c) => c.id === initialData.id);
        if (comp) {
          comp.name = cleanName;
          comp.name_normalized = norm;
          comp.industry = industry.trim() || undefined;
          comp.location = location.trim() || undefined;
          comp.website = website.trim() || undefined;
          comp.description = description.trim() || undefined;
          comp.department_ids = selectedDeptIds.length > 0 ? selectedDeptIds : undefined;
          comp.updated_at = now;
          if (contacts.length > 0) comp.contacts = contacts;
        }
      } else {
        draft.companies.push({
          id: nextId,
          name: cleanName,
          name_normalized: norm,
          industry: industry.trim() || undefined,
          location: location.trim() || undefined,
          website: website.trim() || undefined,
          description: description.trim() || undefined,
          department_ids: selectedDeptIds.length > 0 ? selectedDeptIds : undefined,
          status: "Active",
          contacts,
          job_roles: [],
          created_at: now,
          updated_at: now,
        });
      }
    });

    logAudit({
      userId: user?.id || 1,
      userName: user?.name || "Placement Staff",
      action: initialData ? "UPDATE_COMPANY" : "ADD_COMPANY",
      entityType: "Company",
      entityId: cleanName,
      summary: initialData ? `Updated company profile: ${cleanName}` : `Registered company ${cleanName}`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-light)] text-[var(--color-brand)]">
              <Building2 size={18} />
            </span>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Add Partner Company</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Company Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Google / Microsoft"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 font-semibold"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Industry</label>
              <input
                type="text"
                placeholder="e.g. Information Technology"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Location</label>
              <input
                type="text"
                placeholder="e.g. Bangalore, India"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Website</label>
              <input
                type="url"
                placeholder="https://..."
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Description</label>
            <textarea
              rows={2}
              placeholder="Brief company profile or hiring focus..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Target Department(s) <span className="text-slate-400 font-normal">(Optional in Company Settings)</span>
              </label>
              <span className="text-[10px] text-slate-400">Pre-populates drive setup</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {state.departments.map((dept) => {
                const isChecked = selectedDeptIds.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeptIds((prev) =>
                        isChecked ? prev.filter((id) => id !== dept.id) : [...prev, dept.id]
                      );
                    }}
                    className={clsx(
                      "flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
                      isChecked
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]"
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

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Primary Campus Contact</h4>
            <div className="grid grid-cols-3 gap-2.5">
              <input
                type="text"
                placeholder="Contact Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2"
              />
              <input
                type="email"
                placeholder="Contact Email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2"
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
              Save Company
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Company Detail Modal ─────────────────────────────────────────────────────
function CompanyDetailModal({
  company,
  onEdit,
  onClose,
}: {
  company: Company;
  onEdit?: () => void;
  onClose: () => void;
}) {
  const state = db.getState();
  const drives = state.drives.filter((d) => d.company_id === company.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white font-bold text-sm">
              {company.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{company.name}</h2>
              <p className="text-xs text-slate-500">{company.industry} · {company.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Pencil size={13} />
                <span>Edit</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
          {/* Target Departments */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 mb-2">Target Departments</h3>
            {company.department_ids && company.department_ids.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {company.department_ids.map((dId) => {
                  const d = state.departments.find((dep) => dep.id === dId);
                  return d ? (
                    <span
                      key={d.id}
                      className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 px-2.5 py-1 text-xs font-semibold"
                    >
                      {d.code} · {d.name}
                    </span>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-slate-400">No specific departments set (Open to all branches).</p>
            )}
          </div>

          {/* Contacts */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 mb-2">Campus Contacts</h3>
            {company.contacts.length === 0 ? (
              <p className="text-slate-400">No contact persons registered.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {company.contacts.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/40">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</p>
                    <p className="text-[11px] text-slate-500">{c.designation}</p>
                    <p className="text-[11px] text-blue-600 mt-1">{c.email}</p>
                    <p className="text-[11px] text-slate-400">{c.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drives */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-slate-400 mb-2">Recruitment Drives</h3>
            {drives.length === 0 ? (
              <p className="text-slate-400">No recruitment drives created yet.</p>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Drive Title</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {drives.map((d) => (
                      <tr key={d.id}>
                        <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">{d.title}</td>
                        <td className="px-3 py-2.5 text-slate-500">{d.drive_date}</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold">
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
