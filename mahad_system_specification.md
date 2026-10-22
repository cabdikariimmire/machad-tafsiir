# System Requirements Specification

## معهد التفسير للعلوم الشرعية والعربية

### Internal Institute Management System

**Version:** 1.0\
**Status:** Planning specification\
**Initial environment:** Localhost\
**Technology stack:** React + Vite, Node.js + Express, MySQL

------------------------------------------------------------------------

## 1. Project Overview

Build a private, responsive management system for **معهد التفسير للعلوم
الشرعية والعربية**. The system is for authorized administrators and
staff only. It is not a public website and must not have public student
registration.

The system has two operational divisions:

1.  **Institute** --- academic courses, classes, attendance,
    examinations, results, and finance.
2.  **Quran School** --- Quran students, groups/levels, attendance,
    hifdh progress, exams, results, and finance.

Both divisions run within one application, use one authentication
system, and can use one MySQL database. Division-specific academic,
attendance, examination, and finance records must remain logically
separated. If one person studies in both divisions, the person can have
one shared identity but separate enrollments and records for each
division.

## 2. Technology Stack

-   **Frontend:** React + Vite
-   **UI:** HTML, CSS, JavaScript; responsive design for desktop,
    tablet, and mobile
-   **Backend:** Node.js + Express
-   **Database:** MySQL
-   **Database driver:** `mysql2` with prepared statements
-   **Authentication:** Server-managed secure sessions using secure,
    HTTP-only cookies
-   **API:** REST API under `/api`
-   **Local development:** React development server, Express API server,
    and MySQL on localhost
-   **Production later:** VPS or suitable hosting, HTTPS, reverse proxy,
    process manager, and off-server backups

Do not use PHP, Laravel, Next.js, or a separate public-facing student
portal unless explicitly requested later.

## 3. Core Principles

1.  One application, one login, one database.
2.  No public registration; authorized staff enter student records
    internally.
3.  Enforce every role and division permission on the backend for every
    protected API request. Hiding menu items in React is not sufficient.
4.  A user's creator (`created_by`) is audit information, not a
    replacement for authorization rules.
5.  Use database transactions for payments and other multi-step
    financial operations.
6.  Store money using `DECIMAL`, never floating-point types.
7.  Keep audit records for sensitive actions and corrections.
8.  Use validation on both frontend and backend.
9.  Use prepared statements, output escaping, CSRF protection where
    applicable, rate limiting, and secure session settings.
10. Back up the database regularly and store at least one backup outside
    the primary server.

------------------------------------------------------------------------

## 4. Roles and Access Control

### 4.1 Super Admin

Full control over the application:

-   Create, edit, deactivate, and manage users.
-   Assign roles and division scopes.
-   Access Institute and Quran divisions.
-   Manage official fee rules and student discounts.
-   View combined financial reports.
-   View audit logs and financial adjustments.
-   Review payment notifications and changes.
-   Manage shared system settings and academic configuration.

Super Admin access must be protected and must not depend on a
client-side role value.

### 4.2 Institute Admin

-   Manage Institute students, teachers, courses, classes, enrollments,
    timetables, attendance, examinations, results, fees, and reports.
-   Create users limited to the Institute division.
-   Cannot grant access to the Quran division or Super Admin privileges.

### 4.3 Quran Admin

-   Manage Quran students, teachers, groups/levels, enrollments,
    attendance, hifdh progress, Quran exams, results, fees, and reports.
-   Create users limited to the Quran division.
-   Cannot grant access to the Institute division or Super Admin
    privileges.

### 4.4 Finance User

Access depends on the scope assigned by the authorized administrator:

-   Institute Finance only, Quran Finance only, or both.
-   If authorized for both, show **Institute Payments** and **Quran
    Payments** separately.
-   May record payments against the correct division and invoice.
-   May not silently change official class/group fee rules.
-   May be permitted to enter a one-off payment adjustment only if the
    permission policy allows it; require a reason and audit it.
-   Must not delete payments directly. Corrections should use a
    controlled reversal/adjustment flow.
-   Can access only the reports permitted by their scope.

### 4.5 Attendance Officer

-   Record student attendance for authorized division(s).
-   View attendance reports for authorized division(s).
-   No access to finance or examination functions unless separately
    granted.

### 4.6 Examination Officer

-   Manage exam schedules and enter marks for authorized division(s).
-   View and publish results only if permitted.
-   No access to finance functions unless separately granted.

### 4.7 Teacher

-   View assigned classes or Quran groups.
-   Record attendance for assigned classes/groups if permitted.
-   Access only the student information necessary for assigned teaching
    duties.
-   May enter marks or Quran progress only if explicitly permitted.

### 4.8 Permission Model

Use roles plus explicit division scopes and action permissions.
Recommended permission dimensions:

-   `module`: `system`, `institute`, `quran`, `finance`
-   `action`: `view`, `create`, `update`, `deactivate`,
    `record_payment`, `adjust_payment`, `enter_marks`,
    `publish_results`, `export`, `manage_users`

A user may have access to one or both divisions. Verify the permission
and record's division on every API request.

------------------------------------------------------------------------

## 5. Navigation Menus

Only show menus that the signed-in user is authorized to access. Do not
create a Settings menu for every module without a clear need.

### 5.1 Super Admin

-   Dashboard
-   Users
-   Roles & Permissions
-   Institute
-   Quran
-   Financial Overview
-   Reports
-   Audit Logs
-   System Settings

### 5.2 Institute Admin

-   Dashboard
-   Students
-   Teachers
-   Courses & Subjects
-   Classes
-   Timetable
-   Attendance
-   Exams
-   Results
-   Finance
-   Reports

### 5.3 Quran Admin

-   Dashboard
-   Students
-   Teachers
-   Groups & Levels
-   Attendance
-   Hifdh Progress
-   Quran Exams
-   Results
-   Finance
-   Reports

### 5.4 Institute Finance

The agreed minimal menu is:

1.  Dashboard
2.  Students & Fees
3.  Payments
4.  Reports
5.  Settings

**Students & Fees** shows the student's fee obligation and balance.
**Payments** is for receiving a new payment and generating a receipt.
Historical payment records are viewed under **Reports**, not in a
separate Payment History menu.

### 5.5 Quran Finance

The same five-menu structure, with Quran-specific data:

1.  Dashboard
2.  Students & Fees
3.  Payments
4.  Reports
5.  Settings

### 5.6 Attendance

Keep attendance simple. No separate Settings menu is required for the
basic attendance workflow.

-   Student Attendance
-   Attendance Reports

Teacher attendance may be added if confirmed as a requirement.

### 5.7 Examination

-   Exams
-   Enter Marks
-   Results
-   Exam Reports

Do not add unnecessary configuration menus.

------------------------------------------------------------------------

## 6. Student and Enrollment Management

### 6.1 Student Records

Recommended student identity fields:

-   Student ID (unique)
-   Full name
-   Phone number
-   Optional guardian name and phone
-   Status (active/inactive)
-   Date created
-   Notes if needed

Collect only information the institution actually needs.

### 6.2 Shared Identity, Separate Enrollments

A student may be registered in one or both divisions:

-   Keep one shared student identity if appropriate.
-   Use separate Institute and Quran enrollment records.
-   Attendance, classes/groups, exams, progress, fees, invoices, and
    payments must be linked to the relevant enrollment/division.
-   A student's Institute payment must never appear as a Quran payment
    and vice versa.

### 6.3 Search

Student lists and payment workflows should support searching by:

-   Name
-   Student ID
-   Phone number
-   Class or group

Search results must be restricted to the user's authorized division.

------------------------------------------------------------------------

## 7. Institute Module

### Menus and capabilities

-   **Students:** create and manage student identities and Institute
    enrollment.
-   **Teachers:** manage teacher records and assignments.
-   **Courses & Subjects:** manage subjects taught.
-   **Classes:** manage class names and enrollments.
-   **Timetable:** manage lessons; current known schedule is mainly
    Thursday and Friday.
-   **Attendance:** record attendance for scheduled teaching days.
-   **Exams:** create exams, set maximum marks, subject, class, and
    date.
-   **Results:** calculate percentages and grades and show student
    results.
-   **Finance:** official fees, invoices, discounts, payments, and
    receipts according to permissions.
-   **Reports:** academic and administrative reports.

The timetable and attendance calendar must use the actual configured
schedule. The known intended attendance days are Thursday and Friday
only.

------------------------------------------------------------------------

## 8. Quran School Module

-   Manage Quran students and enrollments.
-   Manage teachers.
-   Manage groups and levels.
-   Record attendance separately from Institute attendance.
-   Track hifdh progress.
-   Manage Quran examinations and results.
-   Manage Quran fees, invoices, payments, and receipts separately from
    Institute finance.
-   Provide division-specific reports.

Quran progress fields should be designed with the institution's actual
teaching method rather than invented. Confirm whether progress is
recorded by surah, ayah/page, juz, daily lesson, revision, or another
method before implementing the final form.

------------------------------------------------------------------------

## 9. Attendance Management

### 9.1 Simplest agreed workflow

1.  Attendance user selects a class (Institute) or group (Quran).
2.  System displays only enrolled students in that class/group.
3.  Display a checkbox list similar to a spreadsheet.
4.  Provide a **Mark All Present** action.
5.  Attendance user unchecks students who are absent.
6.  User saves attendance.
7.  Previously saved attendance can be viewed by date and corrected only
    with appropriate permission and an audit record.

### 9.2 Institute attendance schedule

-   Show **Thursday and Friday only** in the Institute attendance
    schedule.
-   Do not show other weekdays in the regular Institute attendance grid.
-   Provide a way to select the relevant week/date.
-   Store one attendance status per student per class/session/date.
-   Prevent duplicate attendance records for the same student and
    session.

### 9.3 Statuses

At minimum:

-   Present
-   Absent

Late or excused absence can be added if the institution requests it. Do
not treat an unchecked box as permanently absent until the attendance
session is saved/confirmed.

### 9.4 Reports

-   Daily attendance
-   Weekly/monthly attendance
-   Attendance by class/group
-   Student attendance history
-   Absence summaries
-   Print and Excel export if permitted

------------------------------------------------------------------------

## 10. Examination Management

### 10.1 Create Exam

An exam record should contain:

-   Exam title
-   Division
-   Class/group
-   Subject
-   Exam date
-   Maximum marks (configurable; 100 is the current example/default)
-   Status (draft, marks entry, finalized/published)

### 10.2 Enter Marks

1.  Select exam.
2.  System loads students enrolled in the relevant class/group.
3.  Enter marks in a table, one student per row.
4.  Mark a student as Absent separately rather than incorrectly entering
    zero.
5.  Validate that marks are numeric and between zero and the exam
    maximum.
6.  Save all marks safely.
7.  Record who entered or edited marks.

### 10.3 Calculations

Percentage formula:

`percentage = (marks_obtained / maximum_marks) * 100`

-   Calculate percentage automatically.
-   Grade boundaries have not yet been confirmed. Do not hard-code
    A/B/C/D/F thresholds until the institution chooses them.
-   Allow marks to be corrected by authorized users and audit
    corrections.
-   Results should not be published until an authorized user confirms
    them.

### 10.4 Results and reports

-   Results by student, class, subject, and exam.
-   Percentage and grade once grade boundaries are agreed.
-   Class summary and ranking only if requested.
-   Print and Excel export.
-   Protect unpublished results from unauthorized users.

------------------------------------------------------------------------

## 11. Financial Management

### 11.1 Official Fee Rules

Super Admin is responsible for:

-   Setting the official fee for each Institute class/course and Quran
    group/level.
-   Setting the applicable period, such as May--June, if that is the
    institution's billing cycle.
-   Assigning a discount to a specific student.
-   Recording discount type (fixed amount or percentage), reason,
    effective period, and who approved it.
-   Reviewing changes to fees and discounts.

The system should calculate the amount due from the official fee and
authorized discount. The exact billing period model must be confirmed
before database implementation.

### 11.2 Finance User Menus

#### Dashboard

Show:

-   Total collected
-   Outstanding balance
-   Payments recorded today
-   Unpaid or partially paid invoices

#### Students & Fees

Show:

-   Student ID
-   Student name
-   Class/course or Quran group
-   Billing period
-   Standard fee
-   Approved discount
-   Amount due
-   Amount paid
-   Balance
-   Payment status (Paid, Partial, Unpaid)

Actions can open the student/invoice or receive-payment workflow.

#### Payments

This page is primarily for recording a new payment.

Agreed form fields:

1.  Student search: name, Student ID, phone, class/group.
2.  Selected student.
3.  Class/group shown automatically.
4.  Invoice/fee or billing period.
5.  Standard fee (loaded from official fee rules).
6.  Approved discount (shown automatically).
7.  Amount due after discount.
8.  Amount paid now.
9.  Optional notes.
10. Submit button: **Receive Payment & Generate Receipt**.

**Payment Method has been explicitly removed from the form.** Do not add
Cash, Mobile Money, or Bank Transfer fields unless the user later
changes this requirement.

The system automatically records:

-   Unique receipt number
-   Payment timestamp/date
-   Staff user who received the payment
-   Correct division, student, enrollment, invoice, and period

Allow partial payments. Remaining balance must be calculated from valid
payment records, not manually trusted input.

### 11.3 Finance User Overrides

The agreed direction is:

-   Finance User should not be able to silently change the official fee
    configured by Super Admin.
-   If permitted to change the amount due for a specific payment, the
    adjustment must be limited to that payment, require a reason, and be
    logged.
-   Super Admin should receive an in-app notification when a payment is
    recorded and when a financial amount is adjusted.
-   Show old value, new value, who changed it, when, and the reason.
-   Exact approval policy for overrides still needs final confirmation.

### 11.4 Reports

No separate **Payment History** menu. Historical payments are available
inside Reports.

Reports should support:

-   Daily, monthly, and yearly collections
-   Payment records and receipts
-   Paid, partially paid, and unpaid students
-   Outstanding balances
-   Institute-only reports
-   Quran-only reports
-   Combined financial report for authorized users
-   Date, division, class/group, and payment-status filters as relevant
-   **Print** with a clean print layout
-   **Export Excel (.xlsx)** with clear columns and totals

Super Admin can view combined totals for both divisions. A finance user
can only view divisions they are authorized to access.

### 11.5 Payment Safety

-   Use database transactions when receiving a payment.
-   Generate unique receipt numbers.
-   Prevent duplicate submissions using an idempotency mechanism or
    equivalent duplicate protection.
-   Never directly delete financial history.
-   Use a reversal/correction workflow with audit records.
-   Validate that invoice, student enrollment, period, and division all
    match.
-   Use `DECIMAL` for money.
-   Do not trust calculated amounts sent by the React client; calculate
    and validate them on the server.

------------------------------------------------------------------------

## 12. Reports, Print, and Excel

Where applicable, reports must include:

-   Clear report title and selected division
-   Date range
-   Relevant class/group
-   Consistent table headings
-   Totals
-   Generated date/time
-   User/role permissions

### Print

-   Use a dedicated print stylesheet or printable report page.
-   Hide menus, navigation, and buttons in print output.
-   Keep the table readable on paper.
-   Avoid printing unrelated student data.

### Excel

-   Generate a real `.xlsx` file, not merely a renamed CSV.
-   Use clear column names and appropriate number/date formats.
-   Include totals where relevant.
-   Export only filtered data that the current user is allowed to
    access.
-   Prevent formula injection when exporting user-controlled text.

------------------------------------------------------------------------

## 13. Audit Logs and Notifications

Audit logs should cover sensitive actions, including:

-   User creation, role changes, and deactivation
-   Fee rule changes
-   Student discount creation/changes
-   Payment receipt creation
-   Payment correction/reversal
-   Payment amount override
-   Mark entry/editing and result publication
-   Attendance correction
-   Exports of sensitive data when appropriate

Each log should include actor, action, affected record, timestamp, and
relevant before/after values. Avoid storing passwords, session tokens,
or secrets in logs.

Super Admin in-app notifications should cover:

-   Payment recorded
-   Financial amount adjusted
-   Official fee or discount changed
-   Other important events that are explicitly configured

External SMS/WhatsApp/email notifications are not included by default
and require a separate provider/integration.

------------------------------------------------------------------------

## 14. Suggested MySQL Data Model

This is a starting point, not a final migration. Confirm details before
implementing schema changes.

### Identity and access

-   `users`
-   `roles`
-   `permissions`
-   `user_roles`
-   `role_permissions`
-   `user_module_scopes`
-   `sessions` (if database-backed sessions are selected)
-   `audit_logs`
-   `notifications`

### Shared student identity

-   `students`
-   `guardians` (optional, if required)

### Institute

-   `institute_courses`
-   `institute_subjects` (or subjects linked to courses, depending on
    the final model)
-   `institute_classes`
-   `institute_enrollments`
-   `institute_teacher_assignments`
-   `institute_class_sessions`
-   `institute_attendance`
-   `institute_exams`
-   `institute_exam_marks`
-   `institute_fee_rules`
-   `institute_fee_invoices`
-   `institute_payments`
-   `institute_payment_adjustments` or a controlled reversal table
-   `institute_receipts` (or receipt fields on payment records if
    appropriate)

### Quran

-   `quran_groups`
-   `quran_levels` (if required)
-   `quran_enrollments`
-   `quran_teacher_assignments`
-   `quran_sessions`
-   `quran_attendance`
-   `quran_progress`
-   `quran_exams`
-   `quran_exam_marks`
-   `quran_fee_rules`
-   `quran_fee_invoices`
-   `quran_payments`
-   `quran_payment_adjustments` or a controlled reversal table
-   `quran_receipts` (or receipt fields on payment records if
    appropriate)

### Important data integrity rules

-   Add foreign keys and indexes.
-   Unique student IDs.
-   Unique attendance row per student/session.
-   Unique marks row per student/exam.
-   Unique receipt number.
-   Add `division`/scope validation on all relevant queries.
-   A shared student identity may have separate enrollments in each
    division.
-   Never infer access from `created_by` alone.
-   The final schema may normalize shared financial tables if division
    scoping remains explicit and secure; do not duplicate structures
    unnecessarily without considering maintainability.

------------------------------------------------------------------------

## 15. API and Backend Requirements

Use Express routers separated by feature, for example:

-   `/api/auth`
-   `/api/users`
-   `/api/students`
-   `/api/institute`
-   `/api/quran`
-   `/api/attendance`
-   `/api/exams`
-   `/api/finance`
-   `/api/reports`
-   `/api/notifications`

Use middleware for:

-   Authentication
-   Role/permission checking
-   Division-scope checking
-   Request validation
-   Rate limiting
-   Error handling
-   CSRF protection if cookie-based sessions are used

Never rely on a user ID, role, amount due, discount, division, or
receipt number sent by the client without server-side validation.

Do not expose the MySQL port publicly. Keep database credentials in
environment variables, not in React environment variables or frontend
bundles.

------------------------------------------------------------------------

## 16. Frontend Requirements

-   Responsive interface for desktop and mobile.
-   Clear sidebar or navigation menu based on permissions.
-   One shared login screen.
-   Consistent loading, empty, success, and error states.
-   Searchable student selectors.
-   Simple checkbox-based attendance interface.
-   Table-based marks entry.
-   Financial form that auto-loads student/class fee details.
-   Confirmation for sensitive actions.
-   Avoid unnecessary Settings menus.
-   Do not use fake/sample records in production.
-   Any sample UI must be clearly marked as sample data until connected
    to the API.

------------------------------------------------------------------------

## 17. Localhost Setup and Development Workflow

1.  Install a supported Node.js LTS version.
2.  Install or enable MySQL locally. XAMPP/phpMyAdmin may be used to
    manage MySQL, but React and Express run as their own processes.
3.  Create the React/Vite frontend.
4.  Create the Node.js/Express backend.
5.  Configure environment variables for the backend.
6.  Create the MySQL database and migrations/schema.
7.  Implement login, sessions, permissions, and division scopes first.
8.  Implement student and enrollment records.
9.  Implement attendance.
10. Implement exams, marks, and results.
11. Implement finance rules, invoices, payments, receipts, and audit
    logs.
12. Implement reports, print, and Excel exports.
13. Test all roles and permissions.
14. Add backup and restore procedures.
15. Deploy to hosting only after local testing and security checks.

Do not commit `.env`, database passwords, API keys, or production
credentials to Git.

------------------------------------------------------------------------

## 18. Testing and Acceptance Criteria

The system is not complete until these checks pass:

### Authentication and access

-   Unauthenticated users cannot access protected pages or APIs.
-   Institute Admin cannot grant Quran access or Super Admin access.
-   Quran Admin cannot grant Institute access or Super Admin access.
-   Finance User sees only assigned finance divisions.
-   Direct API requests cannot bypass frontend menu restrictions.

### Student and division data

-   Searching by name, ID, phone, and class/group works within the
    user's scope.
-   A student in both divisions has separate enrollments and independent
    division records.
-   Institute attendance/fees/results never leak into Quran records and
    vice versa.

### Attendance

-   Institute attendance grid shows Thursday and Friday only.
-   Selecting a class loads only its enrolled students.
-   Saving attendance prevents duplicate session records.
-   Previously recorded attendance can be reviewed and corrected only
    with authorization.

### Exams

-   Marks cannot exceed the maximum or be negative.
-   Percentage calculation is correct.
-   Absent is distinct from zero marks.
-   Unauthorized users cannot publish or alter results.

### Finance

-   Correct fee and approved discount load for the selected student and
    period.
-   Partial payments are supported.
-   Balance is calculated from valid recorded payments.
-   Receipt numbers are unique.
-   Duplicate submission does not double-charge/duplicate a payment.
-   A payment cannot be attached to the wrong student, enrollment,
    invoice, or division.
-   Financial corrections are audited; payments are not silently
    deleted.
-   Super Admin can view combined totals when authorized.
-   Print and `.xlsx` exports reflect selected filters and user
    permissions.

### Recovery

-   Database backup can be restored in a test environment.
-   Backups are stored separately from the primary database/server.

------------------------------------------------------------------------

## 19. Decisions Still to Confirm

These items should not be silently invented during implementation:

1.  Whether Attendance and Examination offices cover Institute only or
    both divisions.
2.  Exact fee billing periods (monthly or fixed periods such as
    May--June).
3.  Exact grade thresholds for A/B/C/D/F, if letter grades are desired.
4.  Quran hifdh-progress recording method.
5.  Whether Finance User adjustments require immediate notification only
    or Super Admin approval before they take effect.
6.  Whether teacher attendance is required.
7.  Exact required student and guardian fields.
8.  Which external notification channels, if any, are needed.

Until these are confirmed, implement configurable or minimal defaults
and keep the decisions explicit.

------------------------------------------------------------------------

## 20. Final Product Goal

Deliver one secure, maintainable, responsive internal management
application for **معهد التفسير للعلوم الشرعية والعربية** using React +
Vite, Node.js + Express, and MySQL. Build and test locally first. Keep
access control server-side, separate Institute and Quran operational
records, make attendance and mark entry fast, make financial
transactions auditable, and provide clean reports with print and Excel
export.
