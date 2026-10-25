import { useState, useEffect, useRef, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuthStore } from "@/store/auth";
import { SECURITY_CONFIG } from "@/services/security";
import { Lock, LogOut, KeyRound, AlertTriangle } from "lucide-react";
import MeritBridgeLogo from "@/components/brand/MeritBridgeLogo";

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const isLocked = useAuthStore((s) => s.isLocked);
  const lockSession = useAuthStore((s) => s.lockSession);
  const unlockSession = useAuthStore((s) => s.unlockSession);
  const setUser = useAuthStore((s) => s.setUser);

  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inactivity tracking timer (15 minutes idle timeout)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!user || isLocked) return;

    timerRef.current = setTimeout(() => {
      lockSession();
    }, SECURITY_CONFIG.INACTIVITY_TIMEOUT_MS);
  }, [user, isLocked, lockSession]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    const handleActivity = () => resetInactivityTimer();

    events.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));
    resetInactivityTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [resetInactivityTimer]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsSubmitting(true);
    setUnlockError(null);

    try {
      const res = await unlockSession(password);
      if (res.success) {
        setPassword("");
        setUnlockError(null);
      } else {
        setUnlockError(res.error || "Incorrect password.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unlock failed.";
      setUnlockError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex h-full overflow-hidden bg-[#f4f6f9] dark:bg-[#0c0e14]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 lg:p-8 transition-colors duration-200"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>

      {/* ─── Inactivity / Terminal Lock Screen ─────────────────────────────────── */}
      {isLocked && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lockscreen-title"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md px-4 animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-[#12151d] p-8 shadow-2xl text-center">
            {/* Logo / Lock icon lockup */}
            <div className="mx-auto mb-6 flex flex-col items-center">
              <div className="relative mb-3">
                <MeritBridgeLogo size={56} className="shadow-lg shadow-[#9e2040]/30 rounded-2xl" />
                <div className="absolute -bottom-1 -right-1 rounded-full bg-rose-500 p-1.5 text-white ring-4 ring-[#12151d]">
                  <Lock size={12} strokeWidth={3} />
                </div>
              </div>
              <h2 id="lockscreen-title" className="text-xl font-bold tracking-tight text-white">
                Terminal Locked
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                MeritBridge session secured. Enter your password to resume.
              </p>
            </div>

            {/* Current user badge */}
            <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-xs font-bold text-white flex items-center justify-center">
                {(user?.name || "User").slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200">{user?.name || "Placement Officer"}</p>
                <p className="text-[10px] text-slate-400">{user?.role || "Staff"}</p>
              </div>
            </div>

            {/* Unlock Form */}
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter your password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-xs md:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 focus:border-[var(--color-brand)] transition-all"
                />
              </div>

              {unlockError && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-950/40 border border-rose-900/50 p-2.5 text-xs text-rose-400 flex items-start gap-2 text-left"
                >
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{unlockError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !password}
                className="w-full rounded-xl bg-[var(--color-brand)] py-2.5 px-4 text-xs md:text-sm font-semibold text-white shadow-md shadow-[#9e2040]/25 hover:bg-[var(--color-brand-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <KeyRound size={15} />
                <span>{isSubmitting ? "Unlocking..." : "Unlock Terminal"}</span>
              </button>
            </form>

            {/* Sign out switch */}
            <div className="mt-6 border-t border-slate-800/80 pt-4">
              <button
                type="button"
                onClick={() => setUser(null)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <LogOut size={13} />
                <span>Switch Account / Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
