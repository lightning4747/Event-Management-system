# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 01: Introduction, Problem Statement & Objectives

* **Application:** MCET AI&DS OD Approval Web Application
* **Document Version:** 1.0
* **Target Audience:** Development Team, Department Faculty, Administrators

---

## 1. Introduction

The **OD Approval Web Application** is an internal web-based management system developed specifically for the Department of Artificial Intelligence & Data Science at MCET. The application digitizes the complete On-Duty (OD) approval process, replacing manual, paper-based workflows with a centralized, automated web platform.

The system enables students to submit OD applications for academic and technical events while allowing faculty members to review, approve, reject, and monitor applications according to the department's approval hierarchy. It also manages post-event certificate submissions, verification, reporting, and historical participation records.

The application is intended exclusively for internal departmental use and will not provide public access, public self-registration, or external registrations.

---

## 2. Problem Statement

The current OD approval process in the department relies heavily on physical documentation and manual approvals. This manual approach introduces several operational challenges:

* **Incomplete Visibility:** Students have limited visibility into the approval status of their applications, leading to confusion and follow-ups.
* **Paper-Based Inefficiencies:** Routing physical papers is time-consuming, and forms can get misplaced or delayed.
* **Tracking Overhead:** Faculty members must manually track pending requests, deadlines, and student attendance mappings.
* **Audit Challenges:** Historically checking a student's participation records or verifying if a certificate was uploaded is highly fragmented and labor-intensive.
* **Report Generation:** Compiling statistics for accreditation audits (e.g., NBA, NAAC) requires tedious manual aggregation of physical papers.
* **Accountability Deficit:** There is limited permanent accountability and auditability for decision-making (who approved what and when).

The proposed system addresses these constraints by establishing an immutable, step-by-step digital pipeline with built-in role-based access control (RBAC).

---

## 3. Objectives

The primary objectives of the web application are:

* **Digitize Workflows:** Move the entire On-Duty submission and verification cycle to a modern web interface.
* **Automate Approvals:** Systematically route applications through the designated approval sequence without manual handling.
* **Audit Trail Security:** Maintain a permanent, unmodifiable log of all applications, approval decisions, comments, and file uploads.
* **Establish RBAC:** Restrict and grant actions securely to the designated six operational roles.
* **Centralize Document Verification:** Manage certificate submissions with default and mentor-extendable deadlines.
* **Enable Faculty Analytics:** Provide coordinators, mentors, and the HOD with downloadable reports and summary dashboards.
* **Maintain Long-Term History:** Save student participation data for up to 5–10 years to aid departmental audits.
