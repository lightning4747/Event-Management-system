# MCET AI&DS OD Approval Web Application

Welcome to the central documentation hub for the **MCET Department of Artificial Intelligence & Data Science On-Duty (OD) Approval Web Application**. This system is a role-based internal department portal designed to digitize and automate the On-Duty (OD) approval workflow for students participating in academic, technical, cultural, sports, and professional events.

---

## 📖 Quick Read Summary

The OD Approval Web Application replaces the traditional paper-based approval process with a secure, centralized, multi-stage workflow platform. It manages the entire lifecycle of student participation, from the initial OD request to post-event certificate submission, verification, reporting, and historical record tracking.

### Primary Goals
- **Eliminate Paper:** Transition from manual forms to an all-digital workflow.
- **Provide Transparency:** Enable students and faculty to track application status in real-time.
- **Maintain Accountability:** Log complete audit history for every approval, rejection, upload, and deadline extension.
- **Centralize Verification:** Manage post-event certificates with automated deadlines and event-coordinator verification.
- **Facilitate Reporting:** Export date-filtered departmental statistics to CSV.

### System Profile
- **Application Type:** Internal Department Portal (Web Application)
- **Architecture:** Three-Tier Web Architecture (React SPA + Express REST API + PostgreSQL + OneDrive Storage)
- **Workload Capacity:**
  - **Registered Users:** ~450 (approx. 420 Students, 30 Faculty)
  - **Daily Active Users (DAU):** 30–40
  - **Peak Concurrent Users:** 50–60
  - **Workload Tier:** Light, optimized for a single backend server and managed database instance.

---

## 🗂 Documentation Structure

The documentation is organized into four core directories representing different facets of the project lifecycle. Click the links below to explore specific sections:

```
/docs
├── README.md                          # Project entry point & Quick Read Summary (You are here)
├── /product                           # Business rules, constraints, and PRD material
│   ├── /prd                           # Clean user requirements & capacity limits
│   │   ├── 01-introduction.md         # Context, Problem Statement, and Core Objectives
│   │   ├── 02-scope-stakeholders.md   # Scope boundaries, stakeholders, and capacity limits
│   │   ├── 03-functional-requirements.md # Functional features & dashboards for all 6 roles
│   │   ├── 04-auth-user-management.md # User creation, profile updates, and authentication
│   │   ├── 05-business-rules.md       # Immutability, audit trails, and status rules
│   │   ├── 06-deadline-management.md  # Certificate submission and extension rules
│   │   └── 07-future-enhancements.md  # Roadmap items and out-of-scope features
│   └── workflows.md                   # Step-by-step OD & Certificate state machines
├── /architecture                      # System design & blueprints
│   ├── system-design.md               # Infrastructure, data flows & folder layouts
│   ├── tech-stack.md                  # Finalized dependency checklist (with Docker & Bun)
│   └── rbac-matrix.md                 # Explicit access tables for the 6 roles
└── /database                          # Single source of truth for your data layer
    └── schema.md                      # Data dictionary, table layouts & relationships
```

### Direct Navigation Links
- 📦 **Product & Requirements**
  - [Introduction & Objectives](product/prd/01-introduction.md)
  - [Project Scope & Capacity](product/prd/02-scope-stakeholders.md)
  - [Functional Requirements](product/prd/03-functional-requirements.md)
  - [Auth & User Management](product/prd/04-auth-user-management.md)
  - [Business Rules](product/prd/05-business-rules.md)
  - [Deadline Management](product/prd/06-deadline-management.md)
  - [Future Roadmap](product/prd/07-future-enhancements.md)
  - [Workflow State Machines](product/workflows.md)
- 📐 **Architecture & Design**
  - [System Architecture Design](architecture/system-design.md)
  - [Technology & Dependency Stack](architecture/tech-stack.md)
  - [RBAC Permission Matrix](architecture/rbac-matrix.md)
- 🗄️ **Database Layer**
  - [Database Schema & Dictionary](database/schema.md)
