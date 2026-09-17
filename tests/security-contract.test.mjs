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
