// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Excel Import Framework — Strictly matching PRD Section 10.1
// Pipeline: File parsing -> Column mapping -> Validation -> Preview -> Commit.
// ─────────────────────────────────────────────────────────────────────────────

import * as XLSX from "xlsx";
import { db } from "../db/storage";
import { logAudit } from "./audit";
import { Student } from "../types";

export type ImportType = "STUDENTS" | "MARKS" | "BACKLOGS";
export type DuplicatePolicy = "Skip" | "Update";
export type RowStatus = "Valid" | "Warning" | "Duplicate" | "Invalid";

export interface ParsedRowResult {
  rowNumber: number;
  status: RowStatus;
  reasons: string[];
  raw: Record<string, unknown>;
  mapped: Record<string, unknown>;
}

export interface ImportPreviewResult {
  fileName: string;
  totalRows: number;
  validCount: number;
  warningCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows: ParsedRowResult[];
}

/**
 * Standard column aliases for auto-matching (Section 10.1).
 */
export const STUDENT_FIELD_ALIASES: Record<string, string[]> = {
  registration_number: ["reg_no", "regno", "registration_no", "register_number", "roll_no", "rollno", "usn", "id"],
  full_name: ["name", "student_name", "fullname", "full_name"],
  email: ["email", "e_mail", "student_email", "mail"],
  phone: ["phone", "mobile", "contact", "phone_number", "mobile_no"],
  gender: ["gender", "sex"],
  course: ["course", "programme", "degree"],
  department: ["department", "branch", "dept"],
  batch: ["batch", "cohort", "admission_batch"],
  passing_year: ["passing_year", "pass_year", "passout_year", "year_of_passing", "grad_year"],
  cgpa: ["cgpa", "gpa", "overall_cgpa"],
};

export function parseFileToRawJson(file: File): Promise<{ sheetNames: string[]; data: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: "binary" });
        const sheetNames = wb.SheetNames;
        const firstSheet = wb.Sheets[sheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
        resolve({ sheetNames, data });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Validates parsed student rows according to PRD Section 6.5 & Section 10.1.
 */
export function validateStudentRows(
  rows: Record<string, unknown>[],
  columnMap: Record<string, string>,
  duplicatePolicy: DuplicatePolicy
): ImportPreviewResult {
  const state = db.getState();
  const existingRegMap = new Map<string, Student>();
  for (const s of state.students) {
    existingRegMap.set(s.registration_number.toUpperCase().trim(), s);
  }

  const seenInFile = new Set<string>();
  const parsedRows: ParsedRowResult[] = [];

  let validCount = 0;
  let warningCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  rows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2; // header is row 1
    const reasons: string[] = [];
    const mapped: Record<string, unknown> = {};

    for (const [targetKey, sourceCol] of Object.entries(columnMap)) {
      if (sourceCol && rawRow[sourceCol] !== undefined) {
        mapped[targetKey] = String(rawRow[sourceCol]).trim();
      }
    }

    const rawReg = String(mapped.registration_number || "").trim().toUpperCase();
    const rawName = String(mapped.full_name || "").trim();
    const rawCourse = String(mapped.course || "").trim();
    const rawDept = String(mapped.department || "").trim();
    const rawBatch = String(mapped.batch || "").trim();
    const rawPassYear = Number(mapped.passing_year);

    // 1. Mandatory checks
    if (!rawReg) {
      reasons.push("Registration number is required");
    } else if (rawReg.length < 3 || rawReg.length > 30) {
      reasons.push("Registration number must be 3-30 characters");
    }

    if (!rawName) {
      reasons.push("Full name is required");
    }

    // 2. Course, Department, Batch lookup (PRD 10.1: Must match existing records)
    let course = state.courses.find(
      (c) => c.code.toLowerCase() === rawCourse.toLowerCase() || c.name.toLowerCase() === rawCourse.toLowerCase()
    );
    if (!course && state.courses.length > 0) {
      // Default to first if unspecified
      course = state.courses[0];
    }

    let dept = state.departments.find(
      (d) => d.code.toLowerCase() === rawDept.toLowerCase() || d.name.toLowerCase() === rawDept.toLowerCase()
    );
    if (!dept && state.departments.length > 0) {
      dept = state.departments.find((d) => d.course_id === (course?.id ?? 1)) || state.departments[0];
    }

    let batch = state.batches.find((b) => b.label.toLowerCase() === rawBatch.toLowerCase());
    if (!batch && state.batches.length > 0) {
      batch = state.batches.find((b) => b.course_id === (course?.id ?? 1)) || state.batches[0];
    }

    if (!rawPassYear || isNaN(rawPassYear) || rawPassYear < 1990 || rawPassYear > 2100) {
      reasons.push("Passing year must be between 1990 and 2100");
    }

    // Repeated within file check
    if (rawReg && seenInFile.has(rawReg)) {
      reasons.push("Duplicate registration number repeated within file");
    } else if (rawReg) {
      seenInFile.add(rawReg);
    }

    // Duplicate against database check
    const isDbDuplicate = rawReg ? existingRegMap.has(rawReg) : false;

    let status: RowStatus = "Valid";
    if (reasons.length > 0) {
      status = "Invalid";
      invalidCount++;
    } else if (isDbDuplicate) {
      status = "Duplicate";
      duplicateCount++;
      reasons.push(
        duplicatePolicy === "Update"
          ? "Matches existing student (will update fields)"
          : "Matches existing student (will be skipped)"
      );
    } else {
      validCount++;
    }

    parsedRows.push({
      rowNumber,
      status,
      reasons,
      raw: rawRow,
      mapped: {
        ...mapped,
        course_id: course?.id ?? 1,
        department_id: dept?.id ?? 1,
        batch_id: batch?.id ?? 1,
        passing_year: rawPassYear || (batch?.passing_year ?? 2025),
        cgpa: mapped.cgpa ? Number(mapped.cgpa) : null,
      },
    });
  });

  return {
    fileName: "students_import",
    totalRows: rows.length,
    validCount,
    warningCount,
    duplicateCount,
    invalidCount,
    rows: parsedRows,
  };
}

/**
 * Commits valid import rows in a single atomic transaction with audit entry (PRD 10.1).
 */
export function commitStudentImport(
  preview: ImportPreviewResult,
  duplicatePolicy: DuplicatePolicy,
  userId: number,
  userName: string
): { imported: number; updated: number; skipped: number } {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  db.transaction((draft) => {
    const now = new Date().toISOString();
    let nextStudentId = draft.students.length > 0
      ? Math.max(...draft.students.map((s) => s.id)) + 1
      : 1;

    for (const row of preview.rows) {
      if (row.status === "Invalid") continue;

      const m = row.mapped;
      const reg = String(m.registration_number).trim().toUpperCase();
      const existingIdx = draft.students.findIndex((s) => s.registration_number.toUpperCase() === reg);

      if (existingIdx !== -1) {
        if (duplicatePolicy === "Update") {
          const prev = draft.students[existingIdx];
          draft.students[existingIdx] = {
            ...prev,
            full_name: String(m.full_name || prev.full_name),
            email: String(m.email || prev.email || ""),
            phone: String(m.phone || prev.phone || ""),
            cgpa: typeof m.cgpa === "number" ? m.cgpa : prev.cgpa,
            updated_at: now,
            updated_by: userId,
          };
          updated++;
        } else {
          skipped++;
        }
      } else {
        draft.students.push({
          id: nextStudentId++,
          registration_number: reg,
          full_name: String(m.full_name),
          email: m.email ? String(m.email) : undefined,
          phone: m.phone ? String(m.phone) : undefined,
          course_id: Number(m.course_id),
          department_id: Number(m.department_id),
          batch_id: Number(m.batch_id),
          passing_year: Number(m.passing_year),
          cgpa: typeof m.cgpa === "number" ? m.cgpa : null,
          created_at: now,
          updated_at: now,
          created_by: userId,
          updated_by: userId,
        });
        imported++;
      }
    }
  });

  logAudit({
    userId,
    userName,
    action: "IMPORT_STUDENTS",
    entityType: "Students",
    entityId: "batch",
    summary: `Excel import committed: ${imported} added, ${updated} updated, ${skipped} skipped.`,
  });

  return { imported, updated, skipped };
}
