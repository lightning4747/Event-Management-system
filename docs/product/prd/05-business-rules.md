# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 05: Core Business Rules & Data Integrity

* **Application:** MCET AI&DS OD Approval Web Application
* **Document Version:** 1.0

---

## 1. OD Application Immutability

To prevent tampering and ensure audit reliability, the system enforces strict lifecycle rules on submitted requests:

* **No Modifications Post-Decision:** Once an application has been decided (Approved or Rejected), its core data (title, date range, location, and reason) is locked and becomes completely immutable.
* **No Resubmission of Rejected ODs:** A rejected application cannot be edited or resubmitted. The student must create a completely new OD application with a new identifier.
* **No Physical Deletions:** No user, including the Administrator, can physically delete an application, approval log, or uploaded certificate metadata. All historical logs are kept permanently.

---

## 2. Rejection Behavior & Workflows

Rejections are immediate and absolute in the OD workflow:

* **Short-Circuit Rejection:** If an approval authority (EC, Mentor, PC, or HOD) rejects an application, it immediately transitions to the `Rejected` state.
* **Workflow Termination:** Once rejected, the workflow halts. The request does not move to subsequent authorities in the chain.
* **Immutable State:** A rejected application cannot be reopened or moved back to an active review queue.

---

## 3. Certificate Rejection Handling

Unlike OD applications, certificate rejections do **not** invalidate the underlying request:

* **Separation of Concerns:** The certificate status is decoupled from the OD application status.
* **OD Status Maintained:** If a student's uploaded certificate is rejected by the Event Coordinator, the parent OD application remains in the `Approved` state.
* **Re-upload Allowed:** The student is allowed to upload a replacement certificate. The previous certificate's metadata and OneDrive URL are kept in the audit trail, and the new upload enters the verification queue.

---

## 4. Operational Logs & Audit Trails

To support compliance audits, every transaction must generate a permanent record:

* **Approval Logs:** Every approval or rejection decision must record:
  - Application ID
  - Approver User ID
  - Approver Role
  - Decision (Approve/Reject)
  - Optional Comments
  - Timestamp
* **Upload Logs:** Each certificate upload must log the link, timestamp, and size details.
* **Deadline Extension Logs:** Any extension granted by a mentor must record the previous deadline, the new deadline, the mentor's user ID, and the justification.
* **Database Constraint Protection:** All logs must use database-level foreign key constraints pointing to the active user registry to prevent orphaned records.
