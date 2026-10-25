// ─────────────────────────────────────────────────────────────────────────────
// MeritBridge Rich Sample Data Generator
// Produces 40+ students with complete academic histories, 10 companies,
// 6 placement drives, stage evaluations, offers, and audit trails.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Student,
  SemesterRecord,
  Backlog,
  Company,
  CriteriaSet,
  Drive,
  Application,
  Offer,
  AuditLog,
} from "../types";
import type { DatabaseState } from "../db/storage";

export function getRichSampleData(): DatabaseState {
  const now = new Date().toISOString();

  const academic_years = [
    { id: 1, label: "2023-2024", start_date: "2023-06-01", end_date: "2024-05-31" },
    { id: 2, label: "2024-2025", start_date: "2024-06-01", end_date: "2025-05-31" },
    { id: 3, label: "2025-2026", start_date: "2025-06-01", end_date: "2026-05-31" },
  ];

  const courses = [
    {
      id: 1,
      name: "Bachelor of Technology",
      code: "B.Tech",
      duration_semesters: 8,
      cgpa_method: "MeanOfSgpa" as const,
      grade_scale_max: 10,
    },
    {
      id: 2,
      name: "Master of Computer Applications",
      code: "MCA",
      duration_semesters: 4,
      cgpa_method: "MeanOfSgpa" as const,
      grade_scale_max: 10,
    },
  ];

  const departments = [
    { id: 1, course_id: 1, name: "Computer Science & Engineering", code: "CSE" },
    { id: 2, course_id: 1, name: "Electronics & Communication", code: "ECE" },
    { id: 3, course_id: 1, name: "Mechanical Engineering", code: "ME" },
    { id: 4, course_id: 1, name: "Information Technology", code: "IT" },
    { id: 5, course_id: 2, name: "Computer Applications", code: "CA" },
  ];

  const batches = [
    { id: 1, course_id: 1, label: "2021-2025", admission_year: 2021, passing_year: 2025 },
    { id: 2, course_id: 1, label: "2022-2026", admission_year: 2022, passing_year: 2026 },
    { id: 3, course_id: 2, label: "2023-2025", admission_year: 2023, passing_year: 2025 },
  ];

  const users = [
    {
      id: 1,
      username: "admin",
      display_name: "Placement Administrator",
      role: "Placement Officer" as const,
      password_hash: "admin",
      must_change_password: false,
      is_active: true,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      username: "po.anita",
      display_name: "Dr. Anita Sharma",
      role: "Placement Officer" as const,
      password_hash: "admin",
      must_change_password: false,
      is_active: true,
      failed_attempts: 0,
      locked_until: null,
      last_login_at: now,
      created_at: now,
      updated_at: now,
    },
  ];

  const institution = {
    name: "Apex Institute of Technology",
    address: "Campus Park, Knowledge City, Bangalore 560001",
    contact_details: "placement@apexinstitute.edu | +91 80 2345 6789",
    current_academic_year_id: 2,
  };

  const app_security = {
    recovery_key_hash: "MB-RECOVERY-KEY-SECURE-8492048",
    recovery_rotated_at: now,
  };

  const settings = {
    theme: "light" as const,
    table_density: "Comfortable" as const,
    default_landing: "/dashboard",
    date_format: "DD/MM/YYYY" as const,
    default_export_folder: "MeritBridge Exports",
    default_report_format: "PDF" as const,
    backup_schedule: "Daily" as const,
    backup_location: "Local Backups",
    backups_to_keep: 10,
  };

  // ─── 40 Diverse Students ──────────────────────────────────────────────────
  const rawStudentData = [
    { name: "Aarav Reddy", gender: "Male", deptId: 1, batchId: 1, passYear: 2025, cgpa: 9.15, reg: "21CSE001" },
    { name: "Priya Kapoor", gender: "Female", deptId: 2, batchId: 1, passYear: 2025, cgpa: 9.35, reg: "21ECE014" },
    { name: "Mohammed Saif", gender: "Male", deptId: 3, batchId: 1, passYear: 2025, cgpa: 7.82, reg: "21ME045" },
    { name: "Sneha Nair", gender: "Female", deptId: 1, batchId: 1, passYear: 2025, cgpa: 8.65, reg: "21CSE089" },
    { name: "Rahul Verma", gender: "Male", deptId: 4, batchId: 1, passYear: 2025, cgpa: 8.25, reg: "21IT023" },
    { name: "Ananya Iyer", gender: "Female", deptId: 1, batchId: 1, passYear: 2025, cgpa: 9.72, reg: "21CSE012" },
    { name: "Vikram Malhotra", gender: "Male", deptId: 2, batchId: 1, passYear: 2025, cgpa: 7.90, reg: "21ECE032" },
    { name: "Kavya Deshmukh", gender: "Female", deptId: 3, batchId: 1, passYear: 2025, cgpa: 8.45, reg: "21ME018" },
    { name: "Rohan Chatterjee", gender: "Male", deptId: 1, batchId: 1, passYear: 2025, cgpa: 8.88, reg: "21CSE045" },
    { name: "Divya Srinivasan", gender: "Female", deptId: 4, batchId: 1, passYear: 2025, cgpa: 9.05, reg: "21IT008" },
    { name: "Aditya Joshi", gender: "Male", deptId: 2, batchId: 1, passYear: 2025, cgpa: 6.95, reg: "21ECE077" },
    { name: "Pooja Hegde", gender: "Female", deptId: 1, batchId: 1, passYear: 2025, cgpa: 7.45, reg: "21CSE102" },
    { name: "Karthik Pillai", gender: "Male", deptId: 3, batchId: 1, passYear: 2025, cgpa: 8.12, reg: "21ME064" },
    { name: "Neha Saxena", gender: "Female", deptId: 2, batchId: 1, passYear: 2025, cgpa: 8.78, reg: "21ECE050" },
    { name: "Tanmay Bansal", gender: "Male", deptId: 4, batchId: 1, passYear: 2025, cgpa: 6.60, reg: "21IT041" },
    { name: "Rhea Menon", gender: "Female", deptId: 1, batchId: 1, passYear: 2025, cgpa: 9.48, reg: "21CSE067" },
    { name: "Gaurav Sen", gender: "Male", deptId: 1, batchId: 1, passYear: 2025, cgpa: 8.92, reg: "21CSE033" },
    { name: "Shreya Ghoshal", gender: "Female", deptId: 2, batchId: 1, passYear: 2025, cgpa: 8.35, reg: "21ECE021" },
    { name: "Akash Singhal", gender: "Male", deptId: 3, batchId: 1, passYear: 2025, cgpa: 7.20, reg: "21ME035" },
    { name: "Meera Krishnan", gender: "Female", deptId: 4, batchId: 1, passYear: 2025, cgpa: 8.90, reg: "21IT019" },
    { name: "Pranav Varma", gender: "Male", deptId: 1, batchId: 1, passYear: 2025, cgpa: 7.75, reg: "21CSE110" },
    { name: "Simran Kaur", gender: "Female", deptId: 2, batchId: 1, passYear: 2025, cgpa: 9.10, reg: "21ECE065" },
    { name: "Harsh Vardhan", gender: "Male", deptId: 3, batchId: 1, passYear: 2025, cgpa: 6.85, reg: "21ME088" },
    { name: "Anwesha Datta", gender: "Female", deptId: 1, batchId: 1, passYear: 2025, cgpa: 9.60, reg: "21CSE005" },
    { name: "Varun Shenoy", gender: "Male", deptId: 4, batchId: 1, passYear: 2025, cgpa: 8.15, reg: "21IT030" },
    // Batch 2 (Class of 2026 - Pre-final year)
    { name: "Ishaan Mehta", gender: "Male", deptId: 1, batchId: 2, passYear: 2026, cgpa: 8.70, reg: "22CSE015" },
    { name: "Ananya Pandey", gender: "Female", deptId: 2, batchId: 2, passYear: 2026, cgpa: 8.95, reg: "22ECE008" },
    { name: "Devansh Patel", gender: "Male", deptId: 3, batchId: 2, passYear: 2026, cgpa: 7.55, reg: "22ME022" },
    { name: "Tara Bhatt", gender: "Female", deptId: 1, batchId: 2, passYear: 2026, cgpa: 9.20, reg: "22CSE042" },
    { name: "Abhishek Roy", gender: "Male", deptId: 4, batchId: 2, passYear: 2026, cgpa: 8.40, reg: "22IT017" },
    { name: "Ritika Sethi", gender: "Female", deptId: 1, batchId: 2, passYear: 2026, cgpa: 9.42, reg: "22CSE099" },
    { name: "Nikhil Kamath", gender: "Male", deptId: 2, batchId: 2, passYear: 2026, cgpa: 7.80, reg: "22ECE054" },
    { name: "Sanya Mirza", gender: "Female", deptId: 3, batchId: 2, passYear: 2026, cgpa: 8.10, reg: "22ME049" },
    { name: "Ayush Khurana", gender: "Male", deptId: 4, batchId: 2, passYear: 2026, cgpa: 7.15, reg: "22IT061" },
    { name: "Nandini Rao", gender: "Female", deptId: 1, batchId: 2, passYear: 2026, cgpa: 8.85, reg: "22CSE078" },
    // Batch 3 (MCA - Class of 2025)
    { name: "Deepak Soni", gender: "Male", deptId: 5, batchId: 3, passYear: 2025, cgpa: 8.60, reg: "23MCA004" },
    { name: "Monika Sharma", gender: "Female", deptId: 5, batchId: 3, passYear: 2025, cgpa: 9.18, reg: "23MCA012" },
    { name: "Siddharth Rao", gender: "Male", deptId: 5, batchId: 3, passYear: 2025, cgpa: 7.95, reg: "23MCA025" },
    { name: "Priyanka Gandhi", gender: "Female", deptId: 5, batchId: 3, passYear: 2025, cgpa: 8.45, reg: "23MCA033" },
    { name: "Manish Tiwari", gender: "Male", deptId: 5, batchId: 3, passYear: 2025, cgpa: 8.05, reg: "23MCA041" },
  ];

  const students: Student[] = rawStudentData.map((s, idx) => ({
    id: idx + 1,
    registration_number: s.reg,
    full_name: s.name,
    gender: s.gender as any,
    email: `${s.name.toLowerCase().replace(/\s+/g, ".")}@student.apexinstitute.edu`,
    phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
    course_id: s.deptId === 5 ? 2 : 1,
    department_id: s.deptId,
    batch_id: s.batchId,
    passing_year: s.passYear,
    cgpa: s.cgpa,
    created_at: now,
    updated_at: now,
    created_by: 1,
    updated_by: 1,
  }));

  // ─── Semester Records Generator ───────────────────────────────────────────
  const semester_records: SemesterRecord[] = [];
  let nextSubjectId = 1;
  let nextSemId = 1;

  for (const st of students) {
    const semCount = st.passing_year === 2025 ? (st.course_id === 2 ? 3 : 6) : 4;
    for (let sem = 1; sem <= semCount; sem++) {
      const sId = nextSemId++;
      const baseMark = Math.min(98, Math.max(55, Math.round(st.cgpa! * 9.5 + (Math.random() * 8 - 4))));

      const subjects = [
        {
          id: nextSubjectId++,
          semester_record_id: sId,
          subject_name: sem <= 2 ? "Engineering Mathematics" : "Data Structures & Algorithms",
          subject_code: sem <= 2 ? `MAT${sem}01` : `CSE${sem}01`,
          marks_obtained: baseMark,
          max_marks: 100,
          credits: 4,
        },
        {
          id: nextSubjectId++,
          semester_record_id: sId,
          subject_name: sem <= 2 ? "Applied Physics" : "Database Management Systems",
          subject_code: sem <= 2 ? `PHY${sem}02` : `CSE${sem}02`,
          marks_obtained: Math.min(100, baseMark + 2),
          max_marks: 100,
          credits: 4,
        },
        {
          id: nextSubjectId++,
          semester_record_id: sId,
          subject_name: sem <= 2 ? "Basic Electrical Eng" : "Operating Systems",
          subject_code: sem <= 2 ? `BEE${sem}03` : `CSE${sem}03`,
          marks_obtained: Math.max(45, baseMark - 4),
          max_marks: 100,
          credits: 3,
        },
      ];

      const semSgpa = Number(((baseMark / 100) * 10).toFixed(2));
      semester_records.push({
        id: sId,
        student_id: st.id,
        semester_number: sem,
        sgpa: semSgpa,
        subjects,
      });
    }
  }

  // ─── Backlogs (active & cleared) ──────────────────────────────────────────
  const backlogs: Backlog[] = [
    {
      id: 1,
      student_id: 11, // Aditya Joshi (CGPA 6.95)
      subject_name: "Signals and Systems",
      subject_code: "ECE302",
      semester_number: 3,
      status: "Active",
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      student_id: 15, // Tanmay Bansal (CGPA 6.60)
      subject_name: "Discrete Mathematics",
      subject_code: "MAT201",
      semester_number: 2,
      status: "Active",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      student_id: 23, // Harsh Vardhan (CGPA 6.85)
      subject_name: "Kinematics of Machinery",
      subject_code: "ME401",
      semester_number: 4,
      status: "Active",
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      student_id: 3, // Mohammed Saif (Cleared)
      subject_name: "Engineering Mechanics",
      subject_code: "ME102",
      semester_number: 1,
      status: "Cleared",
      cleared_on: "2023-01-15",
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      student_id: 19, // Akash Singhal (Cleared)
      subject_name: "Fluid Dynamics",
      subject_code: "ME301",
      semester_number: 3,
      status: "Cleared",
      cleared_on: "2024-02-10",
      created_at: now,
      updated_at: now,
    },
  ];

  // ─── 10 Top Companies ─────────────────────────────────────────────────────
  const companies: Company[] = [
    {
      id: 1,
      name: "Microsoft",
      name_normalized: "microsoft",
      industry: "Technology & Cloud Computing",
      website: "https://www.microsoft.com",
      location: "Hyderabad & Bangalore",
      status: "Active",
      contacts: [
        {
          id: 1,
          company_id: 1,
          name: "Siddharth Verma",
          designation: "University Recruiting Lead",
          email: "siddharth.v@microsoft.com",
          phone: "+91 80 4010 3000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 1,
          company_id: 1,
          title: "Software Engineer",
          designation: "SDE-1",
          salary_min: 2400000,
          salary_max: 4500000,
          skills: ["Algorithms", "Distributed Systems", "C++", "Azure"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      name: "Google",
      name_normalized: "google",
      industry: "Internet & Artificial Intelligence",
      website: "https://about.google",
      location: "Bangalore & Hyderabad",
      status: "Active",
      contacts: [
        {
          id: 2,
          company_id: 2,
          name: "Preeti Shenoy",
          designation: "Campus Talent Lead",
          email: "pshenoy@google.com",
          phone: "+91 80 6721 8000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 2,
          company_id: 2,
          title: "Associate Software Engineer",
          designation: "SWE III",
          salary_min: 2800000,
          salary_max: 5200000,
          skills: ["Data Structures", "System Design", "Python", "Go"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      name: "Amazon",
      name_normalized: "amazon",
      industry: "E-Commerce & Cloud (AWS)",
      website: "https://www.amazon.jobs",
      location: "Hyderabad, India",
      status: "Active",
      contacts: [
        {
          id: 3,
          company_id: 3,
          name: "Arjun Nambiar",
          designation: "Technical Recruiter",
          email: "arjun.n@amazon.com",
          phone: "+91 40 4000 5000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 3,
          company_id: 3,
          title: "Software Development Engineer",
          designation: "SDE-1",
          salary_min: 1800000,
          salary_max: 3200000,
          skills: ["Java", "OOP", "AWS", "DynamoDB"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      name: "Qualcomm",
      name_normalized: "qualcomm",
      industry: "Semiconductors & Telecommunications",
      website: "https://www.qualcomm.com",
      location: "Bangalore, India",
      status: "Active",
      contacts: [
        {
          id: 4,
          company_id: 4,
          name: "Naveen Chandran",
          designation: "Lead Technical Recruiter",
          email: "nchandran@qualcomm.com",
          phone: "+91 80 4118 7000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 4,
          company_id: 4,
          title: "Hardware & Embedded Engineer",
          designation: "Engineer - Hardware/Firmware",
          salary_min: 1400000,
          salary_max: 2200000,
          skills: ["VLSI", "Embedded C", "Verilog", "Linux Kernel"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      name: "Deloitte",
      name_normalized: "deloitte",
      industry: "Consulting & Financial Advisory",
      website: "https://www2.deloitte.com",
      location: "Mumbai & Hyderabad",
      status: "Active",
      contacts: [
        {
          id: 5,
          company_id: 5,
          name: "Sanjana Mehra",
          designation: "Campus Relations Manager",
          email: "smehra@deloitte.com",
          phone: "+91 22 6185 4000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 5,
          company_id: 5,
          title: "Technology Analyst",
          designation: "Analyst - Advisory",
          salary_min: 850000,
          salary_max: 1250000,
          skills: ["SQL", "Analytics", "PowerBI", "Consulting"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      name: "TCS",
      name_normalized: "tcs",
      industry: "Information Technology",
      website: "https://www.tcs.com",
      location: "Mumbai, India",
      status: "Active",
      contacts: [
        {
          id: 6,
          company_id: 6,
          name: "Vikram Mehta",
          designation: "Campus Lead",
          email: "v.mehta@tcs.com",
          phone: "+91 22 6778 9000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 6,
          company_id: 6,
          title: "Ninja & Digital Developer",
          designation: "Software Engineer",
          salary_min: 360000,
          salary_max: 750000,
          skills: ["Java", "Python", "SQL", "Data Structures"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 7,
      name: "Infosys",
      name_normalized: "infosys",
      industry: "IT & Consulting",
      website: "https://www.infosys.com",
      location: "Bangalore, India",
      status: "Active",
      contacts: [
        {
          id: 7,
          company_id: 7,
          name: "Ananya Roy",
          designation: "HR Talent Acquisition",
          email: "ananya.roy@infosys.com",
          phone: "+91 80 2852 0261",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 7,
          company_id: 7,
          title: "System Engineer Specialist",
          designation: "Associate Consultant",
          salary_min: 400000,
          salary_max: 950000,
          skills: ["Full Stack", "Cloud", "Problem Solving"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 8,
      name: "Accenture",
      name_normalized: "accenture",
      industry: "Professional Services & Tech",
      website: "https://www.accenture.com",
      location: "Dublin / Bangalore",
      status: "Active",
      contacts: [
        {
          id: 8,
          company_id: 8,
          name: "Rohan Sen",
          designation: "University Relations Lead",
          email: "rohan.sen@accenture.com",
          phone: "+91 80 4106 0000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 8,
          company_id: 8,
          title: "Application Development Associate",
          designation: "Associate Software Engineer",
          salary_min: 450000,
          salary_max: 650000,
          skills: ["Agile", "TypeScript", "DevOps"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 9,
      name: "Larsen & Toubro",
      name_normalized: "larsen & toubro",
      industry: "Engineering & Construction",
      website: "https://www.larsentoubro.com",
      location: "Mumbai, India",
      status: "Active",
      contacts: [
        {
          id: 9,
          company_id: 9,
          name: "Devendra Patil",
          designation: "Senior Manager - HR",
          email: "d.patil@larsentoubro.com",
          phone: "+91 22 6752 5656",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 9,
          company_id: 9,
          title: "Graduate Engineer Trainee",
          designation: "GET - Mechanical & Electrical",
          salary_min: 600000,
          salary_max: 850000,
          skills: ["AutoCAD", "Thermodynamics", "Project Management"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
    {
      id: 10,
      name: "Capgemini",
      name_normalized: "capgemini",
      industry: "Technology Services",
      website: "https://www.capgemini.com",
      location: "Paris / Pune",
      status: "Active",
      contacts: [
        {
          id: 10,
          company_id: 10,
          name: "Shruti Desai",
          designation: "Lead Recruiter",
          email: "shruti.desai@capgemini.com",
          phone: "+91 20 6699 1000",
          is_primary: true,
        },
      ],
      job_roles: [
        {
          id: 10,
          company_id: 10,
          title: "Senior Analyst",
          designation: "Software Developer",
          salary_min: 425000,
          salary_max: 750000,
          skills: ["Java", "React", "Cloud"],
        },
      ],
      created_at: now,
      updated_at: now,
    },
  ];

  // ─── Criteria Sets ────────────────────────────────────────────────────────
  const criteria_sets: CriteriaSet[] = [
    {
      id: 1, // High cutoff (Google, Microsoft)
      rules: [
        { id: 1, criteria_set_id: 1, rule_type: "MIN_CGPA", numeric_value: 8.5 },
        { id: 2, criteria_set_id: 1, rule_type: "MAX_ACTIVE_BACKLOGS", numeric_value: 0 },
        { id: 3, criteria_set_id: 1, rule_type: "ALLOWED_PASSING_YEARS", numeric_value: 2025 },
      ],
    },
    {
      id: 2, // Medium cutoff (Amazon, Qualcomm, Deloitte)
      rules: [
        { id: 4, criteria_set_id: 2, rule_type: "MIN_CGPA", numeric_value: 7.5 },
        { id: 5, criteria_set_id: 2, rule_type: "MAX_ACTIVE_BACKLOGS", numeric_value: 0 },
        { id: 6, criteria_set_id: 2, rule_type: "ALLOWED_PASSING_YEARS", numeric_value: 2025 },
      ],
    },
    {
      id: 3, // Standard mass/core cutoff (TCS, Infosys, Accenture, L&T, Capgemini)
      rules: [
        { id: 7, criteria_set_id: 3, rule_type: "MIN_CGPA", numeric_value: 6.5 },
        { id: 8, criteria_set_id: 3, rule_type: "MAX_ACTIVE_BACKLOGS", numeric_value: 1 },
        { id: 9, criteria_set_id: 3, rule_type: "ALLOWED_PASSING_YEARS", numeric_value: 2025 },
      ],
    },
  ];

  // ─── 6 Placement Drives ───────────────────────────────────────────────────
  const drives: Drive[] = [
    {
      id: 1,
      company_id: 2, // Google
      academic_year_id: 2,
      title: "Google Campus Recruitment 2025",
      description: "Recruitment for Software Engineering roles (SWE III).",
      drive_date: "2024-09-15",
      status: "Completed",
      criteria_set_id: 1,
      stages: [
        { id: 1, drive_id: 1, name: "Online Coding Challenge", stage_type: "Technical", sequence: 1 },
        { id: 2, drive_id: 1, name: "Technical Interview Round 1", stage_type: "Technical", sequence: 2 },
        { id: 3, drive_id: 1, name: "Technical Interview Round 2", stage_type: "Technical", sequence: 3 },
        { id: 4, drive_id: 1, name: "Googliness & Leadership", stage_type: "HR", sequence: 4 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      company_id: 1, // Microsoft
      academic_year_id: 2,
      title: "Microsoft Software Engineering Drive 2025",
      description: "Hiring Software Engineers for Cloud + AI divisions.",
      drive_date: "2024-10-05",
      status: "Completed",
      criteria_set_id: 1,
      stages: [
        { id: 5, drive_id: 2, name: "Online Assessment", stage_type: "Aptitude", sequence: 1 },
        { id: 6, drive_id: 2, name: "Technical Rounds", stage_type: "Technical", sequence: 2 },
        { id: 7, drive_id: 2, name: "AA Interview", stage_type: "HR", sequence: 3 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      company_id: 3, // Amazon
      academic_year_id: 2,
      title: "Amazon SDE Hiring 2025",
      description: "Campus drive for SDE-1 roles in Prime and AWS.",
      drive_date: "2024-10-18",
      status: "In Progress",
      criteria_set_id: 2,
      stages: [
        { id: 8, drive_id: 3, name: "OA1 & OA2 Debugging & Logic", stage_type: "Technical", sequence: 1 },
        { id: 9, drive_id: 3, name: "System & Coding Loop", stage_type: "Technical", sequence: 2 },
        { id: 10, drive_id: 3, name: "Bar Raiser Round", stage_type: "HR", sequence: 3 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      company_id: 4, // Qualcomm
      academic_year_id: 2,
      title: "Qualcomm Hardware & Embedded 2025",
      description: "Recruitment for ECE and CSE graduates in Embedded and VLSI systems.",
      drive_date: "2024-10-28",
      status: "In Progress",
      criteria_set_id: 2,
      stages: [
        { id: 11, drive_id: 4, name: "Hardware & C Aptitude", stage_type: "Aptitude", sequence: 1 },
        { id: 12, drive_id: 4, name: "Technical Deep-dive", stage_type: "Technical", sequence: 2 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      company_id: 6, // TCS
      academic_year_id: 2,
      title: "TCS Campus Recruitment 2025",
      description: "National recruitment drive for Ninja & Digital developers.",
      drive_date: "2024-10-22",
      status: "In Progress",
      criteria_set_id: 3,
      stages: [
        { id: 13, drive_id: 5, name: "National Qualifier Test (NQT)", stage_type: "Aptitude", sequence: 1 },
        { id: 14, drive_id: 5, name: "Technical Interview", stage_type: "Technical", sequence: 2 },
        { id: 15, drive_id: 5, name: "HR Round", stage_type: "HR", sequence: 3 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      company_id: 7, // Infosys
      academic_year_id: 2,
      title: "Infosys Specialist Hiring 2025",
      description: "Specialist Programmer and Digital Specialist Engineer roles.",
      drive_date: "2024-11-10",
      status: "Registration Open",
      criteria_set_id: 3,
      stages: [
        { id: 16, drive_id: 6, name: "HackWithInfy Round", stage_type: "Technical", sequence: 1 },
        { id: 17, drive_id: 6, name: "Technical + HR", stage_type: "Technical", sequence: 2 },
      ],
      roles: [],
      created_at: now,
      updated_at: now,
    },
  ];

  // ─── Applications & Pipeline Outcomes ─────────────────────────────────────
  const applications: Application[] = [];
  let nextAppId = 1;

  // Google Drive (Drive 1): Students 6 (Ananya Iyer), 16 (Rhea Menon), 24 (Anwesha Datta)
  const googleCandidates = [6, 16, 24];
  for (const sId of googleCandidates) {
    const aId = nextAppId++;
    applications.push({
      id: aId,
      drive_id: 1,
      student_id: sId,
      applied_date: "2024-09-01",
      final_outcome: "Selected",
      stages: [
        { id: Date.now() + aId * 10 + 1, application_id: aId, drive_stage_id: 1, scheduled_at: "2024-09-15 10:00", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 2, application_id: aId, drive_stage_id: 2, scheduled_at: "2024-09-18 11:30", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 3, application_id: aId, drive_stage_id: 3, scheduled_at: "2024-09-20 14:00", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 4, application_id: aId, drive_stage_id: 4, scheduled_at: "2024-09-22 16:00", outcome: "Passed", updated_at: now, updated_by: 1 },
      ],
      created_at: now,
      updated_at: now,
    });
  }

  // Microsoft Drive (Drive 2): Students 1 (Aarav), 2 (Priya), 4 (Sneha), 17 (Gaurav)
  const msCandidates = [1, 2, 4, 17];
  for (const sId of msCandidates) {
    const aId = nextAppId++;
    applications.push({
      id: aId,
      drive_id: 2,
      student_id: sId,
      applied_date: "2024-09-25",
      final_outcome: sId === 4 ? "Rejected" : "Selected",
      stages: [
        { id: Date.now() + aId * 10 + 1, application_id: aId, drive_stage_id: 5, scheduled_at: "2024-10-05 10:00", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 2, application_id: aId, drive_stage_id: 6, scheduled_at: "2024-10-08 11:00", outcome: sId === 4 ? "Failed" : "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 3, application_id: aId, drive_stage_id: 7, scheduled_at: "2024-10-10 15:00", outcome: sId === 4 ? "Pending" : "Passed", updated_at: now, updated_by: 1 },
      ],
      created_at: now,
      updated_at: now,
    });
  }

  // Amazon Drive (Drive 3): Students 5 (Rahul), 9 (Rohan), 10 (Divya), 20 (Meera), 22 (Simran)
  const amzCandidates = [5, 9, 10, 20, 22];
  for (const sId of amzCandidates) {
    const aId = nextAppId++;
    applications.push({
      id: aId,
      drive_id: 3,
      student_id: sId,
      applied_date: "2024-10-10",
      final_outcome: sId === 10 || sId === 22 ? "Selected" : "Pending",
      stages: [
        { id: Date.now() + aId * 10 + 1, application_id: aId, drive_stage_id: 8, scheduled_at: "2024-10-18 10:00", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 2, application_id: aId, drive_stage_id: 9, scheduled_at: "2024-10-22 14:00", outcome: sId === 5 ? "Failed" : "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 3, application_id: aId, drive_stage_id: 10, scheduled_at: "2024-10-26 11:00", outcome: sId === 10 || sId === 22 ? "Passed" : "Pending", updated_at: now, updated_by: 1 },
      ],
      created_at: now,
      updated_at: now,
    });
  }

  // Qualcomm Drive (Drive 4): Students 2 (Priya), 7 (Vikram), 14 (Neha), 18 (Shreya)
  const qcomCandidates = [2, 7, 14, 18];
  for (const sId of qcomCandidates) {
    const aId = nextAppId++;
    applications.push({
      id: aId,
      drive_id: 4,
      student_id: sId,
      applied_date: "2024-10-20",
      final_outcome: sId === 14 || sId === 18 ? "Selected" : "Pending",
      stages: [
        { id: Date.now() + aId * 10 + 1, application_id: aId, drive_stage_id: 11, scheduled_at: "2024-10-28 09:30", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 2, application_id: aId, drive_stage_id: 12, scheduled_at: "2024-10-30 14:00", outcome: sId === 7 ? "Failed" : "Passed", updated_at: now, updated_by: 1 },
      ],
      created_at: now,
      updated_at: now,
    });
  }

  // TCS Drive (Drive 5): Students 3 (Saif), 4 (Sneha), 5 (Rahul), 8 (Kavya), 12 (Pooja), 13 (Karthik)
  const tcsCandidates = [3, 4, 5, 8, 12, 13];
  for (const sId of tcsCandidates) {
    const aId = nextAppId++;
    applications.push({
      id: aId,
      drive_id: 5,
      student_id: sId,
      applied_date: "2024-10-15",
      final_outcome: sId === 4 || sId === 8 || sId === 13 ? "Selected" : "Pending",
      stages: [
        { id: Date.now() + aId * 10 + 1, application_id: aId, drive_stage_id: 13, scheduled_at: "2024-10-22 10:00", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 2, application_id: aId, drive_stage_id: 14, scheduled_at: "2024-10-25 11:30", outcome: "Passed", updated_at: now, updated_by: 1 },
        { id: Date.now() + aId * 10 + 3, application_id: aId, drive_stage_id: 15, scheduled_at: "2024-10-27 15:00", outcome: sId === 4 || sId === 8 || sId === 13 ? "Passed" : "Pending", updated_at: now, updated_by: 1 },
      ],
      created_at: now,
      updated_at: now,
    });
  }

  // ─── Placement Offers ─────────────────────────────────────────────────────
  const offers: Offer[] = [
    {
      id: 1,
      application_id: 1, // Student 6 (Ananya Iyer - Google)
      offer_date: "2024-09-24",
      designation: "Associate Software Engineer",
      annual_salary: 3200000,
      offer_status: "Accepted",
      acceptance_date: "2024-09-25",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      application_id: 2, // Student 16 (Rhea Menon - Google)
      offer_date: "2024-09-24",
      designation: "Associate Software Engineer",
      annual_salary: 3200000,
      offer_status: "Accepted",
      acceptance_date: "2024-09-26",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      application_id: 3, // Student 24 (Anwesha Datta - Google)
      offer_date: "2024-09-24",
      designation: "Associate Software Engineer",
      annual_salary: 3500000,
      offer_status: "Accepted",
      acceptance_date: "2024-09-26",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      application_id: 4, // Student 1 (Aarav Reddy - Microsoft)
      offer_date: "2024-10-12",
      designation: "Software Engineer - Cloud & AI",
      annual_salary: 2850000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-14",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      application_id: 5, // Student 2 (Priya Kapoor - Microsoft)
      offer_date: "2024-10-12",
      designation: "Software Engineer",
      annual_salary: 2850000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-13",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      application_id: 7, // Student 17 (Gaurav Sen - Microsoft)
      offer_date: "2024-10-12",
      designation: "Software Engineer",
      annual_salary: 2600000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-15",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 7,
      application_id: 10, // Student 10 (Divya Srinivasan - Amazon)
      offer_date: "2024-10-27",
      designation: "Software Development Engineer (AWS)",
      annual_salary: 2400000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-28",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 8,
      application_id: 12, // Student 22 (Simran Kaur - Amazon)
      offer_date: "2024-10-27",
      designation: "Software Development Engineer",
      annual_salary: 2200000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-28",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 9,
      application_id: 15, // Student 14 (Neha Saxena - Qualcomm)
      offer_date: "2024-10-31",
      designation: "Firmware Engineer",
      annual_salary: 1650000,
      offer_status: "Accepted",
      acceptance_date: "2024-11-01",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 10,
      application_id: 16, // Student 18 (Shreya Ghoshal - Qualcomm)
      offer_date: "2024-10-31",
      designation: "Hardware Systems Engineer",
      annual_salary: 1550000,
      offer_status: "Pending",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 11,
      application_id: 18, // Student 4 (Sneha Nair - TCS)
      offer_date: "2024-10-28",
      designation: "Digital Engineer",
      annual_salary: 750000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-29",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 12,
      application_id: 20, // Student 8 (Kavya Deshmukh - TCS)
      offer_date: "2024-10-28",
      designation: "Digital Developer",
      annual_salary: 700000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-29",
      joining_status: "Pending",
      created_at: now,
      updated_at: now,
    },
    {
      id: 13,
      application_id: 22, // Student 13 (Karthik Pillai - TCS)
      offer_date: "2024-10-28",
      designation: "Ninja Developer",
      annual_salary: 400000,
      offer_status: "Accepted",
      acceptance_date: "2024-10-30",
      joining_status: "Joined",
      joining_date: "2024-10-30",
      created_at: now,
      updated_at: now,
    },
  ];

  // ─── Audit Trail ──────────────────────────────────────────────────────────
  const audit_logs: AuditLog[] = [
    {
      id: 1,
      occurred_at: "2024-09-01T09:00:00.000Z",
      user_id: 1,
      user_name_snapshot: "S. Kumar",
      action: "INIT_SYSTEM",
      entity_type: "System",
      entity_id: 1,
      summary: "MeritBridge placement system initialized",
    },
    {
      id: 2,
      occurred_at: "2024-09-10T11:20:00.000Z",
      user_id: 1,
      user_name_snapshot: "S. Kumar",
      action: "CREATE_DRIVE",
      entity_type: "Drive",
      entity_id: 1,
      summary: "Created recruitment drive: Google Campus Recruitment 2025",
    },
    {
      id: 3,
      occurred_at: "2024-09-24T16:45:00.000Z",
      user_id: 1,
      user_name_snapshot: "S. Kumar",
      action: "ISSUE_OFFER",
      entity_type: "Offer",
      entity_id: 1,
      summary: "Recorded accepted offer: Associate Software Engineer (₹32.0 LPA) for Ananya Iyer",
    },
    {
      id: 4,
      occurred_at: "2024-10-05T10:15:00.000Z",
      user_id: 2,
      user_name_snapshot: "Dr. Anita Sharma",
      action: "CREATE_DRIVE",
      entity_type: "Drive",
      entity_id: 2,
      summary: "Created recruitment drive: Microsoft Software Engineering Drive 2025",
    },
    {
      id: 5,
      occurred_at: "2024-10-12T17:30:00.000Z",
      user_id: 2,
      user_name_snapshot: "Dr. Anita Sharma",
      action: "ISSUE_OFFER",
      entity_type: "Offer",
      entity_id: 4,
      summary: "Recorded accepted offer: Software Engineer (₹28.5 LPA) for Aarav Reddy",
    },
  ];

  return {
    users,
    app_security,
    institution,
    academic_years,
    courses,
    departments,
    batches,
    students,
    semester_records,
    backlogs,
    student_documents: [],
    companies,
    criteria_sets,
    drives,
    eligibility_results: [],
    eligibility_overrides: [],
    applications,
    offers,
    audit_logs,
    backup_history: [],
    settings,
  };
}
