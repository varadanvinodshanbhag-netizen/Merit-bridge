import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import {
  Eye,
  EyeOff,
  LogIn,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  User as UserIcon,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import MeritBridgeLogo from "@/components/brand/MeritBridgeLogo";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { Sun, Moon, Monitor } from "lucide-react";
import { db } from "@/db/storage";
import {
  verifyPassword,
  hashPassword,
  sha256Normalized,
  calculatePasswordStrength,
  isAccountLocked,
  SECURITY_CONFIG,
} from "@/services/security";
import { logAudit } from "@/services/audit";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

function ThemePill() {
  const { theme, setTheme } = useThemeStore();
  const next: Record<string, "dark" | "system" | "light"> = {
    light: "dark",
    dark: "system",
    system: "light",
  };
  const icons = {
    light: <Sun size={14} />,
    dark: <Moon size={14} />,
    system: <Monitor size={14} />,
  };
  return (
    <button
      onClick={() => setTheme(next[theme])}
      aria-label={`Theme: ${theme}`}
      className="flex items-center gap-1 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
    >
      {icons[theme]}
      <span className="capitalize">{theme}</span>
    </button>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  // Progressive warnings and lockout state
  const [failedCount, setFailedCount] = useState(0);
  const [lockoutTarget, setLockoutTarget] = useState<string | null>(null);
  const [lockoutRemainingSecs, setLockoutRemainingSecs] = useState(0);

  // Admin Master PIN verification modal
  const [pendingAdminUser, setPendingAdminUser] = useState<any | null>(null);
  const [adminPinInput, setAdminPinInput] = useState("");
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  // 4-Step Password Recovery Wizard (from SecureHash Lab forgot.html)
  const [showRecoveryWizard, setShowRecoveryWizard] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3 | 4>(1);
  const [recUsername, setRecUsername] = useState("");
  const [recUserObj, setRecUserObj] = useState<any | null>(null);
  const [recAnswer, setRecAnswer] = useState("");
  const [recMasterKeyMode, setRecMasterKeyMode] = useState(false);
  const [recMasterKeyInput, setRecMasterKeyInput] = useState("");
  const [recNewPassword, setRecNewPassword] = useState("");
  const [recConfirmPassword, setRecConfirmPassword] = useState("");
  const [showRecNewPass, setShowRecNewPass] = useState(false);
  const [showRecConfirmPass, setShowRecConfirmPass] = useState(false);
  const [recWizardError, setRecWizardError] = useState<string | null>(null);

  // Forced Initial Password Change
  const [mustChangeUser, setMustChangeUser] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePassError, setChangePassError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const currentUnameInput = watch("username");

  // Load remember-me username on mount
  useEffect(() => {
    const saved = localStorage.getItem("mb_remember_user");
    if (saved) {
      setValue("username", saved);
      setRememberMe(true);
      checkUserLockout(saved);
    }
  }, [setValue]);

  // Live countdown timer for lockout
  useEffect(() => {
    if (lockoutRemainingSecs <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemainingSecs((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLockoutTarget(null);
          setError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemainingSecs]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  const checkUserLockout = (uname: string) => {
    if (!uname) return;
    const state = db.getState();
    const user = state.users.find((u) => u.username.toLowerCase() === uname.trim().toLowerCase());
    if (user) {
      const lock = isAccountLocked(user.locked_until);
      if (lock.locked) {
        setLockoutTarget(user.username);
        setLockoutRemainingSecs(lock.remainingSeconds);
      } else {
        setLockoutTarget(null);
        setLockoutRemainingSecs(0);
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const state = db.getState();
      const user = state.users.find(
        (u) => u.username.toLowerCase() === data.username.trim().toLowerCase()
      );

      if (!user) {
        setFailedCount((prev) => prev + 1);
        triggerShake();
        setError("Invalid username or password.");
        logAudit({
          userId: 0,
          userName: "Anonymous",
          action: "UPDATE_STATUS",
          entityType: "User",
          entityId: data.username,
          summary: `Failed login attempt: Username '${data.username}' does not exist`,
        });
        return;
      }

      if (!user.is_active) {
        triggerShake();
        setError("This account is currently disabled. Please contact your administrator.");
        return;
      }

      // Check account lockout
      const lockCheck = isAccountLocked(user.locked_until);
      if (lockCheck.locked) {
        setLockoutTarget(user.username);
        setLockoutRemainingSecs(lockCheck.remainingSeconds);
        triggerShake();
        return;
      }

      // Cryptographic password verification (supports salted hash, raw SHA-256, master hash)
      const masterHash =
        state.app_security.master_hash || SECURITY_CONFIG.DEFAULT_MASTER_HASH;
      const isMatch = await verifyPassword(data.password, user.password_hash, masterHash);

      if (!isMatch) {
        const nextFailed = (user.failed_attempts || 0) + 1;
        const willLock = nextFailed >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS;

        db.setState((draft) => {
          const u = draft.users.find((item) => item.id === user.id);
          if (u) {
            u.failed_attempts = nextFailed;
            if (willLock) {
              u.locked_until = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS).toISOString();
            }
          }
        });

        logAudit({
          userId: user.id,
          userName: user.display_name,
          action: "UPDATE_STATUS",
          entityType: "User",
          entityId: String(user.id),
          summary: `Failed password verification attempt (${nextFailed}/${SECURITY_CONFIG.MAX_FAILED_ATTEMPTS})`,
        });

        triggerShake();
        setFailedCount(nextFailed);

        if (willLock) {
          setLockoutTarget(user.username);
          setLockoutRemainingSecs(SECURITY_CONFIG.LOCKOUT_DURATION_MS / 1000);
          setError("Account locked out due to multiple failed attempts.");
        } else {
          const remaining = SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - nextFailed;
          setError(`Invalid username or password. ${remaining} attempt(s) remaining.`);
        }
        return;
      }

      // Admin Security PIN verification step (from SecureHash Lab)
      if (user.role === "Admin" || user.username.toLowerCase() === "admin") {
        setPendingAdminUser(user);
        setAdminPinInput("");
        setAdminPinError(null);
        return;
      }

      // Normal Login Complete
      finalizeLogin(user);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Authentication error occurred.";
      setError(`Login failed: ${msg}`);
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPinError(null);

    const state = db.getState();
    const validPin = state.app_security.admin_pin || SECURITY_CONFIG.DEFAULT_ADMIN_PIN;

    if (adminPinInput.trim() !== validPin) {
      setAdminPinError("Admin Security PIN verification failed. Incorrect PIN.");
      triggerShake();
      logAudit({
        userId: pendingAdminUser.id,
        userName: pendingAdminUser.display_name,
        action: "UPDATE_STATUS",
        entityType: "Security",
        entityId: "AdminPIN",
        summary: `Admin PIN verification failed for ${pendingAdminUser.username}`,
      });
      return;
    }

    logAudit({
      userId: pendingAdminUser.id,
      userName: pendingAdminUser.display_name,
      action: "UPDATE_STATUS",
      entityType: "Security",
      entityId: "AdminPIN",
      summary: `Admin PIN verified successfully for ${pendingAdminUser.username}`,
    });

    const user = pendingAdminUser;
    setPendingAdminUser(null);
    finalizeLogin(user);
  };

  const finalizeLogin = async (user: any) => {
    // Transparently upgrade plain text passwords to salted SHA-256
    let upgradedHash = user.password_hash;
    if (!user.password_hash.includes("$")) {
      const plainPass = watch("password");
      if (plainPass) {
        upgradedHash = await hashPassword(plainPass);
      }
    }

    db.setState((draft) => {
      const u = draft.users.find((item) => item.id === user.id);
      if (u) {
        u.password_hash = upgradedHash;
        u.failed_attempts = 0;
        u.locked_until = null;
        u.last_login_at = new Date().toISOString();
      }
    });

    logAudit({
      userId: user.id,
      userName: user.display_name,
      action: "UPDATE_STATUS",
      entityType: "User",
      entityId: String(user.id),
      summary: `User ${user.username} authenticated successfully`,
    });

    // Handle Remember Me preference
    if (rememberMe) {
      localStorage.setItem("mb_remember_user", user.username);
    } else {
      localStorage.removeItem("mb_remember_user");
    }

    if (user.must_change_password) {
      setMustChangeUser(user);
      return;
    }

    setUser({
      id: user.id,
      name: user.display_name,
      role: user.role,
    });

    navigate("/dashboard", { replace: true });
  };

  // ─── 4-Step Recovery Wizard Handlers ─────────────────────────────────────────

  const openRecoveryWizard = (targetUname?: string) => {
    const defaultName = targetUname || currentUnameInput || "";
    setRecUsername(defaultName);
    setRecWizardError(null);
    setRecMasterKeyMode(false);
    setRecMasterKeyInput("");
    setRecNewPassword("");
    setRecConfirmPassword("");

    if (defaultName.trim()) {
      const state = db.getState();
      const u = state.users.find((item) => item.username.toLowerCase() === defaultName.trim().toLowerCase());
      if (u) {
        setRecUserObj(u);
        setRecoveryStep(2);
        setShowRecoveryWizard(true);
        return;
      }
    }

    setRecoveryStep(1);
    setShowRecoveryWizard(true);
  };

  const handleRecStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setRecWizardError(null);

    const uname = recUsername.trim().toLowerCase();
    if (!uname) {
      setRecWizardError("Please enter your username.");
      return;
    }

    const state = db.getState();
    const u = state.users.find((item) => item.username.toLowerCase() === uname);
    if (!u) {
      setRecWizardError("No account found with that username.");
      return;
    }

    setRecUserObj(u);
    setRecoveryStep(2);
  };

  const handleRecStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecWizardError(null);

    if (recMasterKeyMode) {
      // Master Recovery Key Bypass
      const state = db.getState();
      const validKey = state.app_security.recovery_key_hash || SECURITY_CONFIG.DEFAULT_RECOVERY_KEY;
      if (recMasterKeyInput.trim() !== validKey) {
        setRecWizardError("Invalid Master Recovery Key.");
        return;
      }
      setRecoveryStep(3);
      return;
    }

    // Security Question & Answer verification
    if (!recAnswer.trim()) {
      setRecWizardError("Please enter your security answer.");
      return;
    }

    const state = db.getState();
    const user = state.users.find((u) => u.id === recUserObj.id);
    if (!user) {
      setRecWizardError("User record error.");
      return;
    }

    const enteredHash = await sha256Normalized(recAnswer);
    // Default admin fallback security answer is 'fluffy'
    const validAnswerHash =
      user.security_answer_hash ||
      "d79cf02bc36b13e9a5840ca8d6f5f92ff481b3ee60215a77028f090710ecf79d"; // sha256('fluffy')

    if (enteredHash !== validAnswerHash) {
      setRecWizardError("Incorrect security answer. Please try again.");
      return;
    }

    setRecoveryStep(3);
  };

  const strength = calculatePasswordStrength(recNewPassword);

  const handleRecStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecWizardError(null);

    if (!strength.isAcceptable) {
      setRecWizardError("Password must meet the security requirements (at least Good strength).");
      return;
    }

    if (recNewPassword !== recConfirmPassword) {
      setRecWizardError("Passwords do not match.");
      return;
    }

    try {
      const hashed = await hashPassword(recNewPassword);

      db.setState((draft) => {
        const u = draft.users.find((item) => item.id === recUserObj.id);
        if (u) {
          u.password_hash = hashed;
          u.failed_attempts = 0;
          u.locked_until = null;
          u.must_change_password = false;
          u.updated_at = new Date().toISOString();
        }
      });

      logAudit({
        userId: recUserObj.id,
        userName: recUserObj.display_name,
        action: "UPDATE_STATUS",
        entityType: "Security",
        entityId: "PasswordRecovery",
        summary: `Password reset successfully via Security Verification for user ${recUserObj.username}`,
      });

      // Clear any active lockout state for this user
      setLockoutTarget(null);
      setLockoutRemainingSecs(0);
      setFailedCount(0);

      setRecoveryStep(4);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset password.";
      setRecWizardError(msg);
    }
  };

  const handleMustChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);

    const s = calculatePasswordStrength(newPassword);
    if (!s.isAcceptable) {
      setChangePassError("Password must meet strength requirements (at least 8 chars with mixed case, number, and symbol).");
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError("Passwords do not match.");
      return;
    }

    if (!mustChangeUser) return;

    try {
      const hashed = await hashPassword(newPassword);
      db.setState((draft) => {
        const u = draft.users.find((item) => item.id === mustChangeUser.id);
        if (u) {
          u.password_hash = hashed;
          u.must_change_password = false;
          u.updated_at = new Date().toISOString();
        }
      });

      logAudit({
        userId: mustChangeUser.id,
        userName: mustChangeUser.display_name,
        action: "UPDATE_STATUS",
        entityType: "User",
        entityId: String(mustChangeUser.id),
        summary: `Mandatory initial password change completed for user ${mustChangeUser.username}`,
      });

      setUser({
        id: mustChangeUser.id,
        name: mustChangeUser.display_name,
        role: mustChangeUser.role,
      });

      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setChangePassError(msg);
    }
  };

  const formatLockoutTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-12 transition-colors duration-200">
      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <ThemePill />
      </div>

      {/* Main Login Card */}
      <div
        className={clsx(
          "w-full max-w-sm rounded-3xl border border-slate-200/80 dark:border-slate-800/80",
          "bg-white dark:bg-[#12151d] shadow-2xl shadow-slate-200/60 dark:shadow-none p-8",
          "transition-all duration-200",
          isShaking && "shake"
        )}
      >
        {/* Brand header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <MeritBridgeLogo size={52} className="shadow-md shadow-[#9e2040]/20 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              MeritBridge
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-brand)]">
              Placement Management &amp; Analytics
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 italic">
              Connecting Talent with Opportunity.
            </p>
          </div>
        </div>

        {/* Notice banner */}
        {notice && (
          <div
            role="status"
            className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-3 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-start gap-2 animate-in fade-in"
          >
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {/* ─── LIVE COUNTDOWN LOCKOUT BOX (from SecureHash Lab) ─────────────── */}
        {lockoutRemainingSecs > 0 ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 p-6 text-center space-y-3 animate-in zoom-in-95">
            <div className="inline-flex p-3 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <Lock size={24} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                Account Temporarily Locked
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Too many failed attempts. Security freeze active.
              </p>
            </div>

            {/* Countdown digits */}
            <div className="py-2">
              <div className="font-mono text-3xl font-extrabold tracking-widest text-rose-600 dark:text-rose-400">
                {formatLockoutTimer(lockoutRemainingSecs)}
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                Time remaining before reset
              </span>
            </div>

            <button
              type="button"
              onClick={() => openRecoveryWizard(lockoutTarget || undefined)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/40 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shadow-xs"
            >
              <span>Recover Password</span>
              <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          /* Standard Sign In Form */
          <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Sign in form">
            <div className="space-y-4">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <UserIcon size={14} />
                  </span>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="Enter your username"
                    {...register("username")}
                    onBlur={(e) => checkUserLockout(e.target.value)}
                    aria-invalid={!!errors.username}
                    aria-describedby={errors.username ? "username-err" : undefined}
                    className={clsx(
                      "w-full rounded-xl border pl-9 pr-3.5 py-2.5 text-xs md:text-sm bg-slate-50/70 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100",
                      "placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200",
                      "focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]",
                      errors.username ? "border-rose-500" : "border-slate-200/80 dark:border-slate-800"
                    )}
                  />
                </div>
                {errors.username && (
                  <p id="username-err" className="mt-1 text-xs text-rose-500">
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => openRecoveryWizard()}
                    className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock size={14} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...register("password")}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-err" : undefined}
                    className={clsx(
                      "w-full rounded-xl border pl-9 pr-10 py-2.5 text-xs md:text-sm bg-slate-50/70 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100",
                      "placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all duration-200",
                      "focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]",
                      errors.password ? "border-rose-500" : "border-slate-200/80 dark:border-slate-800"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-err" className="mt-1 text-xs text-rose-500">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me Checkbox (7 days, parity with lab) */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                  />
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Remember me (7 days)
                  </span>
                </label>
              </div>
            </div>

            {/* Global Error Banner */}
            {error && (
              <div
                role="alert"
                className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-start gap-2 animate-in fade-in"
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Progressive Attempts Warning (from SecureHash Lab) */}
            {failedCount > 0 && failedCount < SECURITY_CONFIG.MAX_FAILED_ATTEMPTS && (
              <div className="mt-3 text-center">
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  ⚠️ {SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - failedCount} attempt(s) left before 15-minute lockout!
                </span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={clsx(
                "mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5",
                "bg-[var(--color-brand)] text-xs md:text-sm font-semibold text-white shadow-sm shadow-[#9e2040]/25",
                "hover:bg-[var(--color-brand-hover)] hover:shadow-md hover:shadow-[#9e2040]/30 focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2",
                "disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              )}
            >
              <LogIn size={15} aria-hidden="true" />
              {loading ? "Verifying Credentials..." : "Sign In"}
            </button>

            {/* Trouble signing in? Suggestion box when failedCount >= 3 */}
            {failedCount >= 3 && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/5 p-3 text-center space-y-1.5 animate-in fade-in">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Trouble signing in?
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  You have had multiple failed attempts.
                </p>
                <button
                  type="button"
                  onClick={() => openRecoveryWizard()}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:underline"
                >
                  <span>Recover Password</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
          </form>
        )}

        {/* Quick Recovery link */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-center">
          <button
            type="button"
            onClick={() => openRecoveryWizard()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[var(--color-brand)] dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <KeyRound size={13} />
            <span>Password Recovery &amp; Master Key</span>
          </button>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
          🛡️ Local Cryptographic Security &bull; Web Crypto Engine
        </p>
      </div>

      {/* ─── MODAL 1: ADMIN MASTER PIN VERIFICATION (from SecureHash Lab) ───── */}
      {pendingAdminUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="rounded-xl bg-amber-500/15 p-2.5 text-amber-500">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Admin Security Verification
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Two-factor Master PIN required for administrative credentials
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminPinSubmit} className="space-y-4">
              {adminPinError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                  {adminPinError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  6-Digit Master PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  placeholder="998877"
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  className="w-full text-center font-mono text-xl tracking-[0.5em] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
                <p className="mt-1 text-[10px] text-slate-400 text-center">
                  Default PIN: <code className="font-mono">998877</code> (configurable in Settings)
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPendingAdminUser(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)]"
                >
                  Verify PIN &amp; Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: 4-STEP PASSWORD RECOVERY WIZARD (from forgot.html) ─────── */}
      {showRecoveryWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowRecoveryWizard(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            {/* Stepper Indicator */}
            <div className="mb-6 flex items-center justify-center gap-2">
              {[
                { step: 1, label: "1" },
                { step: 2, label: "2" },
                { step: 3, label: "3" },
                { step: 4, label: "✓" },
              ].map((item, idx) => (
                <div key={item.step} className="flex items-center gap-2">
                  <div
                    className={clsx(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                      recoveryStep === item.step
                        ? "bg-[var(--color-brand)] text-white shadow-sm"
                        : recoveryStep > item.step
                        ? "bg-emerald-500 text-white"
                        : "border border-slate-200 dark:border-slate-800 text-slate-400"
                    )}
                  >
                    {item.label}
                  </div>
                  {idx < 3 && (
                    <div
                      className={clsx(
                        "w-8 h-0.5 transition-colors",
                        recoveryStep > item.step
                          ? "bg-emerald-500"
                          : "bg-slate-200 dark:bg-slate-800"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* STEP 1: Find Account */}
            {recoveryStep === 1 && (
              <form onSubmit={handleRecStep1} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Find Your Account
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Enter your username to begin the password recovery process.
                  </p>
                </div>

                {recWizardError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    {recWizardError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <UserIcon size={14} />
                    </span>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="e.g. admin"
                      value={recUsername}
                      onChange={(e) => setRecUsername(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRecMasterKeyMode(true);
                      setRecoveryStep(2);
                    }}
                    className="text-xs font-semibold text-[var(--color-brand)] hover:underline"
                  >
                    Use Master Recovery Key instead
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] inline-flex items-center gap-1.5"
                  >
                    <span>Continue</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Security Verification */}
            {recoveryStep === 2 && (
              <form onSubmit={handleRecStep2} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Security Verification
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {recMasterKeyMode
                      ? "Enter Master Recovery Key to bypass security questions."
                      : "Answer your configured security question to verify your identity."}
                  </p>
                </div>

                {recWizardError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    {recWizardError}
                  </div>
                )}

                {recMasterKeyMode ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Emergency Master Recovery Key
                    </label>
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder="MB-RECOVERY-KEY-SECURE-8492048"
                      value={recMasterKeyInput}
                      onChange={(e) => setRecMasterKeyInput(e.target.value)}
                      className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                    />
                  </div>
                ) : (
                  <>
                    <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                        <HelpCircle size={14} />
                        <span>Security Question</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {recUserObj?.security_question || "What was the name of your first pet?"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Your Answer
                      </label>
                      <input
                        type="text"
                        autoFocus
                        required
                        placeholder="Enter your security answer"
                        value={recAnswer}
                        onChange={(e) => setRecAnswer(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        💡 Answer is not case-sensitive. (Default demo: <code className="font-mono">fluffy</code>)
                      </p>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (recMasterKeyMode) setRecMasterKeyMode(false);
                      else setRecoveryStep(1);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <ArrowLeft size={13} />
                    <span>Back</span>
                  </button>

                  {!recMasterKeyMode && (
                    <button
                      type="button"
                      onClick={() => setRecMasterKeyMode(true)}
                      className="text-xs text-[var(--color-brand)] hover:underline font-semibold"
                    >
                      Use Recovery Key
                    </button>
                  )}

                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--color-brand)] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] inline-flex items-center gap-1.5"
                  >
                    <span>Verify Answer</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Set New Password & Live Strength Meter */}
            {recoveryStep === 3 && (
              <form onSubmit={handleRecStep3} className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Set New Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose a strong new password meeting security standards.
                  </p>
                </div>

                {recWizardError && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                    {recWizardError}
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRecNewPass ? "text" : "password"}
                      autoFocus
                      required
                      placeholder="Create a strong password"
                      value={recNewPassword}
                      onChange={(e) => setRecNewPassword(e.target.value)}
                      className="w-full pr-10 pl-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecNewPass(!showRecNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showRecNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* 5-Bar Strength Meter (from SecureHash Lab) */}
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <div
                          key={idx}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor:
                              idx <= strength.score ? strength.color : "var(--color-border)",
                          }}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <div className="text-[11px] font-bold" style={{ color: strength.color }}>
                        {strength.label}
                      </div>
                    )}
                  </div>

                  {/* Requirements checklist */}
                  <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 text-[11px] space-y-1">
                    <div className={clsx("flex items-center gap-1.5", strength.requirements.length ? "text-emerald-600 font-semibold" : "text-slate-400")}>
                      {strength.requirements.length ? <Check size={12} /> : <span>○</span>}
                      <span>At least 8 characters</span>
                    </div>
                    <div className={clsx("flex items-center gap-1.5", strength.requirements.uppercase ? "text-emerald-600 font-semibold" : "text-slate-400")}>
                      {strength.requirements.uppercase ? <Check size={12} /> : <span>○</span>}
                      <span>Uppercase letter (A-Z)</span>
                    </div>
                    <div className={clsx("flex items-center gap-1.5", strength.requirements.lowercase ? "text-emerald-600 font-semibold" : "text-slate-400")}>
                      {strength.requirements.lowercase ? <Check size={12} /> : <span>○</span>}
                      <span>Lowercase letter (a-z)</span>
                    </div>
                    <div className={clsx("flex items-center gap-1.5", strength.requirements.number ? "text-emerald-600 font-semibold" : "text-slate-400")}>
                      {strength.requirements.number ? <Check size={12} /> : <span>○</span>}
                      <span>Number (0-9)</span>
                    </div>
                    <div className={clsx("flex items-center gap-1.5", strength.requirements.special ? "text-emerald-600 font-semibold" : "text-slate-400")}>
                      {strength.requirements.special ? <Check size={12} /> : <span>○</span>}
                      <span>Special character (!@#$...)</span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRecConfirmPass ? "text" : "password"}
                      required
                      placeholder="Re-enter new password"
                      value={recConfirmPassword}
                      onChange={(e) => setRecConfirmPassword(e.target.value)}
                      className="w-full pr-10 pl-3.5 py-2 text-xs md:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecConfirmPass(!showRecConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showRecConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {recConfirmPassword && (
                    <p
                      className={clsx(
                        "mt-1 text-[11px] font-semibold",
                        recNewPassword === recConfirmPassword ? "text-emerald-600" : "text-rose-500"
                      )}
                    >
                      {recNewPassword === recConfirmPassword
                        ? "✓ Passwords match"
                        : "Passwords do not match"}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setRecoveryStep(2)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    <ArrowLeft size={13} />
                    <span>Back</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!strength.isAcceptable || recNewPassword !== recConfirmPassword}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Reset Password</span>
                    <CheckCircle2 size={14} />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Success Confirmation */}
            {recoveryStep === 4 && (
              <div className="text-center py-4 space-y-4">
                <div className="inline-flex p-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck size={36} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Password Reset!
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    Your password has been updated and your account lockout has been cleared.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryWizard(false);
                    setValue("username", recUsername);
                    setValue("password", "");
                    setNotice("Password updated successfully. Sign in with your new credentials.");
                  }}
                  className="w-full rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-all inline-flex items-center justify-center gap-2"
                >
                  <LogIn size={15} />
                  <span>Sign In Now</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 3: MANDATORY INITIAL PASSWORD CHANGE ─────────────────────── */}
      {mustChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#161922] p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Password Change Required
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Account policy requires setting a personal password on first login.
                </p>
              </div>
            </div>

            <form onSubmit={handleMustChangeSubmit} className="mt-4 space-y-4">
              {changePassError && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                  {changePassError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-xs md:text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] transition-all"
                >
                  Set New Password &amp; Continue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
