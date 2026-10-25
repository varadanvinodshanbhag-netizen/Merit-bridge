// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Academic Calculations — Strictly matching PRD Section 6.3
// ─────────────────────────────────────────────────────────────────────────────

import { SemesterRecord, SubjectMark, Backlog, Course } from "../types";

/**
 * Semester percentage = (sum marks obtained / sum maximum marks) * 100 for that semester.
 * PRD Rule: Missing/unavailable marks must NOT be treated as zero.
 * Returns null if no graded subjects exist.
 */
export function calculateSemesterPercentage(subjects: SubjectMark[]): number | null {
  if (!subjects || subjects.length === 0) return null;
  const graded = subjects.filter(
    (s) => s.marks_obtained !== null && s.marks_obtained !== undefined && (s.max_marks || 0) > 0
  );
  if (graded.length === 0) return null;
  const totalMax = graded.reduce((sum, s) => sum + s.max_marks, 0);
  const totalObtained = graded.reduce((sum, s) => sum + (s.marks_obtained || 0), 0);
  return Number(((totalObtained / totalMax) * 100).toFixed(2));
}

/**
 * Aggregate percentage = (sum obtained / sum maximum) across all recorded semesters.
 * PRD Rule: Missing/unavailable marks must NOT be treated as zero.
 * Returns null if no graded semester subjects exist.
 */
export function calculateAggregatePercentage(semesters: SemesterRecord[]): number | null {
  if (!semesters || semesters.length === 0) return null;
  let totalObtained = 0;
  let totalMax = 0;

  for (const sem of semesters) {
    if (sem.subjects && sem.subjects.length > 0) {
      for (const s of sem.subjects) {
        if (s.marks_obtained !== null && s.marks_obtained !== undefined && (s.max_marks || 0) > 0) {
          totalObtained += s.marks_obtained;
          totalMax += s.max_marks;
        }
      }
    }
  }

  if (totalMax <= 0) return null;
  return Number(((totalObtained / totalMax) * 100).toFixed(2));
}

/**
 * Computes CGPA based on course configuration (Section 6.3):
 * - If course is MeanOfSgpa: arithmetic mean of entered SGPAs.
 * - If Manual: returns existing student CGPA without modification.
 */
export function calculateCgpa(
  course: Course | undefined,
  semesters: SemesterRecord[],
  currentCgpa?: number | null
): number | null {
  if (!course || course.cgpa_method === "Manual") {
    return currentCgpa ?? null;
  }

  // MeanOfSgpa method
  const validSgpas = semesters
    .map((s) => s.sgpa)
    .filter((v): v is number => typeof v === "number" && !isNaN(v) && v > 0);

  if (validSgpas.length === 0) {
    return currentCgpa ?? null;
  }

  const sum = validSgpas.reduce((acc, v) => acc + v, 0);
  return Number((sum / validSgpas.length).toFixed(2));
}

/**
 * Returns active backlog count from backlog records (Section 6.4 / ACA-05).
 */
export function getActiveBacklogCount(backlogs: Backlog[]): number {
  return backlogs.filter((b) => b.status === "Active").length;
}
