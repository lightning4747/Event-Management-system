# Role-Based Access Control (RBAC) Matrix

This document defines the security permissions and access control limits for all six operational roles in the MCET AI&DS OD Approval Web Application.

---

## 1. The Six System Roles

The application assigns exactly one of the following roles to every registered user:

1. **Student:** Initiates OD requests and uploads post-event certificates.
2. **Event Coordinator (EC):** Departmental filter who conducts the first-stage review of all applications and verifies certificates.
3. **Mentor:** Manages specific student cohorts; reviews and approves applications for assigned mentees only.
4. **Program Coordinator (PC):** Evaluates applications that have passed both EC and Mentor approval stages.
5. **Head of Department (HOD):** Provides final departmental approval on applications.
6. **Administrator:** Manages system configuration and faculty accounts; does not participate in workflows.

---

## 2. Explicit Permission Matrix

The following table details the access levels for each module across all six roles.

| Module | Student | Event Coordinator (EC) | Mentor | Program Coordinator (PC) | Head of Department (HOD) | Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | ✓ (Own Data) | ✓ (Dept. Summary) | ✓ (Cohort Only) | ✓ (Dept. Summary) | ✓ (Dept. Summary) | ✓ (Sys. Summary) |
| **Submit OD** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **View Own Applications** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **View Department Applications** | ✗ | ✓ (All) | ✗ | ✓ (All) | ✓ (All) | ✗ |
| **Approve Applications** | ✗ | ✓ (Stage 1) | ✓ (Stage 2, Cohort) | ✓ (Stage 3) | ✓ (Stage 4) | ✗ |
| **Reject Applications** | ✗ | ✓ (Stage 1) | ✓ (Stage 2, Cohort) | ✓ (Stage 3) | ✓ (Stage 4) | ✗ |
| **Upload Certificates** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Verify Certificates** | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Extend Deadline** | ✗ | ✗ | ✓ (Cohort Only) | ✗ | ✗ | ✗ |
| **Reports** | ✗ | ✓ (CSV, Dept.) | ✓ (CSV, Cohort) | ✓ (CSV, Dept.) | ✓ (CSV, Dept.) | ✓ (CSV, Sys.) |
| **Faculty Management** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **Student Management** | ✗ | ✗ | ✓ (Onboard Cohort) | ✗ | ✗ | ✗ |
| **Profile Management** | View Only | View & Update | View & Update | View & Update | View & Update | View Only |

### Legend:
* **✓:** Access permitted.
* **✓ (Cohort Only):** Access permitted, but queries are restricted to students explicitly assigned to that Mentor.
* **✗:** Access explicitly denied.

---

## 3. RBAC Enforcement Mechanisms

Permissions are enforced at both the Presentation (Client) and Application (Server) layers, with the server acting as the single source of truth.

### 3.1 Token-Based Role Validation
When a user logs in, their validated role is written into their JWT session payload:

```json
{
  "user_id": "FAC102",
  "username": "s_suresh",
  "role": "Mentor",
  "iat": 1784386800,
  "exp": 1784473200
}
```

### 3.2 Server-Side Route Guard Middleware
The backend uses Express middleware to check the JWT payload against allowed roles for specific endpoints.

```typescript
// Middleware implementation concept
export const authorizeRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role; // Set during JWT verification
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: "Access Denied: Insufficient permissions for this operation." 
      });
    }
    
    next();
  };
};

// Usage in Routes
router.post("/certificates/verify", authorizeRoles(["Event Coordinator"]), verifyCertificateController);
router.post("/extensions", authorizeRoles(["Mentor"]), grantExtensionController);
```

### 3.3 Cohort Isolation (Query-Level Validation)
For Mentor roles, the middleware is not enough; the database query itself must enforce cohort boundaries:

* **Mentor Dashboard & Mentees List:**
  ```sql
  SELECT * FROM STUDENTS WHERE mentor_id = req.user.user_id;
  ```
* **Mentor Approval Check:**
  Before allowing a Mentor to approve an application, the server runs a validation query check:
  ```sql
  SELECT EXISTS (
    SELECT 1 FROM STUDENTS s
    JOIN OD_APPLICATIONS a ON s.user_id = a.student_id
    WHERE a.application_id = req.body.application_id 
      AND s.mentor_id = req.user.user_id
  );
  ```
  If this returns false, the server blocks the action (returning a `403 Forbidden` response), preventing a mentor from approving requests for students they do not supervise.
