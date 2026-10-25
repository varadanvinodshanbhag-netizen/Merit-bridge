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
  Plus,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import MeritBridgeLogo from "@/components/brand/MeritBridgeLogo";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { db } from "@/db/storage";
import { Role } from "@/types";
import {
  verifyPassword,
  hashPassword,
  sha256Normalized,
  calculatePasswordStrength,
  isAccountLocked,
  SECURITY_CONFIG,
  SECURITY_QUESTIONS,
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

  // Active view: "signin" or "register" (matching SecureHash Lab)
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");

  // Sign In State
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

  // Registration State (parity with register.html from password-hashing-benchmark)
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regRole, setRegRole] = useState<Role>("Placement Officer");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regSecurityQuestion, setRegSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [regSecurityAnswer, setRegSecurityAnswer] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

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

  // ─── Sign In Submission ───────────────────────────────────────────────────
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
      summary: `User ${user.display_name} (${user.username}) authenticated successfully`,
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

    const resolvedDisplayName =
      user.display_name && user.display_name !== "S. Kumar"
        ? user.display_name
        : (user.username === "admin" ? "Placement Administrator" : (user.display_name || "Placement Officer"));

    setUser({
      id: user.id,
      username: user.username,
      name: resolvedDisplayName,
      role: user.role,
    });

    navigate("/dashboard", { replace: true });
  };

  // ─── Registration Submission (parity with register.html) ───────────────────
  const regStrength = calculatePasswordStrength(regPassword);
  const isUsernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(regUsername.trim());
  const isUsernameTaken =
    isUsernameValid &&
    db.getState().users.some(
      (u) => u.username.toLowerCase() === regUsername.trim().toLowerCase()
    );

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regFullName.trim()) {
      setRegError("Please enter your full name.");
      triggerShake();
      return;
    }

    const uname = regUsername.trim().toLowerCase();
    if (!isUsernameValid) {
      setRegError("Username must be 3-20 characters (letters, numbers, underscore only).");
      triggerShake();
      return;
    }

    if (isUsernameTaken) {
      setRegError("Username is already taken. Please choose another.");
      triggerShake();
      return;
    }

    if (!regStrength.isAcceptable) {
      setRegError("Password must meet strength requirements (at least Good).");
      triggerShake();
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError("Passwords do not match.");
      triggerShake();
      return;
    }

    if (!regSecurityAnswer.trim()) {
      setRegError("Please provide an answer to your security question.");
      triggerShake();
      return;
    }

    setRegLoading(true);
    try {
      const passHash = await hashPassword(regPassword);
      const ansHash = await sha256Normalized(regSecurityAnswer);

      const newUserObj = {
        id: Date.now(),
        username: uname,
        display_name: regFullName.trim(),
        role: regRole,
        password_hash: passHash,
        must_change_password: false,
        is_active: true,
        failed_attempts: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        security_question: regSecurityQuestion,
        security_answer_hash: ansHash,
      };

      db.setState((draft) => {
        draft.users.push(newUserObj);
      });

      logAudit({
        userId: newUserObj.id,
        userName: newUserObj.display_name,
        action: "CREATE_ACCOUNT",
        entityType: "User",
        entityId: String(newUserObj.id),
        summary: `Self-registered new account '${newUserObj.username}' (${newUserObj.display_name}) with role ${newUserObj.role}`,
      });

      // Reset registration form
      setRegFullName("");
      setRegUsername("");
      setRegPassword("");
      setRegConfirmPassword("");
      setRegSecurityAnswer("");

      // Switch to Sign In mode with prefilled username and success banner
      setValue("username", uname);
      setValue("password", "");
      setNotice(`✅ Account created successfully for ${newUserObj.display_name}! You can now sign in.`);
      setAuthMode("signin");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed.";
      setRegError(msg);
      triggerShake();
    } finally {
      setRegLoading(false);
    }
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
      const u = state.users.find(
        (item) => item.username.toLowerCase() === defaultName.trim().toLowerCase()
      );
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
      const state = db.getState();
      const validKey =
        state.app_security.recovery_key_hash || SECURITY_CONFIG.DEFAULT_RECOVERY_KEY;
      if (recMasterKeyInput.trim() !== validKey) {
        setRecWizardError("Invalid Master Recovery Key.");
        return;
      }
      setRecoveryStep(3);
      return;
    }

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
    const validAnswerHash =
      user.security_answer_hash ||
      "d79cf02bc36b13e9a5840ca8d6f5f92ff481b3ee60215a77028f090710ecf79d"; // default sha256('fluffy')

    if (enteredHash !== validAnswerHash) {
      setRecWizardError("Incorrect security answer. Please try again.");
      return;
    }

    setRecoveryStep(3);
  };

  const recStrength = calculatePasswordStrength(recNewPassword);

  const handleRecStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecWizardError(null);

    if (!recStrength.isAcceptable) {
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
        summary: `Password reset successfully via Security Verification for user ${recUserObj.display_name} (${recUserObj.username})`,
      });

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
      setChangePassError(
        "Password must meet strength requirements (at least 8 chars with mixed case, number, and symbol)."
      );
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

      const resolvedDisplayName =
        mustChangeUser.display_name && mustChangeUser.display_name !== "S. Kumar"
          ? mustChangeUser.display_name
          : (mustChangeUser.username === "admin" ? "Placement Administrator" : (mustChangeUser.display_name || "Placement Officer"));

      setUser({
        id: mustChangeUser.id,
        username: mustChangeUser.username,
        name: resolvedDisplayName,
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-10 transition-colors duration-200">
      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <ThemePill />
      </div>

      {/* Main Authentication Card */}
      <div
        className={clsx(
          "w-full rounded-3xl border border-slate-200/80 dark:border-slate-800/80",
          "bg-white dark:bg-[#12151d] shadow-2xl shadow-slate-200/60 dark:shadow-none p-7 sm:p-8",
          "transition-all duration-200",
          authMode === "register" ? "max-w-md" : "max-w-sm",
          isShaking && "shake"
        )}
      >
        {/* Brand header */}
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center">
          <MeritBridgeLogo size={50} className="shadow-md shadow-[#9e2040]/20 rounded-xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              MeritBridge
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-brand)]">
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

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW A: SIGN IN FORM
        ══════════════════════════════════════════════════════════════════════ */}
        {authMode === "signin" && (
          <>
            <div className="mb-4 text-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Welcome back
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in to access the placement terminal
              </p>
            </div>

            {/* LIVE COUNTDOWN LOCKOUT BOX */}
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

                  {/* Remember Me Checkbox */}
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

                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-start gap-2 animate-in fade-in"
                  >
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Progressive Attempts Warning */}
                {failedCount > 0 && failedCount < SECURITY_CONFIG.MAX_FAILED_ATTEMPTS && (
                  <div className="mt-3 text-center">
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      ⚠️ {SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - failedCount} attempt(s) left before 15-minute lockout!
                    </span>
                  </div>
                )}

                {/* Sign In Submit */}
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

                {/* Trouble signing in suggestion box */}
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

            {/* Quick Demo Helper */}
            <div className="mt-4 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-xs">
              <div className="leading-tight">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Default Demo Credentials</p>
                <p className="text-[10px] text-slate-400 font-mono">admin / admin &bull; PIN: 998877</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setValue("username", "admin");
                  setValue("password", "admin");
                }}
                className="px-2.5 py-1 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] dark:bg-[var(--color-brand)]/20 font-semibold text-[11px] hover:bg-[var(--color-brand)] hover:text-white transition-colors"
              >
                Quick Fill
              </button>
            </div>

            {/* Divider: New to MeritBridge? */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white dark:bg-[#12151d] px-3 text-slate-400 font-medium">
                  New to MeritBridge?
                </span>
              </div>
            </div>

            {/* CREATE AN ACCOUNT BUTTON (Matching SecureHash Lab) */}
            <button
              type="button"
              onClick={() => {
                setRegError(null);
                setNotice(null);
                setAuthMode("register");
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] dark:hover:border-[var(--color-brand)] dark:hover:text-[var(--color-brand)] transition-all shadow-xs"
            >
              <Plus size={14} />
              <span>Create an Account</span>
            </button>

            {/* Quick Recovery link */}
            <div className="mt-4 pt-2 text-center">
              <button
                type="button"
                onClick={() => openRecoveryWizard()}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[var(--color-brand)] dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                <KeyRound size={13} />
                <span>Emergency Master Recovery</span>
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            VIEW B: CREATE ACCOUNT FORM (Parity with register.html)
        ══════════════════════════════════════════════════════════════════════ */}
        {authMode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div className="mb-2 text-center">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center gap-1.5">
                <Plus size={18} className="text-[var(--color-brand)]" />
                <span>Create Account</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Set up your placement cell staff credentials
              </p>
            </div>

            {regError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2.5 text-xs font-medium text-rose-700 dark:text-rose-400 flex items-start gap-2"
              >
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {/* Full Name / Display Name */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name (Display Name)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserIcon size={14} />
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Dr. Rajesh Kumar"
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-3.5 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserIcon size={14} />
                </span>
                <input
                  type="text"
                  required
                  placeholder="3-20 chars, letters, numbers, _"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className={clsx(
                    "w-full rounded-xl border pl-9 pr-3.5 py-2 text-xs md:text-sm bg-slate-50/70 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]",
                    isUsernameTaken
                      ? "border-rose-500"
                      : isUsernameValid
                      ? "border-emerald-500"
                      : "border-slate-200 dark:border-slate-800"
                  )}
                />
              </div>
              {regUsername && (
                <p
                  className={clsx(
                    "mt-1 text-[10px] font-semibold",
                    isUsernameTaken
                      ? "text-rose-500"
                      : isUsernameValid
                      ? "text-emerald-600"
                      : "text-slate-400"
                  )}
                >
                  {isUsernameTaken
                    ? "Username already taken"
                    : isUsernameValid
                    ? "✓ Username available"
                    : "3-20 characters, alphanumeric and underscore only"}
                </p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Role
              </label>
              <select
                value={regRole}
                onChange={(e) => setRegRole(e.target.value as Role)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
              >
                <option value="Placement Officer">Placement Officer</option>
                <option value="Assistant">Assistant</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* Password with Strength Meter */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={14} />
                </span>
                <input
                  type={showRegPassword ? "text" : "password"}
                  required
                  placeholder="Create a strong password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-10 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* 5-Bar Strength Meter */}
              <div className="mt-1.5 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor:
                          idx <= regStrength.score ? regStrength.color : "var(--color-border)",
                      }}
                    />
                  ))}
                </div>
                {regStrength.label && (
                  <div className="text-[10px] font-bold" style={{ color: regStrength.color }}>
                    Strength: {regStrength.label}
                  </div>
                )}
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confirm Password
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <KeyRound size={14} />
                </span>
                <input
                  type={showRegConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 pl-9 pr-10 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showRegConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {regConfirmPassword && (
                <p
                  className={clsx(
                    "mt-1 text-[10px] font-semibold",
                    regPassword === regConfirmPassword ? "text-emerald-600" : "text-rose-500"
                  )}
                >
                  {regPassword === regConfirmPassword
                    ? "✓ Passwords match"
                    : "Passwords do not match"}
                </p>
              )}
            </div>

            {/* Security Question */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Security Question
              </label>
              <select
                value={regSecurityQuestion}
                onChange={(e) => setRegSecurityQuestion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-3 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
              >
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            {/* Security Answer */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Security Answer
              </label>
              <input
                type="text"
                required
                placeholder="Your answer (case-insensitive)"
                value={regSecurityAnswer}
                onChange={(e) => setRegSecurityAnswer(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-3.5 py-2 text-xs md:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)]"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                💡 Used to verify your identity and recover your password if forgotten.
              </p>
            </div>

            {/* Submit Create Account */}
            <button
              type="submit"
              disabled={regLoading}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] py-2.5 px-4 text-xs md:text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-hover)] disabled:opacity-50 transition-all"
            >
              <Plus size={15} />
              <span>{regLoading ? "Creating Account..." : "Create Account"}</span>
            </button>

            {/* Back to Sign In */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white dark:bg-[#12151d] px-3 text-slate-400 font-medium">
                  Already have an account?
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRegError(null);
                setAuthMode("signin");
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] dark:hover:border-[var(--color-brand)] dark:hover:text-[var(--color-brand)] transition-all shadow-xs"
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="mt-5 text-center text-[11px] text-slate-400 dark:text-slate-500">
          🛡️ All data stored locally in your browser &bull; No external server required
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
                  Two-factor Master PIN required for {pendingAdminUser.display_name}
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
                        <span>Security Question for {recUserObj?.display_name || recUserObj?.username}</span>
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
                    Resetting password for {recUserObj?.display_name} ({recUserObj?.username})
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

                  {/* 5-Bar Strength Meter */}
                  <div className="mt-2 space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((idx) => (
                        <div
                          key={idx}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor:
                              idx <= recStrength.score ? recStrength.color : "var(--color-border)",
                          }}
                        />
                      ))}
                    </div>
                    {recStrength.label && (
                      <div className="text-[11px] font-bold" style={{ color: recStrength.color }}>
                        Strength: {recStrength.label}
                      </div>
                    )}
                  </div>

                  {/* Requirements checklist */}
                  <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 text-[11px] space-y-1">
                    <div
                      className={clsx(
                        "flex items-center gap-1.5",
                        recStrength.requirements.length
                          ? "text-emerald-600 font-semibold"
                          : "text-slate-400"
                      )}
                    >
                      {recStrength.requirements.length ? <Check size={12} /> : <span>○</span>}
                      <span>At least 8 characters</span>
                    </div>
                    <div
                      className={clsx(
                        "flex items-center gap-1.5",
                        recStrength.requirements.uppercase
                          ? "text-emerald-600 font-semibold"
                          : "text-slate-400"
                      )}
                    >
                      {recStrength.requirements.uppercase ? <Check size={12} /> : <span>○</span>}
                      <span>Uppercase letter (A-Z)</span>
                    </div>
                    <div
                      className={clsx(
                        "flex items-center gap-1.5",
                        recStrength.requirements.lowercase
                          ? "text-emerald-600 font-semibold"
                          : "text-slate-400"
                      )}
                    >
                      {recStrength.requirements.lowercase ? <Check size={12} /> : <span>○</span>}
                      <span>Lowercase letter (a-z)</span>
                    </div>
                    <div
                      className={clsx(
                        "flex items-center gap-1.5",
                        recStrength.requirements.number
                          ? "text-emerald-600 font-semibold"
                          : "text-slate-400"
                      )}
                    >
                      {recStrength.requirements.number ? <Check size={12} /> : <span>○</span>}
                      <span>Number (0-9)</span>
                    </div>
                    <div
                      className={clsx(
                        "flex items-center gap-1.5",
                        recStrength.requirements.special
                          ? "text-emerald-600 font-semibold"
                          : "text-slate-400"
                      )}
                    >
                      {recStrength.requirements.special ? <Check size={12} /> : <span>○</span>}
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
                        recNewPassword === recConfirmPassword
                          ? "text-emerald-600"
                          : "text-rose-500"
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
                    disabled={!recStrength.isAcceptable || recNewPassword !== recConfirmPassword}
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
                    Your password has been updated and your account lockout has been cleared for{" "}
                    <strong>{recUserObj?.display_name || recUsername}</strong>.
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
                  Account policy requires setting a personal password on first login for{" "}
                  <strong>{mustChangeUser.display_name}</strong>.
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
