# Supabase database setup

## Existing DSAM database

Run `20260813_enrollment_hardening.sql` once in the Supabase SQL Editor. It is an additive safety upgrade: it keeps your existing students, enrolments, courses, payments, and lessons.

It adds these protections:

- Students can submit only one application per programme.
- Admins can approve or decline enrolments in the portal.
- Student applications must start as `pending`.
- Enrolments record when they were created.

## New empty database

Run the existing files in this order:

1. `student_dashboard.sql`
2. `official_course_catalog.sql`
3. `enrollment_policy.sql`
4. `fix_student_access.sql`
5. `admin_portal.sql`
6. `20260813_enrollment_hardening.sql`

Before an admin or staff member can use the portal, that person must sign in once, then run `admin_portal.sql` again to assign their role.

## Personal staff Gmail approvals

After `admin_portal.sql`, run `staff_access_requests.sql` once.

Each prospective staff member then uses **their own Gmail** on Staff Login. This creates a pending request only. The owner-admin approves or denies the request in Admin Portal; approval grants read-only staff access.
