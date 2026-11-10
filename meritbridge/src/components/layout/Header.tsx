import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Sun,
  Moon,
  Monitor,
  Bell,
  ChevronDown,
  X,
  Users,
  Building2,
  Briefcase,
  ArrowRight,
  Landmark,
  Lock,
} from "lucide-react";
import clsx from "clsx";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { db } from "@/db/storage";

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const icons: Record<string, JSX.Element> = {
    light: <Sun size={15} aria-hidden="true" />,
    dark: <Moon size={15} aria-hidden="true" />,
    system: <Monitor size={15} aria-hidden="true" />,
  };

  const next: Record<string, "dark" | "system" | "light"> = {
    light: "dark",
    dark: "system",
    system: "light",
  };

  return (
    <button
      onClick={() => setTheme(next[theme])}
      aria-label={`Switch theme (current: ${theme})`}
      className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors duration-75"
    >
      {icons[theme]}
    </button>
  );
}

function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const lockSession = useAuthStore((s) => s.lockSession);
  const [open, setOpen] = useState(false);

  const displayName = user?.name || "Placement Officer";
  const displayRole = user?.role || "Staff";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "PO";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="User menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-2)] transition-colors duration-150 ease-unslop"
      >
        <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[11px] font-mono font-semibold text-[var(--color-text)] flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="hidden sm:block text-left leading-tight">
          <p className="text-xs font-medium text-[var(--color-text)]">{displayName}</p>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{displayRole}</p>
        </div>
        <ChevronDown size={13} className="text-[var(--color-text-muted)]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg py-1 z-50 animate-in fade-in duration-150 ease-unslop"
        >
          <div className="px-3 py-2 border-b border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text)]">{displayName}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">{displayRole}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              lockSession();
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] flex items-center gap-2 transition-colors duration-150 ease-unslop"
          >
            <Lock size={14} className="text-[var(--color-text-muted)]" />
            <span>Lock Terminal</span>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setUser(null);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-xs font-medium text-[#e5484d] hover:bg-rose-500/10 transition-colors duration-150 ease-unslop"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const navigate = useNavigate();
  const lockSession = useAuthStore((s) => s.lockSession);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close notifications on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  // Keyboard shortcut listener for Ctrl+K / Cmd+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        if (notifOpen) setNotifOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen, notifOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setSearchQuery("");
    }
  }, [paletteOpen]);

  // Operational search across students, companies, and drives
  const searchResults = (() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return { students: [], companies: [], drives: [] };

    const state = db.getState();
    const students = state.students
      .filter(
        (s) =>
          !s.archived_at &&
          (s.registration_number.toLowerCase().includes(q) ||
            s.full_name.toLowerCase().includes(q) ||
            s.email?.toLowerCase().includes(q))
      )
      .slice(0, 4);

    const companies = state.companies
      .filter(
        (c) =>
          c.status !== "Archived" &&
          (c.name.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q))
      )
      .slice(0, 4);

    const drives = state.drives
      .filter((d) => d.title.toLowerCase().includes(q))
      .slice(0, 4);

    return { students, companies, drives };
  })();

  const hasResults =
    searchResults.students.length > 0 ||
    searchResults.companies.length > 0 ||
    searchResults.drives.length > 0;

  return (
    <>
      <header
        className={clsx(
          "flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-6",
          "bg-[var(--color-surface)] select-none transition-colors duration-150 ease-unslop"
        )}
      >
        {/* Institutional Title & Search */}
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-2)] text-[var(--color-brand)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
              <Landmark size={15} strokeWidth={1.75} />
            </div>
            <div className="hidden sm:block leading-tight">
              <span className="text-xs font-semibold tracking-tight text-[var(--color-text)] block">
                MeritBridge
              </span>
              <span className="text-[10px] font-medium text-[var(--color-text-muted)] block">
                From RNS Rural Polytechnic
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className={clsx(
              "w-full flex items-center justify-between rounded-lg border border-[var(--color-border)]",
              "bg-[var(--color-surface-2)] pl-3 pr-2 py-1.5 text-xs text-left",
              "text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] transition-colors duration-150 ease-unslop"
            )}
          >
            <span className="flex items-center gap-2">
              <Search size={14} strokeWidth={1.5} className="text-[var(--color-text-muted)]" aria-hidden="true" />
              <span>Search</span>
            </span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)]">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right side: Quiet Actions + User Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <ThemeToggle />

          <button
            onClick={() => lockSession()}
            aria-label="Lock terminal session"
            title="Lock Terminal Session"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors duration-150 ease-unslop"
          >
            <Lock size={15} strokeWidth={1.5} aria-hidden="true" />
          </button>

          {/* Quiet Notifications button with institutional status dot */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((p) => !p)}
              aria-label="Notifications (2 unread)"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors duration-150 ease-unslop relative"
            >
              <Bell size={15} strokeWidth={1.5} aria-hidden="true" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-brand)]" />
            </button>

            {/* Notifications Popover Dropdown */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg p-3 z-50 animate-in fade-in duration-150 ease-unslop">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                  <h4 className="text-xs font-semibold text-[var(--color-text)]">
                    Notifications
                  </h4>
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    2 unread
                  </span>
                </div>

                <div className="space-y-2 py-2">
                  <div
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/drives");
                    }}
                    className="p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] cursor-pointer hover:border-[var(--color-text-muted)] transition-colors duration-150 ease-unslop"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#fde68a] mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Infosys Drive Registration
                        </p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                          Deadline in 2 days (Oct 26)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/companies");
                    }}
                    className="p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] cursor-pointer hover:border-[var(--color-text-muted)] transition-colors duration-150 ease-unslop"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#93c5fd] mt-1.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Aerodyne Labs Announced
                        </p>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">
                          Drive scheduled for Nov 2026
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
                  <button
                    onClick={() => {
                      setNotifOpen(false);
                      navigate("/interviews");
                    }}
                    className="text-[#9e2040] hover:underline font-semibold"
                  >
                    Interview calendar
                  </button>
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          <UserMenu />
        </div>
      </header>

      {/* Instant Command Palette Modal */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-75">
          <div
            className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#12151d] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-75"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <Search size={16} className="text-[var(--color-brand)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students (name, reg no), companies, or placement drives..."
                className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => setPaletteOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={15} />
              </button>
            </div>

            {/* Results Body */}
            <div className="max-h-80 overflow-y-auto p-2 text-xs">
              {!searchQuery.trim() ? (
                <div className="py-6 text-center text-slate-400 text-[11px]">
                  Type candidate name, registration number, company, or drive title...
                </div>
              ) : !hasResults ? (
                <div className="py-6 text-center text-slate-400 text-[11px]">
                  No records found matching "{searchQuery}".
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Students section */}
                  {searchResults.students.length > 0 && (
                    <div>
                      <span className="px-2 text-[11px] font-medium text-[var(--color-text-muted)] block mb-1.5">
                        Students ({searchResults.students.length})
                      </span>
                      <div className="space-y-0.5">
                        {searchResults.students.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setPaletteOpen(false);
                              navigate(`/students?id=${s.id}`);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors duration-75"
                          >
                            <div className="flex items-center gap-2">
                              <Users size={14} className="text-[var(--color-brand)] shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {s.full_name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({s.registration_number})
                              </span>
                            </div>
                            <ArrowRight size={13} className="text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Companies section */}
                  {searchResults.companies.length > 0 && (
                    <div>
                      <span className="px-2 text-[11px] font-medium text-[var(--color-text-muted)] block mb-1.5">
                        Companies ({searchResults.companies.length})
                      </span>
                      <div className="space-y-0.5">
                        {searchResults.companies.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setPaletteOpen(false);
                              navigate(`/companies?search=${encodeURIComponent(c.name)}`);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors duration-75"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 size={14} className="text-blue-500 shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {c.name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                · {c.industry || "Technology"}
                              </span>
                            </div>
                            <ArrowRight size={13} className="text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drives section */}
                  {searchResults.drives.length > 0 && (
                    <div>
                      <span className="px-2 text-[11px] font-medium text-[var(--color-text-muted)] block mb-1.5">
                        Placement Drives ({searchResults.drives.length})
                      </span>
                      <div className="space-y-0.5">
                        {searchResults.drives.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => {
                              setPaletteOpen(false);
                              navigate(`/drives?search=${encodeURIComponent(d.title)}`);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer transition-colors duration-75"
                          >
                            <div className="flex items-center gap-2">
                              <Briefcase size={14} className="text-emerald-500 shrink-0" />
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {d.title}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                · {d.drive_date}
                              </span>
                            </div>
                            <ArrowRight size={13} className="text-slate-400" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer tips */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex justify-between text-[10px] text-slate-400">
              <span>Press <strong>ESC</strong> to close</span>
              <span>Quick Search</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
