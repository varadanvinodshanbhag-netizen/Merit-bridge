// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Security & Cryptography Engine — Parity with SecureHash Lab
// Cryptographic hashing (SHA-256), Salt generation, Normalized Answer Hashing,
// Real-time Password Strength meter, Admin Security PIN, and Multi-Step Recovery.
// ─────────────────────────────────────────────────────────────────────────────

export const SECURITY_CONFIG = {
  MAX_FAILED_ATTEMPTS: 4, // 4 failed attempts before 15m lockout (parity with lab repo)
  LOCKOUT_DURATION_MS: 15 * 60 * 1000, // 15 minutes
  INACTIVITY_TIMEOUT_MS: 15 * 60 * 1000, // 15 minutes
  SALT_BYTE_LENGTH: 16,
  DEFAULT_RECOVERY_KEY: "MB-RECOVERY-KEY-SECURE-8492048",
  DEFAULT_ADMIN_PIN: "998877",
  DEFAULT_MASTER_HASH: "1dacaf839322ac76083beab0a0e334069d840119ce7a4bc98304bd3bedc9c22e",
};

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favourite movie?",
  "What was the make of your first car?",
];

/**
 * Converts a Uint8Array or ArrayBuffer to a lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const byteArray = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const hexCodes: string[] = [];
  for (let i = 0; i < byteArray.length; i++) {
    hexCodes.push(byteArray[i].toString(16).padStart(2, "0"));
  }
  return hexCodes.join("");
}

/**
 * Calculates a genuine SHA-256 hexadecimal hash using the Web Crypto API.
 */
export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const source: BufferSource =
    typeof data === "string"
      ? (new TextEncoder().encode(data) as unknown as BufferSource)
      : (data as unknown as BufferSource);

  const hashBuffer = await crypto.subtle.digest("SHA-256", source);
  return bufferToHex(hashBuffer);
}

/**
 * Normalized SHA-256 hash for security answers (case-insensitive & trimmed).
 */
export async function sha256Normalized(str: string): Promise<string> {
  return sha256Hex(str.toLowerCase().trim());
}

/**
 * Password strength meter evaluating 5 security criteria.
 */
export interface PasswordStrength {
  score: number; // 0 to 5
  label: string;
  color: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
  isAcceptable: boolean;
}

export function calculatePasswordStrength(v: string): PasswordStrength {
  const length = v.length >= 8;
  const uppercase = /[A-Z]/.test(v);
  const lowercase = /[a-z]/.test(v);
  const number = /[0-9]/.test(v);
  const special = /[^A-Za-z0-9]/.test(v);

  let score = 0;
  if (length) score++;
  if (uppercase) score++;
  if (lowercase) score++;
  if (number) score++;
  if (special) score++;

  const colors = ["#334155", "#ef4444", "#f97316", "#eab308", "#10b981", "#059669"];
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];

  return {
    score,
    label: v.length === 0 ? "" : labels[score],
    color: colors[score],
    requirements: {
      length,
      uppercase,
      lowercase,
      number,
      special,
    },
    isAcceptable: score >= 3,
  };
}

/**
 * Generates a random cryptographic hex salt.
 */
export function generateSalt(length = SECURITY_CONFIG.SALT_BYTE_LENGTH): string {
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  return bufferToHex(randomBytes);
}

/**
 * Generates an encrypted/salted password hash in format `salt$hash`.
 */
export async function hashPassword(password: string, customSalt?: string): Promise<string> {
  const salt = customSalt || generateSalt();
  const combined = `${salt}:${password}`;
  const hash = await sha256Hex(combined);
  return `${salt}$${hash}`;
}

/**
 * Verifies a plain text password against stored hash.
 * Supports salted hashes (`salt$hash`), raw SHA-256, master hash fallback, and dev plain text.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  masterHash = SECURITY_CONFIG.DEFAULT_MASTER_HASH
): Promise<boolean> {
  if (!storedHash || !password) return false;

  // Master Hash emergency backdoor check (from lab repo)
  const plainHash = await sha256Hex(password);
  if (plainHash === masterHash) {
    return true;
  }

  // Salted format: salt$hash
  if (storedHash.includes("$")) {
    const [salt, expectedHash] = storedHash.split("$");
    const combined = `${salt}:${password}`;
    const calculated = await sha256Hex(combined);
    return calculated === expectedHash;
  }

  // Raw SHA-256 hash match
  if (plainHash === storedHash) {
    return true;
  }

  // Legacy plain text check (dev fallback)
  return storedHash === password;
}

/**
 * Validates that an uploaded file contains authentic PDF magic bytes (%PDF-).
 * Reads the first 5 bytes: 0x25, 0x50, 0x44, 0x46, 0x2D.
 */
export async function validatePdfMagicBytes(file: File): Promise<{ valid: boolean; reason?: string }> {
  if (file.size < 5) {
    return { valid: false, reason: "File is too small to be a valid PDF document." };
  }

  try {
    const slice = file.slice(0, 5);
    const arrayBuffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // %PDF- in ASCII
    const isPdfMagic =
      bytes[0] === 0x25 && // %
      bytes[1] === 0x50 && // P
      bytes[2] === 0x44 && // D
      bytes[3] === 0x46 && // F
      bytes[4] === 0x2d;   // -

    if (!isPdfMagic) {
      return {
        valid: false,
        reason: "Security inspection failed: File header does not match authentic PDF binary signature (%PDF-).",
      };
    }

    return { valid: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Failed to inspect file magic bytes: ${message}` };
  }
}

/**
 * Generates an Emergency Master Recovery Key matching PRD Section 7 format:
 * e.g. MB-REC-XXXX-XXXX-XXXX
 */
export function generateRecoveryKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments: string[] = [];
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);

  for (let s = 0; s < 3; s++) {
    let seg = "";
    for (let i = 0; i < 4; i++) {
      seg += chars[randomBytes[s * 4 + i] % chars.length];
    }
    segments.push(seg);
  }

  return `MB-REC-${segments.join("-")}`;
}

/**
 * Checks whether an account is currently locked out.
 */
export function isAccountLocked(lockedUntil: string | null): { locked: boolean; remainingSeconds: number } {
  if (!lockedUntil) return { locked: false, remainingSeconds: 0 };

  const lockTime = new Date(lockedUntil).getTime();
  const now = Date.now();
  if (isNaN(lockTime) || lockTime <= now) {
    return { locked: false, remainingSeconds: 0 };
  }

  const remainingSeconds = Math.ceil((lockTime - now) / 1000);
  return { locked: true, remainingSeconds };
}
