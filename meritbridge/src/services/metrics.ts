// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Metrics Engine — Strictly matching PRD Section 6.1
// Authoritative single source of truth for Dashboard, Analytics and Reports.
// ─────────────────────────────────────────────────────────────────────────────

import { DatabaseState } from "../db/storage";

export interface MetricScope {
  academic_year_id?: number | null;
  course_id?: number | null;
  department_id?: number | null;
  batch_id?: number | null;
  company_id?: number | null;
  drive_id?: number | null;
  include_archived?: boolean;
}

export interface SalaryStats {
  highest_inr: number;
  highest_lpa: number;
  median_inr: number;
  median_lpa: number;
  average_inr: number;
  average_lpa: number;
  lowest_inr: number;
  lowest_lpa: number;
}

export interface FunnelStageMetric {
  name: string;
  count: number;
  conversion_from_applied: number; // percentage
  conversion_from_previous: number; // percentage
}

export interface DepartmentOutcome {
  department_id: number;
  department_name: string;
  department_code: string;
  active_students: number;
  placed_students: number;
  placement_percentage: number;
  total_offers: number;
  highest_lpa: number;
  average_lpa: number;
}

export interface MetricSummary {
  total_active_students: number;
  placed_students: number;
  placement_percentage: number;
  active_drives: number;
  total_offers: number;
  accepted_offers: number;
  joined_count: number;
  multiple_offers_count: number;
  salaries: SalaryStats;
  funnel: FunnelStageMetric[];
  department_outcomes: DepartmentOutcome[];
}

/**
 * Computes authoritative placement metrics from the database state according to Section 6.1.
 */
export function calculateMetrics(db: DatabaseState, scope: MetricScope = {}): MetricSummary {
  const {
    academic_year_id,
    course_id,
    department_id,
    batch_id,
    company_id,
    drive_id,
    include_archived = false,
  } = scope;

  // 1. Filter Students in scope
  const scopedStudents = db.students.filter((s) => {
    if (!include_archived && s.archived_at) return false;
    if (course_id && s.course_id !== course_id) return false;
    if (department_id && s.department_id !== department_id) return false;
    if (batch_id && s.batch_id !== batch_id) return false;
    return true;
  });

  const scopedStudentIds = new Set(scopedStudents.map((s) => s.id));
  const total_active_students = scopedStudents.length;

  // 2. Filter Drives in scope
  const scopedDrives = db.drives.filter((d) => {
    if (academic_year_id && d.academic_year_id !== academic_year_id) return false;
    if (company_id && d.company_id !== company_id) return false;
    if (drive_id && d.id !== drive_id) return false;
    return true;
  });

  const scopedDriveIds = new Set(scopedDrives.map((d) => d.id));

  // Count active drives (In Progress or Registration Open)
  const active_drives = scopedDrives.filter(
    (d) => d.status === "In Progress" || d.status === "Registration Open"
  ).length;

  // 3. Filter Applications in scope
  const scopedApplications = db.applications.filter((a) => {
    if (!scopedStudentIds.has(a.student_id)) return false;
    if (!scopedDriveIds.has(a.drive_id)) return false;
    return true;
  });

  const scopedAppIds = new Set(scopedApplications.map((a) => a.id));

  // 4. Filter Offers in scope
  const scopedOffers = db.offers.filter((o) => scopedAppIds.has(o.application_id));
  const total_offers = scopedOffers.length;

  // Placed students: distinct students with at least ONE "Accepted" offer (Section 6.1)
  const acceptedOffers = scopedOffers.filter((o) => o.offer_status === "Accepted");
  const accepted_offers = acceptedOffers.length;

  const placedStudentMap = new Map<number, number[]>(); // studentId -> accepted salaries
  for (const offer of acceptedOffers) {
    const app = db.applications.find((a) => a.id === offer.application_id);
    if (app) {
      const current = placedStudentMap.get(app.student_id) || [];
      current.push(offer.annual_salary);
      placedStudentMap.set(app.student_id, current);
    }
  }

  const placed_students = placedStudentMap.size;
  const placement_percentage =
    total_active_students > 0
      ? Number(((placed_students / total_active_students) * 100).toFixed(1))
      : 0;

  // Students with multiple accepted offers
  let multiple_offers_count = 0;
  for (const salaries of placedStudentMap.values()) {
    if (salaries.length >= 2) {
      multiple_offers_count++;
    }
  }

  // Joined offers
  const joined_count = scopedOffers.filter((o) => o.joining_status === "Joined").length;

  // 5. Salary statistics (highest accepted offer per placed student per Section 6.1)
  const studentHighestPackages: number[] = [];
  for (const salaries of placedStudentMap.values()) {
    if (salaries.length > 0) {
      studentHighestPackages.push(Math.max(...salaries));
    }
  }

  studentHighestPackages.sort((a, b) => a - b);

  let highest_inr = 0;
  let lowest_inr = 0;
  let average_inr = 0;
  let median_inr = 0;

  if (studentHighestPackages.length > 0) {
    highest_inr = studentHighestPackages[studentHighestPackages.length - 1];
    lowest_inr = studentHighestPackages[0];
    const sum = studentHighestPackages.reduce((acc, v) => acc + v, 0);
    average_inr = Math.round(sum / studentHighestPackages.length);

    const mid = Math.floor(studentHighestPackages.length / 2);
    median_inr =
      studentHighestPackages.length % 2 !== 0
        ? studentHighestPackages[mid]
        : Math.round((studentHighestPackages[mid - 1] + studentHighestPackages[mid]) / 2);
  }

  const salaries: SalaryStats = {
    highest_inr,
    highest_lpa: Number((highest_inr / 100000).toFixed(2)),
    lowest_inr,
    lowest_lpa: Number((lowest_inr / 100000).toFixed(2)),
    average_inr,
    average_lpa: Number((average_inr / 100000).toFixed(2)),
    median_inr,
    median_lpa: Number((median_inr / 100000).toFixed(2)),
  };

  // 6. Recruitment Funnel (Section 6.1: Applied -> Selected -> Offered -> Accepted -> Joined)
  const appliedCount = scopedApplications.length;
  const selectedCount = scopedApplications.filter((a) => a.final_outcome === "Selected").length;
  const offeredCount = scopedOffers.length;
  const acceptedCount = accepted_offers;
  const joinedCount = joined_count;

  const funnel: FunnelStageMetric[] = [
    {
      name: "Applied",
      count: appliedCount,
      conversion_from_applied: 100,
      conversion_from_previous: 100,
    },
    {
      name: "Selected",
      count: selectedCount,
      conversion_from_applied: appliedCount > 0 ? Number(((selectedCount / appliedCount) * 100).toFixed(1)) : 0,
      conversion_from_previous: appliedCount > 0 ? Number(((selectedCount / appliedCount) * 100).toFixed(1)) : 0,
    },
    {
      name: "Offered",
      count: offeredCount,
      conversion_from_applied: appliedCount > 0 ? Number(((offeredCount / appliedCount) * 100).toFixed(1)) : 0,
      conversion_from_previous: selectedCount > 0 ? Number(((offeredCount / selectedCount) * 100).toFixed(1)) : 0,
    },
    {
      name: "Accepted",
      count: acceptedCount,
      conversion_from_applied: appliedCount > 0 ? Number(((acceptedCount / appliedCount) * 100).toFixed(1)) : 0,
      conversion_from_previous: offeredCount > 0 ? Number(((acceptedCount / offeredCount) * 100).toFixed(1)) : 0,
    },
    {
      name: "Joined",
      count: joinedCount,
      conversion_from_applied: appliedCount > 0 ? Number(((joinedCount / appliedCount) * 100).toFixed(1)) : 0,
      conversion_from_previous: acceptedCount > 0 ? Number(((joinedCount / acceptedCount) * 100).toFixed(1)) : 0,
    },
  ];

  // 7. Department breakdown
  const department_outcomes: DepartmentOutcome[] = db.departments.map((dept) => {
    const deptStudents = scopedStudents.filter((s) => s.department_id === dept.id);
    const deptStudentIds = new Set(deptStudents.map((s) => s.id));

    let deptPlacedCount = 0;
    const deptSalaries: number[] = [];
    let deptTotalOffers = 0;

    for (const [studentId, salaryList] of placedStudentMap.entries()) {
      if (deptStudentIds.has(studentId)) {
        deptPlacedCount++;
        deptSalaries.push(Math.max(...salaryList));
      }
    }

    for (const offer of scopedOffers) {
      const app = db.applications.find((a) => a.id === offer.application_id);
      if (app && deptStudentIds.has(app.student_id)) {
        deptTotalOffers++;
      }
    }

    const deptHighest = deptSalaries.length > 0 ? Math.max(...deptSalaries) : 0;
    const deptAvg =
      deptSalaries.length > 0
        ? Math.round(deptSalaries.reduce((a, b) => a + b, 0) / deptSalaries.length)
        : 0;

    return {
      department_id: dept.id,
      department_name: dept.name,
      department_code: dept.code,
      active_students: deptStudents.length,
      placed_students: deptPlacedCount,
      placement_percentage:
        deptStudents.length > 0
          ? Number(((deptPlacedCount / deptStudents.length) * 100).toFixed(1))
          : 0,
      total_offers: deptTotalOffers,
      highest_lpa: Number((deptHighest / 100000).toFixed(2)),
      average_lpa: Number((deptAvg / 100000).toFixed(2)),
    };
  });

  return {
    total_active_students,
    placed_students,
    placement_percentage,
    active_drives,
    total_offers,
    accepted_offers,
    joined_count,
    multiple_offers_count,
    salaries,
    funnel,
    department_outcomes,
  };
}
