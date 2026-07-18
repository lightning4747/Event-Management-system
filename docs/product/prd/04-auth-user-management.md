# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Module 04: Authentication & User Management

* **Application:** MCET AI&DS OD Approval Web Application
* **Document Version:** 1.0

---

## 1. Authentication System

The application operates as a private department portal. To maintain data security and integrity, the system implements a strict authentication and authorization design:

* **Authentication Protocol:** Credentials-based authentication using unique username and passwords.
* **Session Management:** Secure JSON Web Tokens (JWT) issued upon login and validated on subsequent API calls.
* **Token Content:** JWT payloads must encapsulate user identity (`user_id`) and operational role (`role`) to perform instantaneous server-side RBAC validation.
* **Cryptographic Hashing:** All passwords must be hashed securely using `bcryptjs` before storage. Plain-text passwords must never hit the database.

---

## 2. User Creation Hierarchy

The system prevents public registration. All user accounts must be provisioned internally through the designated creation hierarchy:

```
                  ┌──────────────────────┐
                  │    Administrator     │
                  └──────────┬───────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     Mentor      │ │Program Coord.   │ │Head of Dept.    │
└────────┬────────┘ └─────────────────┘ └─────────────────┘
         │
         ▼
┌─────────────────┐
│     Student     │
└─────────────────┘
```

### Allocation Rules
1. **Admin Provisioning:** The Administrator is responsible for creating HOD, Program Coordinator, Event Coordinator, and Mentor accounts.
2. **Mentor Provisioning:** Mentors are responsible for onboarding Students under their supervision.
3. **Cohort Mapping:** When a Mentor creates a Student account, that Student is automatically and permanently linked to that Mentor in the database (`mentor_id` FK).
4. **Self-Service Restrictions:**
   - Students cannot register their own accounts.
   - Faculty members cannot create other faculty accounts.
   - System admins cannot bypass the Mentor assignment rule (students must map to a valid mentor).

---

## 3. Profile Management Constraints

Permissions regarding profile modification are strictly controlled to prevent unauthorized status bypasses (e.g., student changing their name or section to bypass a check):

### Student Profiles
* **Access Level:** Read-Only.
* **Allowed Actions:** Students can view their profile data (full name, admission year, section, date of birth, and assigned mentor details).
* **Restrictions:** Students cannot change their usernames, names, passwords, or mentors. Any adjustments must be requested through their assigned Mentor.

### Faculty Profiles
* **Access Level:** Read & Update.
* **Allowed Actions:** Faculty members (Admin, EC, Mentor, PC, HOD) can view their profiles and modify their usernames and passwords for security maintenance.
* **Restrictions:** Faculty members cannot modify their designations or roles without Admin intervention.
