# MeritBridge 🎓🌉

> **Autonomous Placement & Internship Management System**  
> *Engineered for Polytechnic Colleges & Technical Institutes · 100% Offline-First*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%7C%20TypeScript-61dafb.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind%20CSS%203.4-38bdf8.svg)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%206-646cff.svg)](https://vitejs.dev/)
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%20v2-24c8db.svg)](https://tauri.app/)
[![Offline First](https://img.shields.io/badge/Data-IndexedDB%20Offline%20First-green.svg)](#offline-first-architecture)

---

## 📌 Overview

**MeritBridge** is an offline-first institutional management console crafted specifically for placement cells, training & placement officers (TPOs), and department coordinators in technical institutions and polytechnic colleges.

It streamlines the entire campus recruitment lifecycle: from student academic verification and eligibility filtering to multi-round interview stage tracking, company relationship management, and industry internship monitoring.

---

## ✨ Key Capabilities

### 🎓 1. Student Academic & Batch Roster
- **Multi-Department Support**: Preconfigured for Mechanical (ME), Automobile (AE), Electrical (EE), and Computer Science (CSE) engineering disciplines.
- **Academic Verification**: Real-time CGPA tracking, active backlog counting, semester GPA histories, and document record management.
- **Bulk Operations**: Universal Excel/CSV roster import with automated schema mapping and instant data validation.

### 💼 2. Placement Drive Pipeline & Intelligent Eligibility Engine
- **Department-Restricted Drives**: Compulsory branch targeting per placement drive with automatic pre-fill based on company partner profiles.
- **Automated Rule Evaluation**: Computes real-time student verdicts (`Eligible`, `Ineligible`) against complex criteria sets (Min CGPA, Max Active Backlogs, Allowed Departments, Passing Year).
- **Dual Selection Workflows**:
  - **Auto-Enroll All Eligible**: One-click bulk enrollment of all qualified candidates.
  - **Granular Multi-Select**: Custom selection checkboxes to enroll specific candidates (including manual exceptions for students with specialized skills).
  - **Audit Overrides**: Administrative override controls with mandatory justification logging.

### 🛠️ 3. Dedicated Internship Manager
- **Status Lifecycle**: Track students across `Active`, `Completed`, or `None` internship stages.
- **Corporate Details**: Record hosting company, technical role, duration, and supervisor notes.
- **Departmental Analytics**: Instant breakdown of student industry participation per branch.

### 🏢 4. Corporate Partner Directory
- **Relationship Tracking**: Company directory with primary HR contacts, visit history, and targeted departments.
- **Job Role Matrix**: Minimum and maximum compensation packages, required technical competencies, and tier classification.

### 📊 5. Institutional Analytics & Reports
- **Executive KPI Dashboard**: Total registered candidates, overall placement conversion rates, active drives, and department-wise recruitment ratios.
- **Interactive Visualizations**: Stage transition funnels, department placement distributions, and company offer metrics.
- **Audit Compliance**: System-wide immutable action log tracking every eligibility override, enrollment, and grade modification.

---

## 🏛️ Offline-First Architecture

MeritBridge operates entirely on the client machine without external cloud dependencies:
- **Zero Cloud Leakage**: Student academic records and institutional placement statistics remain strictly confidential on the local machine.
- **IndexedDB Multi-Gigabyte Storage**: Robust local database layer supporting tens of thousands of student records and audit trails.
- **Instant Search & Response**: Zero-latency filtering, search, and criteria evaluation powered by in-memory reactive state.
- **Backup & Restore**: One-click JSON backup export and restore mechanism with integrity checks.

---

## 🌿 Repository Branch Structure

This repository is maintained in two distinct branches to serve both production deployments and evaluation demos:

| Branch | Intended Use | Dataset Contents |
| :--- | :--- | :--- |
| **`main`** | **Production Clean** | Clean institutional schema with admin credentials and department structures, but **zero student, company, or drive records** — ready for immediate institutional rollout. |
| **`meritbridge`** | **Evaluation & Demo** | **Rich Sample Dataset** pre-loaded with 40 students across 4 departments (ME, AE, EE, CSE), active internships, 10 companies, and active placement drives for testing and evaluation. |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` (v9 or higher)

### Installation & Local Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/varadanvinodshanbhag-netizen/Merit-bridge.git
   cd Merit-bridge
   ```

2. **Install frontend dependencies:**
   ```bash
   cd meritbridge
   npm install
   ```

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

4. **Default Administrator Credentials:**
   - **Username:** `admin`
   - **Password:** `admin`

---

## 📦 Desktop Application (Windows)

For institutions seeking an air-gapped, standalone executable that requires no Node.js or browser setup:
- Navigate to the [Releases](https://github.com/varadanvinodshanbhag-netizen/Merit-bridge/releases) section of this repository.
- Download **`MeritBridge-Setup.exe`**.
- Run the 1-click setup installer to deploy the application with built-in runtime and desktop shortcuts.

---

## 🛠️ Tech Stack

- **Core Framework:** React 18 + TypeScript
- **Build Tooling:** Vite 6
- **Styling:** Tailwind CSS 3.4
- **State Management:** Zustand
- **Icons:** Lucide React
- **Data Visualizations:** Recharts
- **Spreadsheet Processing:** XLSX (SheetJS)
- **Desktop Runtime:** Tauri v2 (Rust) / WinForms Native Shell

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) — see the LICENSE file for details.

---

Developed for **RNS Rural Polytechnic, Murdeshwar** and technical institutions nationwide.
