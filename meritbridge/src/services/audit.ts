// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Audit Logger — Strictly matching PRD Section 7.1 & 7.2
// Immutable, append-only audit trail for all consequential state changes.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "../db/storage";
import { AuditLog } from "../types";

export function logAudit(params: {
  userId: number;
  userName: string;
  action: string;
  entityType: string;
  entityId: number | string;
  summary: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}): void {
  db.setState((draft) => {
    const nextId = draft.audit_logs.length > 0
      ? Math.max(...draft.audit_logs.map((a) => a.id)) + 1
      : 1;

    const newLog: AuditLog = {
      id: nextId,
      occurred_at: new Date().toISOString(),
      user_id: params.userId,
      user_name_snapshot: params.userName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      summary: params.summary,
      before_json: params.before ? JSON.stringify(params.before) : undefined,
      after_json: params.after ? JSON.stringify(params.after) : undefined,
      reason: params.reason,
    };

    draft.audit_logs.unshift(newLog);
  });
}
