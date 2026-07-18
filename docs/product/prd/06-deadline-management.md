# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 06: Certificate Deadline & Extension Rules

* **Application:** MCET AI&DS OD Approval Web Application
* **Document Version:** 1.0

---

## 1. Default Submission Deadlines

To encourage timely documentation of student activity, the system automates deadline calculations:

* **Trigger Point:** The certificate submission portal opens immediately after the OD application receives final HOD approval **and** the event end date (`to_date`) has passed.
* **Default Window:** The default deadline is automatically calculated as:
  $$\text{Submission Deadline} = \text{Event End Date} + 7\text{ Calendar Days}$$
* **Visual indicator:** The student's dashboard and upload page must display the remaining time (e.g., "3 days remaining") or show "Overdue" if the deadline has expired.

---

## 2. Mentor-Authorized Extensions

Recognizing that external event organizers often delay issuing certificates, mentors can override the system deadline:

* **Authorized Role:** Only the student's assigned Mentor is authorized to extend the certificate submission deadline. Event Coordinators, Program Coordinators, or Admins cannot grant extensions.
* **One-Time Limitation:** The system must restrict extensions to **exactly once** per application.
* **Retrospective Granting:** Mentors are permitted to extend the deadline even if the current deadline has already expired and the certificate is marked as *Deadline Expired*.
* **Extension Lock:** Once an extension has been applied, the new deadline is final and cannot be modified or extended a second time.

---

## 3. Extension Record Keeping

Every deadline extension must be permanently logged for auditing purposes. The database record must include:

* **Previous Deadline:** The original automated deadline.
* **New Deadline:** The date set by the Mentor.
* **Extended By:** The user ID of the Mentor who authorized the change.
* **Reason:** A required text field justifying the extension (e.g., "Organizer delayed distribution").
* **Timestamp:** The exact time the extension was saved.

---

## 4. Missing / Optional Certificates

* **Optional Rule:** Uploading certificates is optional. The application does not automatically revoke or cancel an approved OD request if the student fails to upload a certificate.
* **Audit Registry:** If a student does not submit a certificate and the deadline expires, the application status remains *Approved*, but the certificate status becomes *Deadline Expired*. This provides the department with an accurate record of who failed to submit proof for their OD.
