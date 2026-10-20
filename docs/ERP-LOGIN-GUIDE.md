# College ERP — Individual Login and Access Guide

This guide provides login instructions and portal routes for the College ERP local development environment.

## 1. System Access Points

- **Local Login Page:** [http://localhost:3000/login](http://localhost:3000/login)
- **Local Application URL:** [http://localhost:3000](http://localhost:3000)
- **Password Reset Portal:** [http://localhost:3000/reset-password](http://localhost:3000/reset-password)
- **Forgot Password Request:** [http://localhost:3000/forgot-password](http://localhost:3000/forgot-password)

---

## 2. Verified Temporary Password Policy

For **newly provisioned local development accounts** only, the active default temporary password configured in `.env.local` is:
```
INITIAL_DEFAULT_PASSWORD=CollegeERP@2026
```

> **Security Note:**
> - This password applies **only to newly provisioned local accounts** or accounts explicitly reset by an administrator via the Account Governance portal.
> - Accounts flagged with `must_change_password = true` are automatically redirected to `/reset-password?required=true` upon sign-in.
> - Users must save a new personal password before accessing ERP modules.

---

## 3. Key Personnel & Required User Role Accounts

| Full Name | Role | Unique Login ID | Email Address | Portal URL | Account Status | First-Login Password Change |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Campus Administrator** | `admin` | `ADMIN` | `admin@college.local` | `/dashboard/admin` | Active | Verified |
| **Prof. Hardeep Singh (Principal)** | `principal` | `PRINCIPAL` | `principal@college.local` | `/dashboard/principal` | Active | Required |
| **Dr. Gurjeet Singh** | `hod` | `FAC101` | `gurjeet.singh@college.local` | `/dashboard/hod` | Active | Verified |
| **Aman (Test Accounts Staff - Dev Only)** | `teacher` | `AMAN-ACCOUNTS` | `aman.accounts.test@college.local` | `/dashboard/cashier` | Active | Required |
| **Kiran (Test Accounts Staff - Dev Only)** | `teacher` | `KIRAN-ACCOUNTS` | `kiran.accounts.test@college.local` | `/dashboard/cashier` | Active | Required |
| **Prof. Alan Turing** | `teacher` | `EMP-ALAN-001` | `teacher@college.local` | `/dashboard/teacher` | Suspended | Verified |
| **John Doe (Student)** | `student` | `STU-DEMO-2026` | `student@college.local` | `/dashboard/student` | Active | Verified |
| **Campus Head Cashier** | `cashier` | `CASHIER` | `cashier@college.local` | `/dashboard/cashier` | Active | Verified |

---

## 4. Role-Based Portal Architecture & Entry Points

1. **Principal Portal** (`/dashboard/principal`):
   - **Login ID:** `PRINCIPAL`
   - **Scope:** Institution-wide executive oversight, consolidated attendance summaries, academic reporting across all departments.

2. **Head of Department (HOD) Portal** (`/dashboard/hod`):
   - **Login ID:** `FAC101` (Dr. Gurjeet Singh)
   - **Scope:** Department-level administration, faculty roster management, session auditing, and class attendance oversight for Computer Science & Engineering.

3. **Faculty / Teacher Portal** (`/dashboard/teacher`):
   - **Login ID:** Institutional Employee ID (e.g. `EMP-ALAN-001`, `FAC123`)
   - **Scope:** Authorized daily roll calls, session updates, timetable viewer, student marks entry.

4. **Student Portal** (`/dashboard/student`):
   - **Login ID:** Institutional Roll Number (e.g. `STU-DEMO-2026`, `24CSE002`)
   - **Scope:** Personal attendance percentages, subject-wise attendance logs, fee dues & payment receipts, marks.

5. **Accounts Portal — Kiran & Aman** (`/dashboard/cashier`):
   - **Login IDs:** `KIRAN-ACCOUNTS` and `AMAN-ACCOUNTS`
   - **Identity:** Base role is `teacher` with explicit `can_access_accounts = true` permission.
   - **Scope:** Offline fee collection, payment receipts, student dues ledger.
   - **Privilege Isolation:** Strictly blocked from general administrative modules (`/dashboard/admin`).

6. **Campus Administrator Portal** (`/dashboard/admin`):
   - **Login ID:** `ADMIN`
   - **Scope:** Account provisioning, timetable solver, student & teacher roster governance.

---

## 5. How to Reset a Forgotten or Unknown Password

If an existing user's password is unknown:
1. **Self-Service:** Navigate to [http://localhost:3000/forgot-password](http://localhost:3000/forgot-password), enter the verified email address, and follow the local mail link (Mailpit available at [http://localhost:54324](http://localhost:54324)).
2. **Administrative Reset:** An administrator can navigate to [http://localhost:3000/dashboard/admin/accounts](http://localhost:3000/dashboard/admin/accounts), search for the user, and click **Reset Password**. This sets their credentials to `CollegeERP@2026` and flags them for mandatory password change on their next login.

---

## 6. Complete Institutional Roster

A complete roster of all **57 accounts** (including all 37 teachers and 15 students) is exported in the local CSV file:
`docs/erp-login-roster.csv`

*(Note: Per privacy constraints, `docs/erp-login-roster.csv` is ignored by Git and retained strictly in local development).*
