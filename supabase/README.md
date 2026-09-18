# Supabase database setup

## Existing DSAM database

Run `20260813_enrollment_hardening.sql` once in the Supabase SQL Editor. It is an additive safety upgrade: it keeps your existing students, enrolments, courses, payments, and lessons.

Run `admin_operations.sql` after the existing setup files to enable the expanded Admin and Staff operations model. It adds management fields without deleting existing data, allows admins to manage courses and payments, allows admins to update student records, and allows admin/staff users to manage lesson sessions according to their roles.

Run `student_operations.sql` after `admin_operations.sql` to allow each authenticated student to update only their own profile details in the Student Portal. It does not change enrolments, lessons, payments, or staff/admin permissions.

Run `learning_workspace.sql` after `admin_operations.sql` to enable the learning workspace. It adds course materials, tutor progress feedback, lesson attendance, and academy announcements. Students can see only published materials for an approved programme, their own progress entries, and published announcements. Admin/staff manage materials and progress; only the owner-admin manages academy announcements.

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
7. `admin_operations.sql`
8. `student_operations.sql`
9. `learning_workspace.sql`

Before the owner can use Admin Portal, they must sign in once with `dsamacademyofmusic@gmail.com`, then run `admin_portal.sql` again to assign the Admin role.

## Personal staff Gmail approvals

After `admin_portal.sql`, run `staff_access_requests.sql` once.

Each prospective staff member then uses **their own Gmail** on Staff Login. This creates a pending request only. The owner-admin approves or denies the request in Admin Portal; approval grants read-only staff access.
