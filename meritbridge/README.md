# MeritBridge

**Placement Management & Analytics** — *Connecting Talent with Opportunity.*

A Windows desktop application for college placement cells. Built with **Tauri 2** (Rust backend) + **React + TypeScript** frontend.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 LTS |
| Rust (stable) | ≥ 1.77 |
| MSVC Build Tools | 2019 or 2022 |
| WebView2 Runtime | Installed on Windows |

Install Rust: https://rustup.rs  
Install Node.js: https://nodejs.org

---

## Getting Started

```bash
# 1. Install frontend dependencies
npm install

# 2. Start development (Tauri + Vite HMR)
npm run tauri dev

# 3. Build for production (creates installer in src-tauri/target/release/bundle)
npm run tauri build
```

> **Note:** Rust must be installed before running Tauri commands.  
> The application is still under active development — do not distribute production builds yet.

---

## Project Structure

```
meritbridge/
├── src/                    # React + TypeScript frontend
│   ├── components/
│   │   ├── brand/          # MeritBridgeLogo, brand assets
│   │   └── layout/         # AppShell, Sidebar, Header
│   ├── pages/              # Feature pages (dashboard, students, …)
│   ├── store/              # Zustand stores (auth, theme)
│   └── index.css           # Design tokens (CSS variables)
├── src-tauri/              # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── vite.config.ts
└── tailwind.config.js
```

---

## Branding

| Element | Value |
|---------|-------|
| Product name | **MeritBridge** |
| Category | PLACEMENT MANAGEMENT & ANALYTICS |
| Tagline | Connecting Talent with Opportunity. |
| Primary accent | `#9e2040` (burgundy) |
| Data folder | `%LOCALAPPDATA%\MeritBridge\` |

---

## PRD & Design

- `../Placement Analyzer - Product Requirements Document.md` — full PRD
- `../Placement Analyzer Dashboard_ Light and Dark Themes.png` — approved UI reference
