import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

const read = (path) => readFile(new URL(path, root), 'utf8');

test('security hardening restricts private policies to authenticated users', async () => {
  const sql = await read('supabase/security_hardening.sql');
  const privatePolicies = [
    'users read own profile',
    'admins read profiles',
    'users read own role',
    'admins read all enrolments',
    'admins update enrolments',
    'students create own enrolments',
    'students read own enrolments',
    'students read own payments',
    'students read own lessons',
  ];

  for (const policy of privatePolicies) {
    assert.match(sql, new RegExp(`alter policy "${policy}"[\\s\\S]*?to authenticated;`));
  }
});

test('anonymous access is removed from private portal tables', async () => {
  const sql = await read('supabase/security_hardening.sql');

  assert.match(sql, /revoke all on table[\s\S]*public\.staff_access_requests[\s\S]*from anon;/);
  assert.match(sql, /revoke all on table public\.courses from anon;/);
  assert.match(sql, /grant select on table public\.courses to anon;/);
});

test('security audit covers every portal table', async () => {
  const sql = await read('supabase/security_audit.sql');
  const tables = ['profiles', 'user_roles', 'courses', 'enrollments', 'payments', 'lesson_sessions', 'staff_access_requests'];

  for (const table of tables) assert.match(sql, new RegExp(`'${table}'`));
});

test('sensitive API endpoints disable caching and fail clearly when email is unconfigured', async () => {
  const contact = await read('api/contact.ts');
  const staffRequest = await read('api/staff-access-request.ts');

  for (const source of [contact, staffRequest]) {
    assert.match(source, /setHeader\('Cache-Control', 'no-store'\)/);
    assert.match(source, /status\(503\)/);
  }
});

test('staff notification email escapes user-controlled HTML values', async () => {
  const source = await read('api/staff-access-request.ts');

  assert.match(source, /function escapeHtml\(value: string\)/);
  assert.match(source, /const safeEmail = escapeHtml\(request\.email\)/);
  assert.match(source, /const safeReviewUrl = escapeHtml\(reviewUrl\)/);
});

test('operations migration keeps financial writes admin-only', async () => {
  const sql = await read('supabase/admin_operations.sql');

  assert.match(sql, /create policy "admins manage payments"[\s\S]*?for all[\s\S]*?using \(public\.is_admin\(\)\)/);
  assert.match(sql, /create policy "staff manage lesson sessions"[\s\S]*?for all[\s\S]*?using \(public\.is_staff\(\)\)/);
  assert.match(sql, /create policy "admins manage courses"[\s\S]*?for all[\s\S]*?using \(public\.is_admin\(\)\)/);
  assert.match(sql, /create policy "admins manage student notes"[\s\S]*?for all[\s\S]*?using \(public\.is_admin\(\)\)/);
});

test('operations portal keeps admin-only sections out of staff navigation', async () => {
  const markup = await read('admin.html');
  const script = await read('src/scripts/portals/applications.js');

  assert.match(markup, /data-panel="courses" data-admin-only/);
  assert.match(markup, /data-panel="payments" data-admin-only/);
  assert.match(script, /document\.querySelectorAll\('\[data-admin-only\]'\)/);
  assert.match(script, /if \(!isAdmin\).*data-admin-only/s);
});

test('students can update only their own profile details', async () => {
  const sql = await read('supabase/student_operations.sql');
  const dashboard = await read('src/scripts/portals/student-dashboard.js');

  assert.match(sql, /grant update on public\.profiles to authenticated;/);
  assert.match(sql, /create policy "users update own profile"[\s\S]*?for update[\s\S]*?using \(auth\.uid\(\) = id\)[\s\S]*?with check \(auth\.uid\(\) = id\)/);
  assert.match(dashboard, /\.from\('profiles'\)[\s\S]*?\.update\(/);
  assert.match(dashboard, /\.eq\('id', user\.id\)/);
});

test('learning workspace keeps academic information role-scoped', async () => {
  const sql = await read('supabase/learning_workspace.sql');

  assert.match(sql, /create policy "students read published course materials"[\s\S]*?enrollments\.student_id = auth\.uid\(\)[\s\S]*?enrollments\.status = 'active'/);
  assert.match(sql, /create policy "staff manage learning materials"[\s\S]*?using \(public\.is_staff\(\)\)/);
  assert.match(sql, /create policy "students read own progress entries"[\s\S]*?using \(auth\.uid\(\) = student_id\)/);
  assert.match(sql, /create policy "admins manage academy announcements"[\s\S]*?using \(public\.is_admin\(\)\)/);
  assert.match(sql, /audience = 'active_students'[\s\S]*?enrollments\.status = 'active'/);
});

test('student dashboard includes the learning workspace feeds', async () => {
  const markup = await read('dashboard.html');
  const dashboard = await read('src/scripts/portals/student-dashboard.js');

  assert.match(markup, /id="learningMaterialList"/);
  assert.match(markup, /id="progressEntryList"/);
  assert.match(markup, /id="announcementFeed"/);
  assert.match(dashboard, /\.from\('learning_materials'\)/);
  assert.match(dashboard, /\.from\('student_progress_entries'\)/);
  assert.match(dashboard, /\.from\('academy_announcements'\)/);
});

test('student services enforce ownership and atomic lesson decisions', async () => {
  const sql = await read('supabase/student_services.sql');

  assert.match(sql, /create policy "students request changes to own future lessons"[\s\S]*?student_id = auth\.uid\(\)[\s\S]*?starts_at > now\(\)/);
  assert.match(sql, /create policy "students submit active programme assignments"[\s\S]*?m\.material_type = 'assignment'[\s\S]*?e\.student_id = auth\.uid\(\)[\s\S]*?e\.status = 'active'/);
  assert.match(sql, /create policy "students create own support tickets"[\s\S]*?auth\.uid\(\) = student_id/);
  assert.match(sql, /create policy "students read own invoices"[\s\S]*?auth\.uid\(\) = student_id/);
  assert.match(sql, /create or replace function public\.decide_lesson_change_request[\s\S]*?for update[\s\S]*?update public\.lesson_sessions/);
  assert.match(sql, /grant update \(is_read\) on public\.student_notifications to authenticated;/);
  assert.match(sql, /drop policy if exists "students read own lesson change requests"/);
  assert.match(sql, /drop policy if exists "students mark own notifications read"/);
});

test('student dashboard provides secure service actions', async () => {
  const dashboard = await read('src/scripts/portals/student-dashboard.js');

  assert.match(dashboard, /\.from\('lesson_change_requests'\)\.insert/);
  assert.match(dashboard, /\.from\('assignment_submissions'\)\.insert/);
  assert.match(dashboard, /\.from\('support_tickets'\)\.insert/);
  assert.match(dashboard, /\.from\('student_notifications'\)/);
  assert.match(dashboard, /\^https:\\\/\\\//);
});

test('classroom delivery is restricted to active students in the matching programme', async () => {
  const sql = await read('supabase/classroom_delivery.sql');

  assert.match(sql, /alter table public\.classroom_sessions enable row level security;/);
  assert.match(sql, /create policy "students read published programme classroom sessions"[\s\S]*?is_published[\s\S]*?enrollments\.student_id = auth\.uid\(\)[\s\S]*?enrollments\.course_id = classroom_sessions\.course_id[\s\S]*?enrollments\.status = 'active'/);
  assert.match(sql, /create policy "staff manage classroom sessions"[\s\S]*?using \(public\.is_staff\(\)\)/);
  assert.match(sql, /check \(join_url is null or join_url ~\* '\^https:\/\/'\)/);
});

test('student portal separates classroom delivery into accessible sections', async () => {
  const markup = await read('dashboard.html');
  const dashboard = await read('src/scripts/portals/student-dashboard.js');

  assert.match(markup, /id="studentMenuToggle"/);
  assert.match(markup, /data-student-panel="classroom"/);
  assert.match(markup, /id="classroomLiveList"/);
  assert.match(markup, /id="classroomRecordingList"/);
  assert.match(dashboard, /\.from\('classroom_sessions'\)/);
  assert.match(dashboard, /showStudentPanel/);
});

test('classroom operations notify eligible students and protect access events', async () => {
  const sql = await read('supabase/classroom_operations.sql');

  assert.match(sql, /student_notifications_category_check[\s\S]*?'classroom'/);
  assert.match(sql, /create policy "students log own published classroom access"[\s\S]*?auth\.uid\(\) = student_id[\s\S]*?classroom_sessions\.is_published[\s\S]*?enrollments\.status = 'active'/);
  assert.match(sql, /create policy "staff read classroom access events"[\s\S]*?using \(public\.is_staff\(\)\)/);
  assert.match(sql, /create or replace function public\.notify_students_of_classroom_session[\s\S]*?insert into public\.student_notifications/);
});

test('student classroom provides a calendar download and records access attempts', async () => {
  const dashboard = await read('src/scripts/portals/student-dashboard.js');

  assert.match(dashboard, /BEGIN:VCALENDAR/);
  assert.match(dashboard, /classroom_access_events/);
  assert.match(dashboard, /download="\$\{escapeHtml\(classroomSession\.title/);
});
