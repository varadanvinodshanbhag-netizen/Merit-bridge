import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { db } from "@/db/storage";
import { verifyPassword, SECURITY_CONFIG } from "@/services/security";
import { logAudit } from "@/services/audit";

// Clean up any legacy localStorage persistent session so fresh app launch requires login
try {
  localStorage.removeItem("mb-session");
} catch {
  // Ignore
}

export interface SessionUser {
  id: number;
  name: string;
  role: string;
}

interface AuthStore {
  user: SessionUser | null;
  isLocked: boolean;
  setUser: (u: SessionUser | null) => void;
  lockSession: () => void;
  unlockSession: (password: string) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isLocked: false,

      setUser: (user) => {
        set({ user, isLocked: false });
      },

      lockSession: () => {
        const { user } = get();
        if (user) {
          set({ isLocked: true });
          logAudit({
            userId: user.id,
            userName: user.name,
            action: "UPDATE_STATUS",
            entityType: "User",
            entityId: String(user.id),
            summary: `Session locked for user ${user.name}`,
          });
        }
      },

      unlockSession: async (password: string) => {
        const { user } = get();
        if (!user) {
          return { success: false, error: "No active session to unlock." };
        }

        const state = db.getState();
        const dbUser = state.users.find((u) => u.id === user.id);

        if (!dbUser) {
          set({ user: null, isLocked: false });
          return { success: false, error: "User account no longer exists. Please sign in again." };
        }

        if (!dbUser.is_active) {
          set({ user: null, isLocked: false });
          return { success: false, error: "Account has been deactivated. Contact administrator." };
        }

        const isMatch = await verifyPassword(password, dbUser.password_hash);
        if (isMatch) {
          db.setState((draft) => {
            const u = draft.users.find((item) => item.id === user.id);
            if (u) {
              u.failed_attempts = 0;
              u.locked_until = null;
              u.last_login_at = new Date().toISOString();
            }
          });

          set({ isLocked: false });
          logAudit({
            userId: user.id,
            userName: user.name,
            action: "UPDATE_STATUS",
            entityType: "User",
            entityId: String(user.id),
            summary: `Session unlocked successfully for user ${user.name}`,
          });

          return { success: true };
        }

        // Failed unlock attempt handling
        let accountLockedNow = false;
        db.setState((draft) => {
          const u = draft.users.find((item) => item.id === user.id);
          if (u) {
            u.failed_attempts = (u.failed_attempts || 0) + 1;
            if (u.failed_attempts >= SECURITY_CONFIG.MAX_FAILED_ATTEMPTS) {
              u.locked_until = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MS).toISOString();
              accountLockedNow = true;
            }
          }
        });

        if (accountLockedNow) {
          set({ user: null, isLocked: false });
          return {
            success: false,
            error: "Account locked out due to 5 failed attempts. Please contact admin or use Recovery Key.",
          };
        }

        const remaining = SECURITY_CONFIG.MAX_FAILED_ATTEMPTS - (dbUser.failed_attempts + 1);
        return {
          success: false,
          error: `Incorrect password. ${Math.max(0, remaining)} attempt(s) remaining before lockout.`,
        };
      },
    }),
    {
      name: "mb-session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ user: state.user, isLocked: state.isLocked }),
    }
  )
);
