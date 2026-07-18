# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 03: Functional Requirements by Role

* **Application:** MCET AI&DS OD Approval Web Application
* **Document Version:** 1.0

---

## 1. Student Requirements

Students are the primary initiators of requests in the system.

### Student Dashboard Metrics
* **Total OD Applications Submitted** (Count of all-time applications)
* **Pending Applications** (Count of applications currently in-progress in the workflow)
* **Approved Applications** (Count of successfully completed approvals)
* **Rejected Applications** (Count of rejected requests)
* **Certificates Requiring Action** (Count of pending uploads or rejected certificates)

### Student Features
* **Submit OD Applications:** Input title, location, event date range (from/to dates), number of events, and brief justifications.
* **Track Status:** View the exact approval step where the application currently sits (e.g. *In Progress: Mentor* vs. a generic *Pending*).
* **View History:** Browse an archive of all previous requests with their respective approval decisions.
* **Certificate Upload:** Link post-event certificates by uploading them to Microsoft OneDrive and submitting the link back to the system.
* **Profile View:** View registration details (admission year, section, assigned mentor). Students **cannot** edit their profiles.

---

## 2. Event Coordinator (EC) Requirements

The Event Coordinator is the first line of defense for the department and is responsible for overall event metrics.

### EC Dashboard Metrics
* **Total Department Applications**
* **Pending EC Approvals** (Applications currently awaiting EC action)
* **Certificate Verification Queue Count** (Certificates uploaded but not verified)
* **All-Time Verified Certificates**

### EC Features
* **First-Stage Review:** Approve or reject incoming OD requests for any student in the department.
* **Certificate Verification:** Inspect student-submitted certificates, verifying them as *Verified* or rejecting them back to the student with clear explanation comments.
* **Department-Wide Reports:** Generate and download date-filtered CSV summaries of all student participation and OD histories.

---

## 3. Mentor Requirements

Mentors manage specific student cohorts (mentees) assigned to them.

### Mentor Dashboard Metrics
* **Total Mentees Registered**
* **Pending Mentee Applications**
* **Approved / Rejected Mentee Applications**
* **Mentees with Expiring/Overdue Certificate deadlines**

### Mentor Features
* **Cohort Management:** Manually create student accounts and assign them to their mentee group.
* **Second-Stage Review:** Approve or reject applications initiated by their assigned mentees only. Mentors have no authority over students outside their cohort.
* **Deadline Extension:** Authorize a one-time extension for a mentee's certificate submission deadline, specifying a new date and justification.
* **Cohort Reporting:** Export CSV logs outlining participation histories for their mentees.

---

## 4. Program Coordinator (PC) Requirements

The Program Coordinator oversees department-wide academics and conducts the third-stage review.

### PC Dashboard Metrics
* **Total Department-wide Applications**
* **Pending PC Approvals** (Approved by Mentor, waiting PC)
* **Approved / Rejected Statistics**
* **Overall Department-wide Certificate Submission Rate**

### PC Features
* **Third-Stage Review:** Approve or reject applications that have successfully passed the Event Coordinator and Mentor reviews.
* **Department-wide Directory:** Search, view, and filter profiles and histories for all students across the AI&DS department.
* **Analytical CSV Exports:** Export all-time department records with advanced filters.

---

## 5. Head of Department (HOD) Requirements

The HOD is the final department authority. HOD approval marks the request as officially approved.

### HOD Dashboard Metrics
* **Pending HOD Approvals**
* **All-Time Approved requests**
* **Department-wide Participation Analytics** (Graphs/summaries of active student volumes)

### HOD Features
* **Final Approval Sign-Off:** Approve or reject third-stage (PC-approved) applications.
* **Read-Only Analytics:** View high-level metrics representing student engagement in workshops, hackathons, and sports.
* **Global CSV Reporting:** Export complete historical registries for accreditation audits.

---

## 6. Administrator Requirements

The Administrator manages the human system boundary and is responsible for faculty onboarding.

### Admin Dashboard Metrics
* **Total Faculty Accounts** (Categorized by role)
* **System Operations Log Summary**
* **Academic Calendar Sync Status**

### Admin Features
* **Faculty Account Provisioning:** Create credentials and roles for HOD, Program Coordinator, Mentors, and Event Coordinators.
* **Faculty Registry:** View all faculty accounts and update system access configuration.
* **Calendar Metadata Management:** Input academic terms, holidays, and basic event calendars.
* *Note: The Administrator has no role in the OD workflow or certificate verification.*
