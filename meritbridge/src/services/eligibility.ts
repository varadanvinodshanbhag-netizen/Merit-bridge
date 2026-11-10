// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Eligibility Evaluation Engine — Strictly matching PRD Section 6.2
// ─────────────────────────────────────────────────────────────────────────────

import {
  Student,
  CriteriaSet,
  EligibilityVerdict,
  RuleExplanation,
  EligibilityOverride,
  SemesterRecord,
  Backlog,
} from "../types";
import { calculateAggregatePercentage, getActiveBacklogCount } from "./academics";

export interface EvaluationInput {
  student: Student;
  criteriaSet: CriteriaSet;
  semesters: SemesterRecord[];
  backlogs: Backlog[];
  driveId: number;
  override?: EligibilityOverride | null;
}

export interface EvaluatedStudentResult {
  studentId: number;
  computedStatus: EligibilityVerdict;
  effectiveStatus: EligibilityVerdict;
  explanation: RuleExplanation[];
  override?: EligibilityOverride | null;
}

/**
 * Evaluates a student against a drive's criteria set according to PRD Section 6.2.
 */
export function evaluateStudentEligibility(input: EvaluationInput): EvaluatedStudentResult {
  const { student, criteriaSet, semesters, backlogs, override } = input;
  const rules = criteriaSet.rules || [];

  // If student is archived, ineligible
  if (student.archived_at) {
    return {
      studentId: student.id,
      computedStatus: "Ineligible",
      effectiveStatus: "Ineligible",
      explanation: [
        {
          rule_type: "ALLOWED_COURSES",
          passed: false,
          detail: "Student record is archived.",
        },
      ],
      override: null,
    };
  }

  // If criteria set has no rules -> Eligible (Section 6.2 #3)
  if (rules.length === 0) {
    const defaultVerdict: EligibilityVerdict = "Eligible";
    return {
      studentId: student.id,
      computedStatus: defaultVerdict,
      effectiveStatus: override ? override.override_status : defaultVerdict,
      explanation: [
        {
          rule_type: "MIN_CGPA",
          passed: true,
          detail: "No restrictions set for this drive. All students eligible.",
        },
      ],
      override,
    };
  }

  const explanations: RuleExplanation[] = [];
  let hasFail = false;
  let hasUnknown = false;

  for (const rule of rules) {
    switch (rule.rule_type) {
      case "MIN_CGPA": {
        const threshold = rule.numeric_value ?? 0;
        if (student.cgpa === undefined || student.cgpa === null || isNaN(student.cgpa)) {
          hasUnknown = true;
          explanations.push({
            rule_type: "MIN_CGPA",
            passed: "unknown",
            detail: `Minimum CGPA ${threshold.toFixed(2)}: needs review (no CGPA recorded for student)`,
          });
        } else if (student.cgpa >= threshold) {
          explanations.push({
            rule_type: "MIN_CGPA",
            passed: true,
            detail: `Minimum CGPA ${threshold.toFixed(2)}: passed (student has ${student.cgpa.toFixed(2)})`,
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "MIN_CGPA",
            passed: false,
            detail: `Minimum CGPA ${threshold.toFixed(2)}: failed (student has ${student.cgpa.toFixed(2)})`,
          });
        }
        break;
      }

      case "MIN_PERCENTAGE": {
        const threshold = rule.numeric_value ?? 0;
        const aggregate = calculateAggregatePercentage(semesters);
        if (aggregate === null) {
          hasUnknown = true;
          explanations.push({
            rule_type: "MIN_PERCENTAGE",
            passed: "unknown",
            detail: `Minimum aggregate ${threshold.toFixed(1)}%: needs review (no semester marks recorded)`,
          });
        } else if (aggregate >= threshold) {
          explanations.push({
            rule_type: "MIN_PERCENTAGE",
            passed: true,
            detail: `Minimum aggregate ${threshold.toFixed(1)}%: passed (student has ${aggregate.toFixed(1)}%)`,
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "MIN_PERCENTAGE",
            passed: false,
            detail: `Minimum aggregate ${threshold.toFixed(1)}%: failed (student has ${aggregate.toFixed(1)}%)`,
          });
        }
        break;
      }

      case "MAX_ACTIVE_BACKLOGS": {
        const maxLimit = rule.numeric_value ?? 0;
        const activeCount = getActiveBacklogCount(backlogs);
        const hasAcademicData = semesters.length > 0 || backlogs.length > 0;

        if (!hasAcademicData) {
          hasUnknown = true;
          explanations.push({
            rule_type: "MAX_ACTIVE_BACKLOGS",
            passed: "unknown",
            detail: `Maximum active backlogs ${maxLimit}: needs review (no academic/backlog data recorded)`,
          });
        } else if (activeCount <= maxLimit) {
          explanations.push({
            rule_type: "MAX_ACTIVE_BACKLOGS",
            passed: true,
            detail: `Maximum active backlogs ${maxLimit}: passed (student has ${activeCount} active backlogs)`,
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "MAX_ACTIVE_BACKLOGS",
            passed: false,
            detail: `Maximum active backlogs ${maxLimit}: failed (student has ${activeCount} active backlogs)`,
          });
        }
        break;
      }

      case "ALLOWED_COURSES": {
        const allowed = rule.item_ids || [];
        if (allowed.length === 0 || allowed.includes(student.course_id)) {
          explanations.push({
            rule_type: "ALLOWED_COURSES",
            passed: true,
            detail: "Course restriction: passed",
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "ALLOWED_COURSES",
            passed: false,
            detail: "Course restriction: failed (student course not eligible)",
          });
        }
        break;
      }

      case "ALLOWED_DEPARTMENTS": {
        const allowed = rule.item_ids || [];
        if (allowed.length === 0 || allowed.includes(student.department_id)) {
          explanations.push({
            rule_type: "ALLOWED_DEPARTMENTS",
            passed: true,
            detail: "Department restriction: passed",
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "ALLOWED_DEPARTMENTS",
            passed: false,
            detail: "Department restriction: failed (student department not eligible)",
          });
        }
        break;
      }

      case "ALLOWED_BATCHES": {
        const allowed = rule.item_ids || [];
        if (allowed.length === 0 || allowed.includes(student.batch_id)) {
          explanations.push({
            rule_type: "ALLOWED_BATCHES",
            passed: true,
            detail: "Batch restriction: passed",
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "ALLOWED_BATCHES",
            passed: false,
            detail: "Batch restriction: failed (student batch not eligible)",
          });
        }
        break;
      }

      case "ALLOWED_PASSING_YEARS": {
        const allowed = rule.numeric_value
          ? [rule.numeric_value]
          : rule.item_ids || [];
        if (allowed.length === 0 || allowed.includes(student.passing_year)) {
          explanations.push({
            rule_type: "ALLOWED_PASSING_YEARS",
            passed: true,
            detail: `Passing year ${student.passing_year}: passed`,
          });
        } else {
          hasFail = true;
          explanations.push({
            rule_type: "ALLOWED_PASSING_YEARS",
            passed: false,
            detail: `Passing year ${student.passing_year}: failed (eligible: ${allowed.join(", ")})`,
          });
        }
        break;
      }
    }
  }

  // Verdict combination (PRD Section 6.2 #3):
  // any Fail -> Ineligible
  // otherwise any Unknown -> Needs Review
  // otherwise -> Eligible
  let computedStatus: EligibilityVerdict;
  if (hasFail) {
    computedStatus = "Ineligible";
  } else if (hasUnknown) {
    computedStatus = "Needs Review";
  } else {
    computedStatus = "Eligible";
  }

  // Active override takes precedence over computed status
  const effectiveStatus = override ? override.override_status : computedStatus;

  return {
    studentId: student.id,
    computedStatus,
    effectiveStatus,
    explanation: explanations,
    override,
  };
}
