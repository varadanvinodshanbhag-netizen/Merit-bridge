# Placement Analyzer — Product Requirements Document

Version 1.0 · October 20, 2026 · Prepared for implementation by Antigravity

**How to use this document.** Requirement IDs (for example STU-03) are stable references for implementation, testing and acceptance. MUST marks a V1 obligation, SHOULD a strong default that may change only with a documented reason, and MAY an optional enhancement. The separately supplied UI design is the sole authority on visual appearance; this PRD defines behavior only. Where the brief left a point open, this document records a **Decision**, and the remaining open items are collected in Section 16.

## 1. Executive Summary and Product Vision

Placement Analyzer is a Windows desktop application for a college placement cell. It replaces scattered spreadsheets and folders with one reliable system that combines student and academic records, company and drive management, eligibility checking, interview tracking, offers and joining, analytics, reports, and student PDF documents.

The first release serves one institution with multiple courses, departments and academic batches, on a single computer, with individual staff accounts of equal permission. It must be practical for everyday use: fast to search, simple to operate, and trustworthy when numbers are reported to management.

Three principles guide every decision in this document:

- **One definition of every number.** Placed students, offers, selections, conversion rates and salary statistics are defined once (Section 6) and reused by the dashboard, analytics, reports and exports.
- **History is never silently lost.** Records are archived rather than deleted, recruitment and offer history is append-only, and consequential changes are audited.
- **Data outlives the application.** All user data lives outside the executable, can be backed up and restored with its PDFs, and survives application updates.

| Area | Confirmed choice |
| --- | --- |
| Desktop shell | Tauri 2 (Rust backend, WebView2 on Windows) |
| Frontend | React + TypeScript |
| Database | SQLite, behind a repository layer designed for later PostgreSQL or MySQL |
| Documents | PDF files stored on disk beside the database, never inside it |
| Distribution | Windows installer (primary); data stored outside the install folder |
| Appearance | Supplied UI design; light, dark and system themes |

## 2. Goals and Measurable Success Criteria

**Goals**

- G1. Give the placement cell a single source of truth for students, academics, companies, drives, applications, offers and documents.
- G2. Make eligibility decisions transparent, explainable and correctable.
- G3. Produce analytics and reports whose figures always agree with each other and with on-screen records.
- G4. Protect data with audit history, validated backups and safe restores.
- G5. Stay simple: few screens, uncluttered forms, minimal settings.

| ID | Success criterion | Target |
| --- | --- | --- |
| SC-01 | Duplicate registration numbers possible in the database | Zero (enforced by constraint, case-insensitive) |
| SC-02 | Same metric shown on dashboard, analytics and reports for identical filters | 100% agreement, verified by automated tests |
| SC-03 | Student list (10,000 students, 25 rows per page, filters applied) | Result displayed within 500 ms |
| SC-04 | Analytics view or report with 10,000 students and 50,000 applications | Generated within 3 seconds |
| SC-05 | Excel import of 5,000 student rows, from preview to completion | Under 30 seconds |
| SC-06 | Cold application start to login screen | Under 3 seconds on a mid-range laptop |
| SC-07 | Backup then restore on a clean machine | Data and PDFs identical (checksum verified) |
| SC-08 | Failed restore or migration | Current data unchanged in 100% of fault-injection tests |
| SC-09 | Eligibility explanation | Every Ineligible or Needs Review result lists the specific rule and reason |
| SC-10 | Staff can add a student with required fields | Under 2 minutes, without leaving a single form |
| SC-11 | Core workflows tested end to end before release | All workflows in Section 4 pass on a clean Windows 10 and Windows 11 install |

Expected scale for V1: up to 20,000 students, 500 companies, 2,000 drives and 200,000 application, stage and offer records, on one computer.

## 3. Scope

### 3.1 In scope

Student management; academic records and backlogs; Excel import and export; company management; placement drives; eligibility checking with overrides; applications and interview stages; offers and joining; placement analytics; PDF and Excel reports; student PDF documents; search and filtering; dashboard; settings; staff authentication; audit history; backup and recovery; data integrity rules; Windows packaging.

### 3.2 Out of scope for V1

- LAN or multi-computer access, central database servers, central application service, role hierarchy (documented only as future considerations in Section 15).
- Predictive AI, scoring models, and advanced statistical analytics.
- Crystal Reports integration.
- Resume generation, PDF content editing, and non-PDF attachments.
- Student-facing portal, email or SMS notifications, calendar integration.
- Importing company and placement data from Excel (the importer framework is structured to add them; only student and academic importers ship in V1).
- Automatic in-app updates (updates are applied by running a newer installer).
- Application-level database encryption (see Section 9).
- Multiple institutions in one database, and off-campus offers not linked to a recorded drive (see Section 16).

## 4. Users and Workflows

**Users.** The primary users are placement-cell staff (coordinators, officers, assistants). All staff accounts have identical permissions in V1. Management receives exported PDF and Excel reports but does not use the application directly.

**W1. First-time setup.** Install the application, launch it, create the first staff account, record the recovery key, enter institution details and academic configuration (courses, departments, batches, academic years, current academic year), set the backup location.

**W2. Student onboarding.** Add students manually or import from Excel (choose file, map columns, preview, resolve duplicates, commit). Add semester marks, SGPA/CGPA and backlogs manually or by import. Attach PDFs.

**W3. Company and drive setup.** Add the company, contacts and job roles. Create a drive for an academic year, adjust the inherited eligibility criteria, define recruitment stages, open the drive.

**W4. Eligibility and applications.** Review the eligibility list (Eligible, Ineligible, Needs Review with explanations), override where justified, add applications, schedule and record stage results through the pipeline.

**W5. Offers and joining.** Mark candidates Selected, record offers, record acceptance, later record joining. A student counts as placed once an offer is Accepted.

**W6. Analysis and reporting.** Open Analytics, apply filters, review comparisons and trends, then generate PDF reports or Excel exports for management.

**W7. Protection.** Backups run on schedule and on demand; staff review backup history and restore safely when needed.

## 5. Functional Requirements

Navigation and screen layout follow the supplied UI design. Functional destinations required: Dashboard, Students, Companies, Drives, Analytics, Reports, Settings, plus Import, which may be reached from Students and from the dashboard quick actions. Detailed requirements for import/export and reports are in Section 10, and for settings and backup in Section 11.

### 5.1 Authentication and Staff Accounts (AUTH)

- AUTH-01. On first launch with zero accounts, only a one-time setup screen is reachable, creating the first staff account. Once any account exists the setup screen is permanently unavailable.
- AUTH-02. Setup generates a recovery key, displayed once and acknowledged by the user (copy and print supported). Only its Argon2id hash is stored.
- AUTH-03. Sign-in uses username and password. Failure messages are generic. After 5 consecutive failures the account locks for 15 minutes. Sessions live in backend memory and end on logout or application exit.
- AUTH-04. Any signed-in staff member may create accounts, deactivate other accounts (never themselves or the last active account), and issue a temporary password that must be changed at next sign-in.
- AUTH-05. Users change their own password by supplying the current password. Policy: at least 10 characters, not equal to the username; no forced composition rules.
- AUTH-06. Local recovery: on the sign-in screen, a user enters username, recovery key and a new password. A successful recovery rotates the recovery key and shows the new one once. If the key is lost, the documented fallback is restoring a backup (Section 14 release documentation).
- AUTH-07. Accounts are never deleted; deactivated accounts remain attributed in audit history.

### 5.2 Student Management (STU)

- STU-01. Student fields: registration number (required, unique), full name (required), date of birth, gender, email, phone, alternate phone, address, course (required), department (required), batch (required), passing year (required), notes.
- STU-02. Department and batch choices depend on the selected course. Passing year defaults from the batch and is editable (lateral-entry students differ).
- STU-03. Registration numbers are trimmed and stored uppercase. Uniqueness is enforced across active and archived students. A conflict message links to the existing student, and states when that student is archived, offering Restore.
- STU-04. Registration numbers may be edited (typos occur); the change is audited and uniqueness re-checked.
- STU-05. The student list supports search by registration number, name, email and phone; filters (Section 5.10); sorting on every displayed column; pagination of 25, 50 or 100 rows; a result count; and an Archived view. Archived students are hidden by default.
- STU-06. The student profile has three sections: **Personal Details**, **Academics** and **Placements**. **Decision:** the Documents panel (Section 5.9) lives inside Personal Details so the profile keeps exactly three sections.
- STU-07. Archive requires confirmation and an optional reason. An archived student is excluded from default lists, active counts, dashboard figures, default analytics, eligibility lists and applicant pickers, and keeps every historical record. Restore reverses it.
- STU-08. Permanent deletion is allowed only for archived students with no applications or offers. It requires typing the registration number and a reason, deletes the student’s academics, backlogs and PDF files, and leaves an audit tombstone (registration number, name, reason, staff, time). Students with recruitment history cannot be deleted, only archived.

### 5.3 Academic Records (ACA)

- ACA-01. The Academics section shows semesters in order. For each semester: subject rows (subject name, optional code, marks obtained, maximum marks, optional credits), a computed semester percentage, and an optional SGPA entered by staff. The student has a CGPA field (manual entry unless the course is configured otherwise, Section 6.3).
- ACA-02. Validation: obtained marks between 0 and maximum; maximum greater than 0; semester number within the course’s configured number of semesters; one record per student and semester; subject unique within a semester by name or code.
- ACA-03. **No assumed conversion.** The system never derives SGPA or CGPA from marks, nor percentage from CGPA. It only applies methods the institution has explicitly configured (Section 6.3).
- ACA-04. Backlog records capture subject name, optional code, semester, status (Active or Cleared), cleared date and remarks. Backlogs are entered manually or imported, never auto-derived from marks (pass marks are institution-specific). A MAY convenience action prefills a backlog from a subject row.
- ACA-05. Active backlog count is calculated automatically from Active records and shown on the profile, lists and filters. Marking a backlog Cleared records date and staff, retains the record, and keeps cleared history visible. Reopening a cleared backlog is allowed and audited.
- ACA-06. The Academics section summarizes latest CGPA, aggregate percentage, active backlog count and cleared backlog count.
- ACA-07. Any change to marks, SGPA, CGPA or backlogs is audited with before and after values and triggers eligibility recalculation (ELG-05).

### 5.4 Company Management (COM)

- COM-01. Company fields: name (unique, case-insensitive), industry, website, location, description, notes, status (Active or Archived).
- COM-02. Multiple contacts per company: name, designation, email, phone, primary flag.
- COM-03. Multiple job roles per company: title, designation, description, required skills (tags), salary package minimum and maximum (annual, INR; a single value is allowed).
- COM-04. Each company has optional default eligibility criteria used as the starting template for new drives (Section 5.5).
- COM-05. A read-only Recruitment History tab lists the company’s drives with applicants, selections, offers, accepted offers, joined students and package statistics.
- COM-06. Archiving a company blocks new drives but preserves history. Permanent deletion is allowed only for companies with no drives.

### 5.5 Placement Drives (DRV)

- DRV-01. Drive fields: company, academic year, title (defaults to company and year), description, drive date, registration deadline, status (Draft, Open, In Progress, Completed, Cancelled), job roles offered (chosen from the company’s roles, each with optional openings and optional drive-specific package), notes.
- DRV-02. A company may have any number of drives, including several in one academic year.
- DRV-03. A new drive copies the company’s default eligibility criteria into its own independent criteria set. Later changes to company defaults never alter existing drives.
- DRV-04. Recruitment stages are an ordered, per-drive list. Each stage has a name and a type (Aptitude, Technical, Group Discussion, HR, Other). Stages can be added, renamed and reordered; stages with recorded results cannot be removed. **Decision:** a new drive is prefilled with Aptitude Test, Technical Interview and HR Interview, all editable; no separate template setting exists.
- DRV-05. The drive detail view provides Overview, Eligible Students, Applicants (with stage pipeline) and Offers.
- DRV-06. Drive-level job role details (title, designation, package) are snapshotted when the role is attached, so later edits to a company role never rewrite past drives.
- DRV-07. Completed and Cancelled drives reject new applications but still allow offer, joining and corrective edits, all audited.

### 5.6 Eligibility Checking (ELG)

- ELG-01. Eligibility criteria are an optional set of rules: minimum CGPA, minimum aggregate percentage, maximum active backlogs (0 means none allowed), allowed courses, allowed departments, allowed batches, allowed passing years. Rules left unset are not applied.
- ELG-02. For each active student and drive the system computes one of **Eligible**, **Ineligible** or **Needs Review**, following the precedence in Section 6.2.
- ELG-03. Every result stores an explanation: each rule with required value, actual value, verdict (Pass, Fail, Unknown) and plain-language reason, for example “CGPA not recorded”.
- ELG-04. Staff may override a student’s result for one drive to Eligible or Ineligible. A reason (at least 10 characters) is mandatory; the staff account and timestamp are recorded. The computed result remains visible beside the effective result, and the override can be removed, with removal audited.
- ELG-05. Results are recalculated automatically, transactionally, when criteria are saved; when a student’s course, department, batch, passing year, marks, SGPA, CGPA or backlogs change; and when a student is archived or restored. Only Draft, Open and In Progress drives are recalculated; Completed and Cancelled drives keep their last result. A manual Recalculate action is always available.
- ELG-06. Missing academic data never produces Ineligible; it produces Needs Review for the rules it affects.
- ELG-07. An application requires an effective status of Eligible or Needs Review (the latter after confirmation). An Ineligible student can be added only after an override. If eligibility later changes, existing applications are kept and flagged.
- ELG-08. The Eligible Students view supports filtering by status and export to Excel or PDF.

### 5.7 Applications and Interviews (APP)

- APP-01. One application per student per drive (enforced by constraint). Fields: applied date, applied job role (optional, from the drive’s roles), final outcome, remarks. Applications can be added individually or in bulk from the eligible list.
- APP-02. Final outcome values: Pending, Selected, Rejected, Withdrawn. **Decision:** the outcome is staff-controlled, with one-click suggestions when stage results imply it (a failed stage suggests Rejected; a passed final stage suggests Selected). Selection alone is never placement.
- APP-03. Stage results exist only for stages a student has reached. Staff can move selected applicants to a stage in bulk. Each result has scheduled date and time, outcome (Pending, Passed, Failed, Withdrawn), remarks, and updating staff and time.
- APP-04. Every stage change appends to an immutable history (previous outcome, new outcome, remarks, staff, time).
- APP-05. Applications are never deleted in the interface; withdrawal is the correct path. Applications to different drives and companies are fully independent: a student may be Selected in several.
- APP-06. Bulk actions (add applicants, advance stage, set outcome) require confirmation and report per-row results.
- APP-07. Upcoming interviews are stage results with a future scheduled time and outcome Pending.

### 5.8 Offers and Joining (OFR)

- OFR-01. Offers are recorded against an application whose outcome is Selected. The interface offers a “mark Selected and add offer” shortcut.
- OFR-02. Offer fields: offer date, designation, annual salary (INR), offer status (Pending, Accepted, Declined, Rescinded), acceptance date, joining status (Pending, Joined, Not Joined), joining date, service period in months (optional), remarks.
- OFR-03. A student may hold multiple offers, including multiple Accepted offers. Accepting one never auto-declines another.
- OFR-04. Validation: acceptance date required when Accepted and not before the offer date; Joined requires Accepted; joining date required when Joined; a joining date earlier than the acceptance date is rejected.
- OFR-05. Offers are never deleted. Every change is appended to offer history, and Declined and Rescinded offers remain visible.
- OFR-06. The student’s Placements section lists applications, stage progress and offers, with a summary showing placed status and the number of accepted offers.

### 5.9 Student Documents (DOC)

- DOC-01. PDF only, validated by extension and file signature, maximum 25 MB per file (**Decision**).
- DOC-02. Categories: Resume, Marksheet, Certificate, Identity Document, Internship Certificate, Other. An optional title is allowed.
- DOC-03. Multiple PDFs per student, listed with category, name, size, uploaded date and staff.
- DOC-04. In-app preview using the WebView2 PDF viewer, Open in the default PDF application, and Download (save a copy to a chosen location).
- DOC-05. Replacement swaps the file atomically and keeps one metadata record; the old file is removed only after the database change commits. Deletion requires confirmation. Both are audited.
- DOC-06. Files are stored under the application data folder (Section 8.4) with generated names, never the original filename; the database stores category, original name, relative path, size, SHA-256 and upload details.
- DOC-07. The application never creates or edits PDF content for students.

### 5.10 Search and Filtering (SRC)

- SRC-01. Student filters: course, department, batch, passing year, CGPA range, aggregate percentage range, active backlogs (none, any, at least N), placement status (Placed or Not Placed by accepted offer), eligibility status for a chosen drive, company (applied to or placed at), document presence by category, and archived toggle.
- SRC-02. Company filters: name, industry, status, has an active drive. Drive filters: company, academic year, status, date range.
- SRC-03. Filters combine with AND, appear as removable chips, show a result count, and are preserved when returning from a record.
- SRC-04. A global search box searches students, companies and drives and groups the results.
- SRC-05. Any filtered list exports to Excel or PDF using the full result set, not only the visible page (Section 10).
- SRC-06. Search input is debounced (about 250 ms) and backed by indexes (Section 7.4).

### 5.11 Dashboard (DSH)

- DSH-01. Layout and styling follow the supplied design. All values come from the database; no demo values exist anywhere in the product.
- DSH-02. Statistic cards: Total Active Students, Unique Students Placed, Placement Percentage, Active Drives, Total Offers, using the Section 6 definitions with no filters (institution-wide).
- DSH-03. Recent placement activity: the latest 10 events among offer accepted, application Selected and joining recorded, newest first, each linking to its record.
- DSH-04. Upcoming interviews: the next 10 pending scheduled stage results within 30 days, soonest first.
- DSH-05. Quick actions: Add Student, Import Excel, Add Company, Create Drive, Generate Report.
- DSH-06. With an empty database the dashboard shows zeros and short empty-state hints.

### 5.12 Placement Analytics (ANA)

- ANA-01. A filter bar offers academic year, batch, department, company and drive, plus an “Include archived students” toggle (off by default).
- ANA-02. Views: Overview, Departments and Batches, Companies, Conversion, Salary, Trends.
- ANA-03. Charts are simple bars, horizontal funnels and lines, each with a toggle to show the underlying table and an export action.
- ANA-04. Every figure comes from the central metric definitions in Section 6; no view computes its own variant.
- ANA-05. Undefined values (for example a percentage with a zero denominator) display as a dash, and views with no data show a clear empty state.

### 5.13 Other modules

Import/export and reports: Section 10. Settings, backup and recovery: Section 11. Audit history and data integrity: Section 9 and Section 7.5.

## 6. Business Rules and Calculation Definitions

These definitions are authoritative. Dashboard, analytics, reports, exports and search filters MUST all call the same metric functions (one backend module, Section 8.3); no screen may re-implement a metric.

### 6.1 Core definitions

| Term | Definition |
| --- | --- |
| Active student | A student record that is not archived. |
| Placed student | A student with at least one offer whose offer status is Accepted. Selection alone, a Pending offer, or a Declined or Rescinded offer does not make a student placed. |
| Unique students placed | Count of distinct placed students, however many offers each accepted. |
| Total offers | Count of all offer records, any status. |
| Accepted offers | Count of offer records with status Accepted. |
| Joined | An Accepted offer whose joining status is Joined. Joined students (unique) are counted separately from placed students. |
| Selected | An application with final outcome Selected. Never counted as placement. |
| Placement percentage | Unique students placed ÷ active students in scope × 100. |
| Package per placed student | The highest annual salary among that student’s Accepted offers that have a salary recorded. |
| Average, median, highest, lowest package | Computed over the package per placed student. Median of an even count is the mean of the two middle values. Offers with no salary are excluded and the excluded count is displayed. Company-wise and drive-wise views may also show offer-level salaries, labelled as such. |
| Applications | Count of application records. Applicants are distinct students with at least one application. |
| Selection rate | Selected applications ÷ all applications in scope. |
| Stage pass rate | Passed ÷ (Passed + Failed) for a stage; Pending is excluded and Withdrawn is shown separately. |
| Offer acceptance rate | Accepted ÷ (Accepted + Declined); Pending and Rescinded are excluded. |
| Joining rate | Joined ÷ Accepted offers. |
| Active drives | Drives with status Open or In Progress. Draft, Completed and Cancelled are not active. |

**Conversion funnel.** Applied, then each configured stage reached, then Selected, Offered, Accepted, Joined. Each step is shown as a count, a percentage of the previous step and a percentage of Applied. Stages from different drives aggregate by stage type (Aptitude, Technical, Group Discussion, HR, Other), and a single-drive view shows the drive’s own stage names.

**Scope rules for filters.**

- Academic year filters apply to the drive’s academic year, so an offer belongs to the year of its drive, not its offer date.
- Course, department and batch filters apply to the student’s current attributes.
- Company and drive filters restrict the numerator (for example, students with an accepted offer from that company); the denominator for placement percentage remains active students in the course, department and batch scope, and the screen labels it “% of cohort”.
- Percentages display with one decimal place; salaries display in INR with lakh-per-annum (LPA) shown to two decimals; a zero denominator displays a dash.

### 6.2 Eligibility evaluation

For one student and one drive:

1. Skip archived students.
2. Evaluate each set rule and give it a verdict:
   - Allowed course, department, batch, passing year: Pass or Fail from the student’s required fields (always known).
   - Minimum CGPA: Unknown if the student has no recorded CGPA; otherwise Pass if CGPA is at least the minimum.
   - Minimum aggregate percentage (sum of obtained marks ÷ sum of maximum marks over all recorded semesters × 100): Unknown if no semester records exist.
   - Maximum active backlogs: Unknown if the student has neither semester records nor backlog records; otherwise Pass if the active backlog count is at most the limit.
3. Combine: any Fail gives **Ineligible**, even if other rules are Unknown; otherwise any Unknown gives **Needs Review**; otherwise **Eligible**. A criteria set with no rules gives Eligible.
4. Store the computed status and the per-rule explanation.
5. Effective status is the active override if one exists, otherwise the computed status. Overrides persist across recalculation until removed.

Explanation text MUST be human-readable, for example: “Minimum CGPA 6.5: failed (student has 6.1)”, “Maximum active backlogs 0: needs review (no academic data recorded)”.

### 6.3 Academic calculations

- **Semester percentage** = Σ marks obtained ÷ Σ maximum marks × 100 for the semester’s subjects. This is arithmetic on entered marks, not a grading conversion.
- **Aggregate percentage** = Σ obtained ÷ Σ maximum across all recorded semesters.
- **SGPA** is entered per semester by staff and never computed from marks.
- **CGPA** is configured per course in Academic Configuration: **Manual** (default; staff enter the CGPA) or **Mean of SGPAs** (arithmetic mean of recorded SGPAs, shown to two decimals). No other formula is built in, and no marks-to-grade or CGPA-to-percentage conversion exists. Credit-weighted CGPA is a documented future option (Section 16).
- Rounding is half-up at display time; stored values keep the precision entered.

### 6.4 Archive, deletion and history

| Entity | Rule |
| --- | --- |
| Student | Archive by default; permanent deletion only per STU-08. Archived students keep all history. |
| Company | Archive; delete only with no drives. |
| Drive | Cancel rather than delete; no deletion in the interface. |
| Application | Withdraw rather than delete. |
| Offer | Never deleted; status values carry the outcome; changes appended to history. |
| Stage result | Never deleted; changes appended to history. |
| Backlog | Editable and deletable for mistakes, audited; cleared backlogs retained. |
| Document | Deletable with confirmation, audited; recoverable only from backup. |
| Staff account | Deactivated, never deleted. |

**Archived students in reports.** Active counts, dashboard figures, default analytics and default reports exclude archived students. Analytics and every report have an “Include archived students” option that adds them using their preserved records. Their offers, applications and history are never removed. **Decision:** graduated students remain active records, distinguished by batch and passing year; archiving is intended for erroneous, duplicate or no-longer-relevant records.

### 6.5 Validation rules

| Field | Rule |
| --- | --- |
| Registration number | 3 to 30 characters: letters, digits, hyphen, slash, underscore; trimmed; uppercase. |
| Email | Optional; standard address format. |
| Phone | Optional; 7 to 15 digits, optional leading plus, spaces and hyphens tolerated. |
| Date of birth | Not in the future. |
| Passing year | Between 1990 and 2100. |
| Marks | 0 ≤ obtained ≤ maximum; maximum > 0. |
| SGPA, CGPA | 0 to the scale maximum configured for the course (default 10). |
| Salary | Whole number of rupees, zero or greater. |
| Dates | Offer, acceptance and joining dates follow OFR-04; drive registration deadline not after the drive date unless confirmed. |

## 7. Database Entities, Relationships, Constraints and Indexes

### 7.1 Conventions

- Engine: SQLite 3, accessed through the Rust data layer with `PRAGMA foreign_keys = ON`, WAL journal mode and a busy timeout.
- Primary keys: `id INTEGER PRIMARY KEY` on every table. Every principal table has `created_at`, `updated_at` (UTC ISO-8601 text) and `created_by`, `updated_by` (user id).
- Portability: dates are `YYYY-MM-DD` text, timestamps are UTC ISO-8601 text, money is integer rupees, booleans are 0 or 1 with CHECK, enumerations are TEXT with CHECK constraints. Case-insensitive uniqueness uses stored normalized columns (for example `registration_number` stored uppercase, `name_normalized` stored lowercase) rather than SQLite collations, so the schema ports to PostgreSQL or MySQL.
- Foreign keys use ON DELETE RESTRICT, except pure child detail rows (contacts, rule items, subject marks, skills), which CASCADE.
- No business logic in triggers. The only triggers are those that make `audit_log`, `application_stage_history` and `offer_history` append-only.

### 7.2 Entities

**Identity, configuration and operations**

| Entity | Purpose and key columns |
| --- | --- |
| users | username (unique, normalized), display\_name, password\_hash (Argon2id), must\_change\_password, is\_active, failed\_attempts, locked\_until, last\_login\_at |
| app\_security | single row: recovery\_key\_hash, recovery\_rotated\_at |
| settings | scope (GLOBAL or USER), user\_id (nullable), key, value (JSON text); unique on (scope, user\_id, key) |
| institution | single row: name, address, contact details, optional logo path, current\_academic\_year\_id |
| audit\_log | occurred\_at, user\_id, user\_name snapshot, action, entity\_type, entity\_id, summary, before\_json, after\_json, reason; append-only |
| backup\_history | type (Scheduled, Manual, Safety, PreMigration), path, size\_bytes, sha256, status, started\_at, finished\_at, error, app\_version, schema\_version, validated\_at |
| import\_batches | import type, source file name, mapping\_json, counts (imported, skipped, invalid), status, report path, created\_by, created\_at |

**Academic structure**

| Entity | Purpose and key columns |
| --- | --- |
| academic\_years | label (unique, e.g. 2025-26), start\_date, end\_date |
| courses | name (unique), code, duration\_semesters, cgpa\_method (Manual or MeanOfSgpa), grade\_scale\_max |
| departments | course\_id, name, code; unique (course\_id, name) |
| batches | course\_id, label, admission\_year, passing\_year; unique (course\_id, label) |

**Students and academics**

| Entity | Purpose and key columns |
| --- | --- |
| students | registration\_number (unique, uppercase), full\_name, date\_of\_birth, gender, email, phone, alt\_phone, address, course\_id, department\_id, batch\_id, passing\_year, cgpa (nullable), notes, archived\_at, archived\_by, archive\_reason |
| semester\_records | student\_id, semester\_number, sgpa (nullable); unique (student\_id, semester\_number) |
| subject\_marks | semester\_record\_id (CASCADE), subject\_name, subject\_code, marks\_obtained, max\_marks, credits (nullable); CHECK 0 ≤ obtained ≤ max, max > 0 |
| backlogs | student\_id, subject\_name, subject\_code, semester\_number, status (Active or Cleared), cleared\_on, remarks |
| student\_documents | student\_id, category, title, original\_filename, relative\_path, size\_bytes, sha256, uploaded\_at, uploaded\_by |

**Companies**

| Entity | Purpose and key columns |
| --- | --- |
| companies | name, name\_normalized (unique), industry, website, location, description, notes, status, default\_criteria\_set\_id |
| company\_contacts | company\_id (CASCADE), name, designation, email, phone, is\_primary |
| job\_roles | company\_id, title, designation, description, salary\_min, salary\_max |
| job\_role\_skills | job\_role\_id (CASCADE), skill\_name |

**Eligibility**

| Entity | Purpose and key columns |
| --- | --- |
| criteria\_sets | id only plus audit columns; referenced by a company (defaults) or a drive (own copy) |
| criteria\_rules | criteria\_set\_id (CASCADE), rule\_type (MIN\_CGPA, MIN\_PERCENTAGE, MAX\_ACTIVE\_BACKLOGS, ALLOWED\_COURSES, ALLOWED\_DEPARTMENTS, ALLOWED\_BATCHES, ALLOWED\_PASSING\_YEARS), numeric\_value; unique (criteria\_set\_id, rule\_type) |
| criteria\_rule\_items | rule\_id (CASCADE), course\_id, department\_id, batch\_id or passing\_year; CHECK exactly one is set |
| eligibility\_results | drive\_id, student\_id, computed\_status, explanation\_json, computed\_at; unique (drive\_id, student\_id) |
| eligibility\_overrides | drive\_id, student\_id, override\_status, reason, created\_by, created\_at, removed\_at, removed\_by, removal\_reason; at most one active row per (drive, student) |

**Drives and recruitment**

| Entity | Purpose and key columns |
| --- | --- |
| drives | company\_id, academic\_year\_id, title, description, drive\_date, registration\_deadline, status, criteria\_set\_id (unique), notes |
| drive\_job\_roles | drive\_id, job\_role\_id, role\_title and designation snapshots, openings, package override; unique (drive\_id, job\_role\_id) |
| drive\_stages | drive\_id, name, stage\_type, sequence; unique (drive\_id, sequence) |
| applications | drive\_id, student\_id, drive\_job\_role\_id (nullable), applied\_date, final\_outcome, remarks; unique (drive\_id, student\_id) |
| application\_stage\_results | application\_id, drive\_stage\_id, scheduled\_at, outcome, remarks; unique (application\_id, drive\_stage\_id) |
| application\_stage\_history | result id, previous\_outcome, new\_outcome, scheduled\_at snapshot, remarks, changed\_by, changed\_at; append-only |

**Offers**

| Entity | Purpose and key columns |
| --- | --- |
| offers | application\_id, offer\_date, designation, annual\_salary, offer\_status, acceptance\_date, joining\_status, joining\_date, service\_period\_months, remarks |
| offer\_history | offer\_id, changed\_fields\_json, changed\_by, changed\_at; append-only |

### 7.3 Relationships

- Course has many departments and batches. A student belongs to one course, department and batch; a department and batch must belong to the student’s course (enforced by the service layer and tested).
- Student has many semester records (each with subject marks), backlogs, documents and applications.
- Company has many contacts and job roles, and many drives. A drive belongs to one company and one academic year, has one criteria set, many stages, many attached roles, and many applications.
- An application links one student to one drive, has many stage results, and has many offers. Offers reach company and drive through the application, so a student’s offers from different companies stay independent.

### 7.4 Indexes

Unique: `students(registration_number)`, `users(username)`, `companies(name_normalized)`, `academic_years(label)`, `applications(drive_id, student_id)`, `eligibility_results(drive_id, student_id)`, and the unique constraints above.

Search and filter: `students(course_id, department_id, batch_id)`, `students(passing_year)`, `students(archived_at)`, `students(full_name)`, `students(email)`, `students(phone)`; `backlogs(student_id, status)`; `semester_records(student_id)`; `drives(company_id)`, `drives(academic_year_id, status)`, `drives(drive_date)`; `applications(student_id)`, `applications(drive_id, final_outcome)`; `application_stage_results(scheduled_at, outcome)`; `offers(application_id)`, `offers(offer_status, joining_status)`; `student_documents(student_id, category)`; `audit_log(entity_type, entity_id)`, `audit_log(occurred_at)`, `audit_log(user_id)`.

### 7.5 Data integrity and transactions

The following operations MUST execute in a single database transaction, including the audit rows they produce: Excel import commit; student archive, restore and permanent deletion (file removal happens after commit); eligibility criteria save with recalculation; override create and remove; stage result change with its history; offer save with offer history; document replacement (database part); user creation and password change; backup restore (Section 11.5); schema migrations.

Integrity MUST also be enforced above the database: marks and date rules, department and batch consistency with course, eligibility preconditions for applications, and joining requiring acceptance. Referential problems found at startup integrity checks are reported, never silently repaired.

### 7.6 Migrations

Schema changes are numbered, forward-only SQL migrations embedded in the application and applied at startup. Each migration runs in a transaction. Before applying any pending migration to a database containing data, the application takes an automatic PreMigration backup. A migration that fails rolls back, leaves the previous database untouched, and shows a clear error. A database newer than the application is refused with guidance to install the newer version.

## 8. Technical Architecture

### 8.1 Responsibilities

**Frontend (React and TypeScript)** owns presentation, navigation, form behavior and immediate input feedback, table and filter state, charts, theme handling, and PDF report rendering. It never touches the database or the file system directly and never receives password hashes.

**Backend (Rust, Tauri 2)** owns everything authoritative: authentication and sessions, all data access, validation, business rules, the eligibility engine, metric calculation, Excel parsing and writing, document file storage, backups and restore, migrations, audit writing, and logging. The frontend calls typed Tauri commands; it passes record identifiers, never file paths of its own invention.

### 8.2 Recommended stack and libraries

| Concern | Recommendation | Notes |
| --- | --- | --- |
| Build tooling | Vite, TypeScript in strict mode, ESLint, Prettier |  |
| Routing and server state | React Router, TanStack Query | Query keys per feature; invalidate on mutation |
| Tables | TanStack Table | Server-side sorting, filtering and pagination |
| Forms and validation | React Hook Form with Zod | Zod schemas mirror backend rules; the backend remains authoritative |
| UI state | Minimal Zustand store (theme, session summary) | Avoid global state for data |
| Styling | CSS variables for theme tokens, with the styling approach that matches the supplied design (Tailwind CSS and Radix-based primitives are the recommended default) | Must reproduce the supplied design, not reinterpret it |
| Charts | Recharts | Bars, lines and funnel-style horizontal bars |
| Dates | date-fns | Display formats come from settings |
| Typed command bindings | tauri-specta (SHOULD) | Generates TypeScript types from Rust commands |
| Database access | sqlx (SQLite) with embedded migrations | Same crate supports PostgreSQL and MySQL later |
| Async and errors | tokio, thiserror, serde |  |
| Password hashing | argon2 (Argon2id), zeroize |  |
| Excel read | calamine (xlsx, xls) and csv | Reads cached cell values; formulas are never evaluated |
| Excel write | rust\_xlsxwriter | User text is always written as strings |
| Archives and hashes | zip, sha2 | Backup files and checksums |
| Logging | tracing, tracing-appender | Daily rolling files |
| PDF reports | pdfmake in the frontend report module (**recommended**) | Declarative tables, repeating headers, page numbers; embed a Unicode font; charts rasterized from SVG to PNG. See Section 16 |
| Document preview | WebView2 built-in PDF viewer, and the default PDF application | No third-party viewer library needed |
| Tauri plugins | dialog, opener (scoped), single-instance | The shell and general file-system plugins are not enabled |

### 8.3 Backend structure

Four layers with one-way dependencies:

1. **Commands** (thin): authenticate the session, deserialize and basic-validate input, call a service, map errors.
2. **Services** (use cases): own transaction boundaries, orchestrate repositories and the domain, write audit entries.
3. **Domain** (pure functions, no I/O): validation rules, the eligibility engine, academic calculations and metric definitions. Fully unit-testable.
4. **Repositories**: one trait per aggregate (students, academics, companies, drives, applications, offers, documents, users, audit, settings, backups) with a SQLite implementation. SQL lives only here, uses bound parameters, and avoids SQLite-only features (or isolates them in a small dialect helper), which keeps migration to PostgreSQL or MySQL practical.

A single **metrics module** implements every definition in Section 6.1 over one shared scope object (academic year, batch, department, company, drive, include-archived). The dashboard, analytics, reports, and exports all call it. Frontend code and report code format numbers but never compute them.

Frontend source is organized by feature (students, academics, companies, drives, applications, offers, documents, analytics, reports, settings, auth, shared UI), each with its API client wrapper, query hooks, schemas, components and pages.

Long operations (import, export, report data, backup, restore) run as background tasks that report progress events, so the interface stays responsive. Restore, migration and import commit take an exclusive lock that blocks other writes. Only one application instance may run per data folder.

**Startup sequence:** acquire single-instance lock, locate the data folder, open the database, run a quick integrity check, take a PreMigration backup if migrations are pending, migrate, run a missed scheduled backup if one is due, then show setup or sign-in.

### 8.4 Persistent data locations and file storage

All user data lives outside the install folder, under `%LOCALAPPDATA%\PlacementAnalyzer\` by default (**Decision**: local rather than roaming profile, because PDFs and backups can be large):

| Path | Contents |
| --- | --- |
| `bootstrap.json` | Data folder pointer and last-used theme for the sign-in screen (the only setting needed before the database opens) |
| `data\placement.sqlite` | Database (plus WAL files) |
| `documents\students\<student id>\<uuid>.pdf` | Student PDFs, generated names only |
| `backups\` | Default backup location (an external location is recommended) |
| `logs\` | Rolling log files |
| `staging\` | Temporary area for restore, import and atomic file operations; cleaned at startup |

The database stores relative paths for documents so the whole data folder is relocatable. Uninstalling or updating the application never deletes this folder. The data location is displayed in Settings; moving it is done through backup and restore on the target machine.

### 8.5 Settings storage

Settings persist in the `settings` table (global and per-user scopes, Section 7.2), with typed accessors and validated defaults. Theme changes apply immediately and are saved at once. `bootstrap.json` mirrors the last theme so the sign-in screen matches.

### 8.6 Error handling and logging

- Backend errors use one `AppError` type with codes (Validation, NotFound, Conflict, Unauthenticated, Io, Database, Internal) serialized to the frontend. Validation errors carry field names so forms can highlight them.
- Users see short, actionable messages. Technical detail and stack context go to the log, never to the interface.
- A global error boundary catches rendering failures and offers to return to the dashboard, noting the log location.
- A panic hook records unexpected failures. Transient SQLite busy errors are retried briefly.
- Logs use the default level Info, rotate daily, keep 14 days, and never contain passwords, recovery keys or document contents. Identifiers are preferred over personal names in log lines.

## 9. Security, Privacy and Data Integrity

**Context.** A single Windows computer used by several staff members, handling personal student data. The main risks are unauthorized use, accidental deletion, corruption, lost or stolen devices, and malicious or malformed files.

### 9.1 Authentication and sessions

- Argon2id with tuned parameters (target roughly 250 ms on the target hardware), unique salt per account, constant-time comparison.
- The session is an opaque token held in Rust memory and never persisted; all commands except setup, sign-in and recovery require a valid session.
- The recovery key is a randomly generated high-entropy string, shown once and stored only as a hash.
- Lockout per AUTH-03. Password changes and recoveries invalidate other sessions.

### 9.2 Application boundary

- Strict Content Security Policy with no remote scripts, styles, fonts or images; developer tools disabled in release builds.
- Minimal Tauri capability set. The frontend has no direct file-system or shell access. File pickers use the dialog plugin; the backend validates every selected path. The opener is scoped to the documents and export folders.
- The application makes no outbound network connections in V1 and sends no telemetry.

### 9.3 Input and file handling

- All SQL uses bound parameters.
- Excel and CSV input is size-limited (20 MB, 20,000 rows), macro-enabled files (.xlsm) are rejected, and cell formulas are never evaluated. Exported user text is written as plain strings so it cannot execute as a spreadsheet formula.
- PDFs are checked by signature, size-limited and stored under generated names. They are rendered only by the system PDF viewer, never executed or parsed by application code beyond storage.
- Filenames from users are sanitized before use in any save dialog default.

### 9.4 Privacy and storage protection

- Student data stays on the local computer; backups contain personal data and should be kept on trusted, preferably encrypted, media.
- **Decision:** V1 does not encrypt the database or PDFs at the application level (it complicates recovery and later migration). The release documentation MUST recommend Windows BitLocker for the data drive and any external backup drive. Encryption at rest is listed in Section 15.

### 9.5 Audit history

Audit entries are written in the same transaction as the change they describe (Section 7.5), are append-only, and capture who, when, what changed (before and after), and the reason where one is required. Audited events: student create, edit, archive, restore, delete and registration number change; marks, SGPA, CGPA and backlog changes; company and drive create, edit and cancel; eligibility criteria changes; eligibility overrides and removals; application outcome changes and bulk actions; stage result changes; offer changes; document upload, replace and delete; account creation, deactivation, password changes and recovery; imports; backup, restore and migration events; institution and backup setting changes.

A read-only **Audit History** screen under Settings filters by date, staff member, entity type and action, and exports to Excel. Student, drive and offer screens show an entity-level history panel drawn from the same data.

### 9.6 Data integrity checks

At startup the application runs `PRAGMA quick_check` and `foreign_key_check`. Settings shows database status and offers an on-demand check that also verifies every document record has its file and reports unreferenced files. Problems are reported, never silently repaired. The constraints, transactions and archive-first rules of Sections 6.4 and 7 apply throughout.

## 10. Import, Export and Reporting Requirements

### 10.1 Excel import

**Framework.** Imports follow one pipeline: select file, parse, map columns, validate, preview, commit, report. Each importer is a definition (target fields with header aliases, validators, duplicate matcher, committer), registered with a shared wizard, so company and placement data importers can be added later without changing the wizard.

**V1 importers.** (1) **Students**: registration number, full name, date of birth, gender, email, phone, alternate phone, address, course, department, batch, passing year. (2) **Academic Records**, in two modes: **Marks** (long format, one row per student, semester and subject: registration number, semester, subject name, subject code, marks obtained, maximum marks, optional credits, optional SGPA, optional CGPA) and **Backlogs** (registration number, subject name, subject code, semester, status, cleared date, remarks). Downloadable templates are provided for each.

**Behavior.**

- Accepted files: .xlsx, .xls and .csv (UTF-8). The user picks the sheet and header row where relevant.
- Column mapping is auto-suggested from header aliases; required fields must be mapped; unmapped columns are ignored.
- Validation applies Section 6.5. Course, department and batch values must match existing records; the importer never creates them and reports unknown values as invalid.
- Each row gets one status: Valid, Warning (imports with a notice), Duplicate (matches an existing record), Invalid (with reasons). Repeated keys within the file are flagged, with the first occurrence kept.
- The duplicate policy is chosen per import: **Skip** (default) or **Update existing** (Students: updates mapped non-empty fields; Marks: replaces that subject’s values within the semester; Backlogs: matches on registration number, subject and semester).
- The preview shows counts by status, a paginated and filterable table, and a download of invalid rows. Nothing is saved before the user confirms.
- Commit writes all valid rows in one transaction; if it fails, nothing is saved. Invalid and skipped rows never block valid ones.
- The result reports imported, updated, skipped and invalid counts with row numbers and reasons, offers a downloadable Excel report, records an import batch and audit entry, and triggers eligibility recalculation.
- Imports run in the background with a progress indicator.

### 10.2 Excel export

- Any filtered list (students, companies, drives, applications, eligible students, offers) exports its full filtered result set, produced by the same query and filters as the screen.
- Workbooks contain a styled header row, frozen top row, autofilter and sensible column widths. Dates are real Excel dates formatted per the configured format; numbers are numeric.
- A second sheet records filters applied, generation time and staff member.
- Files are named `<Name>_<YYYY-MM-DD_HHmm>.xlsx` and saved to the default export folder or a chosen location, with Open and Show in folder actions. Files are written to a temporary name and renamed on success.

### 10.3 Reports

Each report is available as PDF and Excel; the default format comes from Settings. Each accepts the relevant filters (academic year, course, department, batch, company, drive, student) and an Include archived students option, and uses saved database data through the metrics module.

| ID | Report | Content |
| --- | --- | --- |
| R1 | Student academic record | Semester marks, percentages, SGPA, CGPA, backlogs; for one student or a filtered cohort |
| R2 | Student placement history | Applications, stage progress, offers, acceptance and joining per student |
| R3 | Company-wise recruitment | Drives, applicants, selections, offers, accepted, joined, packages per company |
| R4 | Department and batch outcomes | Active students, applicants, placed, offers, placement percentage, package statistics |
| R5 | Candidate status | Selected, rejected, pending and withdrawn candidates by drive or company |
| R6 | Semester performance | Semester-wise averages and distribution, active backlog counts |
| R7 | Salary analysis | Average, median, highest, lowest package; distribution; by department, company and year |
| R8 | Interview-stage conversion | Funnel counts and rates per stage (Section 6.1) |
| R9 | Historical comparison | Year-over-year placed students, offers, placement percentage, packages |

**PDF layout rules.** A4 page, orientation chosen per report. Every page header shows the institution name (and logo if set), report title and applied filters; every footer shows generation date and time, staff member, and page number of total. A summary block of key figures leads each report. Tables repeat their header row across pages. Charts (R4, R7, R8, R9) are embedded images. Headings use the burgundy accent from the design tokens; body styling is neutral and print-friendly. A report is written to a temporary file and renamed on success, so a failed run never leaves a partial file. Generation shows progress and can be cancelled.

## 11. Settings and Backup/Recovery

### 11.1 Settings

| Group | Setting | Scope and default |
| --- | --- | --- |
| Appearance | Theme: Light, Dark, System | Per user; System; applies immediately |
| Appearance | Table density: Comfortable, Compact | Per user; Comfortable |
| Appearance | Default landing page | Per user; Dashboard |
| Regional | Date format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MMM-YYYY | Global; DD/MM/YYYY |
| Institution | Name, address, contact details, optional logo | Global |
| Academic configuration | Academic years and the current academic year; courses with duration in semesters, CGPA method and grade scale maximum; departments; batches | Global |
| Backup | Schedule (Off, Daily, Weekly), time and weekday, backup location, number of scheduled backups to keep | Global; Daily, 10 kept |
| Export | Default export folder, default report format (PDF or Excel) | Global; Documents\\Placement Analyzer Exports, PDF |
| Information (read-only) | Application version, schema version, database status, data location |  |

Staff accounts, Audit History, manual backup and restore, and backup history are screens within Settings. No other settings exist in V1.

### 11.2 Backup contents and format

A backup is a single `.pabackup` archive (a zip) named `PlacementAnalyzer_<YYYY-MM-DD_HHmmss>_<type>.pabackup` containing `manifest.json` (application and schema versions, timestamp, type, record counts, SHA-256 of every file), `placement.sqlite` (a consistent snapshot created with SQLite’s online backup mechanism, never a copy of the live file), and all `documents` files. Archives are written under a temporary name and renamed after validation.

### 11.3 Scheduling, location and retention

- Scheduled backups run while the application is open and, at startup, a missed scheduled backup runs immediately. No background service exists in V1; the settings screen states this plainly.
- The backup location may be local, external or a network path. It is tested for writability when set. If it is unavailable at backup time the backup fails visibly and is retried at the next trigger; there is no silent fallback to another folder.
- Retention removes only the oldest Scheduled backups beyond the configured number. Manual backups are never removed automatically. Safety and PreMigration backups keep the latest five of each type.
- A free-space check (about twice the combined database and documents size) precedes every backup and restore.
- Failures show a banner on the dashboard until acknowledged and are recorded in backup history.

### 11.4 Integrity validation

After creation, each backup is validated: the archive opens, every file matches the manifest checksum, the database snapshot passes `PRAGMA integrity_check`, and the document count matches. The result is stored in backup history. A Validate action re-runs this on any backup in history or on any selected file.

### 11.5 Restore

1. The user picks a backup from history or browses to a file. It is validated (11.4) and its schema version is checked: newer than the application is refused; older is allowed and migrated after restore.
2. A summary (creation date, application version, record counts) and a clear warning are shown; the user types RESTORE to confirm.
3. A **Safety backup** of the current data is created and validated. If this fails, the restore stops and nothing changes.
4. The backup is extracted to the staging folder and its database and documents are verified there.
5. Connections are closed, the current database and documents folder are set aside intact, and the verified staging data is moved into place.
6. The database is reopened and migrated if needed. If any step after the swap fails, the original data is restored from the set-aside copy automatically; if that also fails, the user is directed to the Safety backup and the failure is logged in detail.
7. The application returns to the sign-in screen. Accounts and passwords are those in the restored data; the restore is recorded in the log and in the audit history of the restored database.

Current data is never overwritten until the staged copy has been verified, and an unsuccessful restore never leaves the user with partial data.

### 11.6 Backup history

The history lists date, type, size, status and validation result, with Validate, Restore and Show in folder actions. The same safe-write pattern (temporary file, verify, atomic rename) applies to every file the application produces: exports, reports, backups and documents.

## 12. Major Development Phases and Acceptance Criteria

Implementation proceeds in five major phases. Each phase is delivered as a coherent increment against its own acceptance criteria; individual screens, forms and fields are not separate phases or prompts. Phases build on each other in order. Work in Phases 1 to 4 runs in development mode; production packaging happens only in Phase 5, after core functionality is implemented and tested.

| Phase | Objective | Depends on |
| --- | --- | --- |
| 1. Foundation | A running, secure, themed application skeleton on the final schema | Supplied UI design, toolchain |
| 2. Core Management | All operational record-keeping workflows working end to end | Phase 1 |
| 3. Analytics and Reporting | Trustworthy numbers, search, import/export and reports | Phase 2 |
| 4. Application Completion | Settings, backup/recovery, integrity and full workflow testing | Phases 1 to 3 |
| 5. Release | Production build, Windows installer and verified release | Phase 4 |

### Phase 1: Foundation

**Objective.** Establish the architecture, schema and security base so later phases add features without rework.

**Grouped tasks.**

- Project setup: Tauri 2 with Vite, React and strict TypeScript; lint, format and test tooling; feature-based frontend layout; Rust workspace layout with commands, services, domain and repositories.
- Database: the complete V1 schema from Section 7 as numbered migrations, repository base, connection setup (foreign keys, WAL, busy timeout), append-only triggers, startup sequence with quick integrity check.
- Configuration: data folder resolution, `bootstrap.json`, settings service (global and user scopes), single-instance lock.
- Cross-cutting: `AppError`, logging, audit service, typed command bindings.
- Application shell implementing the supplied design: navigation, light, dark and system themes applied immediately, density tokens.
- Authentication: first-time setup with recovery key, sign-in, sign-out, lockout, password change, staff account management basics, recovery flow.

**Acceptance criteria.**

- Application starts in development mode, creates the data folder and database on first run, and applies migrations idempotently.
- First-run setup is available only when no accounts exist; sign-in, lockout, password change and recovery behave as AUTH-01 to AUTH-07.
- Audit tables reject updates and deletes in tests.
- Theme switches without restart and persists; the shell matches the supplied design in both themes.
- A failing migration leaves the previous database untouched (tested).
- Rust and TypeScript test suites pass; lint is clean.

### Phase 2: Core Management

**Objective.** Deliver every operational workflow (W2 to W5) with correct rules, history and auditing.

**Grouped tasks.**

- Academic configuration screens (academic years, courses, departments, batches).
- Students: create, edit, list with search, sorting and pagination, archive, restore, restricted deletion, three-section profile.
- Academic records: semesters, subject marks, SGPA, CGPA methods, backlogs with cleared history, validation.
- Companies: details, contacts, job roles and skills, default criteria.
- Drives: details, roles, criteria copy, configurable stages, status handling.
- Eligibility: rule engine, explanations, overrides, automatic and manual recalculation.
- Applications, stage pipeline with history, bulk actions; offers, acceptance and joining with history.
- Documents: PDF upload, categories, preview, open, download, replace and delete with file storage outside the database.

**Acceptance criteria.**

- Workflows W2 to W5 run end to end on real data with no placeholder values.
- Duplicate registration numbers are rejected case-insensitively; archived duplicates are identified with a Restore option.
- Eligibility unit tests cover every rule, every verdict combination and the precedence of Section 6.2; missing data yields Needs Review, never Ineligible; overrides persist across recalculation; recalculation triggers fire on the events in ELG-05.
- Active backlog counts update automatically; cleared backlogs remain visible.
- A student with several Accepted offers counts once as placed, and each offer counts in Total offers; Selected alone never counts as placed (tested).
- Applications and offers preserve history; nothing in the interface deletes them.
- Documents are stored outside SQLite with generated names; replace and delete are atomic and audited.
- Every consequential change in Section 9.5 writes an audit entry in the same transaction.

### Phase 3: Analytics and Reporting

**Objective.** Make every figure trustworthy and make data easy to find, bring in and take out.

**Grouped tasks.**

- Metrics module implementing Section 6.1 with shared scope filters and exhaustive tests.
- Dashboard with statistics, recent activity, upcoming interviews and quick actions.
- Global search and combined filters on students, companies and drives, with filtered exports.
- Analytics views and charts (Section 5.12).
- Excel import framework with the Students and Academic Records importers, templates and result reports; Excel export framework.
- PDF reports R1 to R9 and Excel equivalents, including a spike early in the phase to confirm Unicode fonts and chart rasterization (Section 16, U1).

**Acceptance criteria.**

- Dashboard, analytics, reports and exports agree exactly for identical filters (SC-02), verified by automated cross-checks on a seeded dataset.
- Import follows Section 10.1 exactly: preview before saving, mapping, duplicate policies, per-row statuses, all-valid-rows transaction, downloadable result report.
- Search, filter, sort and pagination meet SC-03; analytics and reports meet SC-04; import meets SC-05.
- Each report renders with the layout rules of Section 10.3, repeats table headers across pages, shows applied filters, and never leaves a partial file on failure.
- Archived-student handling matches Section 6.4 in every view and report.

### Phase 4: Application Completion

**Objective.** Make the application safe to rely on daily.

**Grouped tasks.**

- Settings screens, staff accounts screen, Audit History screen with export.
- Backup, validation, scheduling, history, safety backups and restore (Section 11), including startup catch-up.
- Startup and on-demand integrity checks and the database status display.
- Integration pass: cross-module consistency, recalculation triggers, error states, empty states, keyboard navigation, performance tuning against the Section 2 targets.
- Workflow testing: automated end-to-end tests of W1 to W7 and fault-injection tests for backup, restore, migration, import and file operations.

**Acceptance criteria.**

- Settings persist across restarts; theme applies immediately; each setting in Section 11.1 works and no others exist.
- Backups validate (SC-07); failed restores and migrations leave current data intact in every fault-injection case (SC-08); restore creates a verified Safety backup first.
- Scheduled and missed-schedule backups run as specified; unavailable locations fail visibly without fallback.
- All success criteria in Section 2 are met on a representative seeded dataset.
- No open critical or high-severity defects.

### Phase 5: Release

**Objective.** Ship a verified Windows installer with documentation.

**Grouped tasks.**

- Production build and bundle configuration; application identity, icons and version.
- NSIS installer, WebView2 handling, install and upgrade behavior, data-preservation checks.
- Final verification on clean Windows 10 and Windows 11 machines.
- Release documentation (Section 14) and release notes.

**Acceptance criteria.**

- Installer installs, launches, upgrades over the previous version and uninstalls without touching the data folder.
- Upgrade with pending migrations takes a PreMigration backup and succeeds; downgrade is refused safely.
- Full regression and the end-to-end workflow suite pass against the production build on both Windows versions.
- Documentation delivered; open decisions in Section 16 are resolved or explicitly accepted.

## 13. Testing Strategy

| Level | Scope | Tooling (recommended) |
| --- | --- | --- |
| Unit (Rust) | Domain rules: validation, eligibility engine, academic calculations, metric definitions, import validators | cargo test, table-driven cases |
| Integration (Rust) | Services and repositories against a temporary SQLite database with real migrations; transaction rollback; audit writes; backup, restore and migration paths | cargo test with temp directories |
| Frontend unit and component | Schemas, hooks, forms, tables, theme handling | Vitest, React Testing Library |
| End to end | Workflows W1 to W7 against the running application | Playwright through tauri-driver with WebView2 driver |
| Report and export checks | Golden-file comparison of Excel output; PDF content and layout checks on a seeded dataset | Scripted comparison; manual visual review per release |
| Performance | Seeded dataset of 20,000 students and 200,000 related records against SC-03 to SC-06 | Dev-only seed generator (synthetic data, never shipped) |
| Fault injection | Power-loss simulation during backup, restore, migration, import and document replacement; full disk; unavailable backup location; corrupt backup file | Scripted failure points |
| Migration | Every released schema version upgraded to the current one with data | Fixture databases per version |
| Manual and acceptance | Usability pass by placement-cell staff using the Section 4 workflows; keyboard and contrast checks; clean-machine install | Checklist |

Rules: all metric and eligibility behavior must be covered by unit tests before UI work depends on it; the cross-check tests for SC-02 run on every change to the metrics module; synthetic data only is used in tests and demos.

## 14. Release and Packaging Strategy

- **Format. Decision:** a per-user NSIS installer is the primary deliverable (no administrator rights needed; Start menu shortcut; clean uninstall). A bare executable is not distributed, because it needs the WebView2 runtime, has no uninstaller, and gives no safe update path; the data-outside-the-executable rule is satisfied either way.
- **WebView2.** The installer includes the WebView2 runtime handling (embedded bootstrapper recommended; offline installer if target machines lack internet access, see Section 16, U7).
- **Data safety.** The installer and uninstaller never delete the data folder. Updates are applied by running a newer installer with the application closed. First launch after an update runs migrations behind a PreMigration backup (Section 7.6). An older application refuses a newer database.
- **Versioning.** Semantic application version, shown in Settings; the schema version is tracked separately and recorded in backup manifests.
- **Build timing.** Packaging is excluded from ordinary development. Production builds begin in Phase 5 after core functionality is implemented and tested.
- **Signing.** Code signing of the installer is recommended to avoid operating-system warnings; the certificate decision is open (U6).
- **Release documentation.** Installation guide; short user guide organized by workflow W1 to W7; backup and restore guide; local password recovery procedure (using the recovery key, and the backup fallback); upgrade guide; BitLocker recommendation; troubleshooting and log locations; release notes with known limitations.
- **Release checklist.** Clean-machine install; first-run setup; sample data workflow; backup then restore on a second machine; upgrade over a previous version with data; uninstall with data retained; documentation review.

## 15. Future Upgrade Considerations

None of the following is implemented in V1. The V1 design avoids closing these doors:

- **Central database (PostgreSQL or MySQL).** Data access is isolated behind repository traits; sqlx supports all three engines; the schema uses portable types, UTC timestamps, normalized uniqueness columns and no business logic in triggers; paths are stored relative. A one-time migration utility would copy tables with identifiers preserved.
- **LAN access and a central application service.** Services are written without Tauri types so the same use-case layer can be hosted behind a network API, with desktop clients becoming thin. Sessions would move to server-issued tokens. Documents would move to shared storage with the same relative paths. Backups would become a server responsibility.
- **Concurrency.** Multi-user editing will need optimistic concurrency; `updated_at` and `updated_by` columns already exist, and a row-version column can be added in a later migration.
- **Advanced permissions.** Authorization checks are centralized at the command layer and audit records carry stable user identifiers, so roles and permissions can be added without restructuring. V1 settings already separate global from per-user scope.
- **Other candidates.** Encryption at rest, company and placement data importers, credit-weighted CGPA, additional eligibility inputs, off-campus offers, an automatic updater, and Windows Task Scheduler-based backups.

## 16. Assumptions, Dependencies and Unresolved Technical Decisions

### 16.1 Assumptions

- A1. Target platform: 64-bit Windows 10 (version 1809 or later) and Windows 11, with the WebView2 runtime present or installed.
- A2. One institution; currency is Indian rupees; salaries are annual; default date format DD/MM/YYYY; semester-based programs.
- A3. One computer, used by one staff member at a time (several accounts, but no simultaneous use).
- A4. Scale up to 20,000 students and 200,000 related records.
- A5. Every offer arises from an application to a recorded drive. Off-campus or direct offers are not modeled.
- A6. A placed student is one with an Accepted offer, regardless of joining.
- A7. Default grade scale maximum is 10 and is configurable per course.
- A8. Staff supply marks, SGPA, CGPA and backlogs; the application does not convert between grading systems.

### 16.2 Dependencies

- The supplied UI design (screens and design tokens), needed before the Phase 1 shell.
- Rust stable toolchain with MSVC build tools, Node.js LTS, and an environment where Antigravity can build and run Tauri on Windows.
- Windows 10 and Windows 11 clean test machines or virtual machines.
- Sample Excel files from the institution to align importer templates and header aliases.

### 16.3 Unresolved decisions, with recommendations

| ID | Decision | Recommendation |
| --- | --- | --- |
| U1 | PDF report engine | pdfmake in the frontend, validated by an early spike on Unicode fonts and chart images; fall back to @react-pdf/renderer if needed |
| U2 | Additional eligibility inputs (10th, 12th or diploma-entry percentages) | Not in V1, since the brief lists academic thresholds only; adding later is nullable student fields plus new rule types, with no architectural change. Confirm whether recruiters you serve require them |
| U3 | Credit-weighted CGPA | Defer; optional subject credits are already captured |
| U4 | Off-campus and direct offers | Defer; if needed, add a direct-offer type that skips the drive requirement |
| U5 | Package metric convention | Highest Accepted offer per placed student (Section 6.1), with offer-level views in company reports; confirm with the placement cell |
| U6 | Code signing certificate | Obtain one before wide distribution; unsigned installers trigger warnings |
| U7 | WebView2 distribution mode | Embedded bootstrapper by default; offline installer if machines have no internet |
| U8 | Styling stack | Tailwind with Radix-style primitives unless the supplied design was built on a different system; confirm before Phase 1 |
| U9 | Scheduled backups only while the application is running | Accept for V1 with startup catch-up; revisit a Task Scheduler helper later |
| U10 | Moving the data folder | Manual via backup and restore in V1; no in-app relocation |
