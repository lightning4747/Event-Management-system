# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 02: Project Scope, Stakeholders & Capacity Limits

* **Application:** MCET AI&DS OD Approval Web Application
* **Document Version:** 1.0

---

## 1. Project Scope

To ensure a successful and timely deployment of Version 1.0, the boundaries of the application have been strictly defined.

### In-Scope Features
* **Role-Based Access Control (RBAC):** Secure access configurations tailored to 6 operational roles.
* **Account Provisioning:** Restricted internal creation of faculty and student accounts according to structural rules (no public register).
* **Multi-Stage Workflow:** Systematic routing of OD applications through Event Coordinator, Mentor, Program Coordinator, and Head of Department.
* **Certificate Lifecycle Management:** Post-event certificate upload, verification, and deadline tracking.
* **Deadline Adjustments:** Authorized extension of certificate deadlines once per application by the student's Mentor.
* **Auditable Logbook:** A data layer where records are immutable (no physical deletions or modification of decisions).
* **CSV Reporting:** Faculty dashboards with date-filtered export of participation statistics.
* **Responsive Web Layout:** Accessible from mobile, tablet, and desktop web browsers.

### Out-of-Scope (Excluded from V1.0)
* **Mobile Applications:** No native Android or iOS application wrappers.
* **Automated Notification Triggers:** No outbound Email, SMS, or Push notifications (planned for future phases).
* **Payment Gateways:** No entry fees, reimbursements, or cash management features.
* **Event Hosting/Registration:** The application does not manage the events themselves; it only tracks OD approval for participation.
* **Third-Party Integrations (except OneDrive):** No calendars (Google/Outlook) sync, no LMS synchronization, and no auto-sync with college ERP in V1.0.

---

## 2. Stakeholders

The system serves both users directly involved in the approval pipeline and teams reliant on the recorded historical reports.

### Primary Stakeholders
1. **Students:** Submit OD applications, check real-time workflow status, and upload certificates.
2. **Mentors:** Oversee their specific batch of assigned mentees, approve/reject ODs, and grant deadline extensions.
3. **Event Coordinators:** Vet all student applications departmental-wide as the first line of approval, and verify uploaded certificates.
4. **Program Coordinators:** Conduct third-stage reviews and monitor broad departmental statistics.
5. **Head of Department (HOD):** Give the final operational sign-off on applications and access complete analytical dashboards.
6. **System Administrator:** Manage faculty accounts and verify structural system health.

### Secondary Stakeholders
* **Department Office / Attendance Clerks:** Verify OD approvals against official daily attendance registries.
* **Accreditation Committees (NBA/NAAC):** Audit participation statistics to verify student co-curricular engagement.
* **Internal Audit Team:** Inspect approval histories for compliance verification.

---

## 3. Capacity & Workload Limits

The application is sized specifically for a single department, with the following workload guidelines:

| Metric | Sizing Estimate | Impact on System Design |
| :--- | :---: | :--- |
| **Total Registered Users** | ~450 | Low database size; index on ID columns. |
| **Active Students** | ~420 | Minimal concurrency outside peak event seasons. |
| **Active Faculty** | ~30 | Extremely low data load; caching is highly effective. |
| **Daily Active Users (DAU)** | 30–40 | Negligible server processing requirements. |
| **Peak Concurrent Users** | 50–60 | Happens usually before major tech-fests. |
| **Daily API Request Load** | 3,000 – 6,000 | Easily handled by a low-tier Express server instance. |
| **Estimated DB Size (5 Years)** | <100 MB | Fits easily within free database tiers (excluding certificate binaries). |
| **Certificate Files** | Externally Hosted | System holds Microsoft OneDrive links only; no database bloat. |
