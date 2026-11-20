import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('every page uses the compact academy logo', async () => {
  const pages = ['index.html', 'auth.html', 'student-login.html', 'student-signup.html', 'reset-password.html', 'dashboard.html', 'admin-login.html', 'staff-login.html', 'admin.html'];
  for (const page of pages) {
    const markup = await read(page);
    assert.match(markup, /src="\/assets\/dsam-academy-logo\.png"/);
    assert.doesNotMatch(markup, /dsam-academy-logo-4k\.png/);
  }
});

test('public navigation has keyboard access and real contact links', async () => {
  const markup = await read('index.html');
  const script = await read('src/scripts/site/main.js');
  const styles = await read('src/styles/styles.css');

  assert.match(markup, /class="skip-link" href="#mainContent"/);
  assert.match(markup, /id="mobileNav"[^>]*inert/);
  assert.match(markup, /class="social-icon"[^>]*aria-label="Message DSAM'S Academy on WhatsApp"/);
  assert.doesNotMatch(markup, /href="#" class="social-icon"/);
  assert.match(script, /mobileNav\.inert = false/);
  assert.match(script, /mobileNav\.inert = true/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(styles, /body > header \{/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test('public homepage preserves its copy and destinations with the editorial layout', async () => {
  const markup = await read('index.html');
  const styles = await read('src/styles/home.css');
  const script = await read('src/scripts/site/main.js');

  assert.match(markup, /href="\.\/src\/styles\/home\.css"/);
  for (const copy of [
    'The Purest of Sounds for the Heart and Soul',
    'Where Passion Meets <span>Mastery</span>',
    'Music Programmes',
    'Configure Your Track',
    'How Enrolment Works',
    'Begin Your Musical Journey',
    'Submit Formal Enrollment Application',
  ]) {
    assert.ok(markup.includes(copy));
  }
  for (const destination of ['./auth.html', './staff-login.html', './admin-login.html', '#programs', '#estimator', '#contact']) {
    assert.ok(markup.includes(`href="${destination}"`));
  }
  assert.match(markup, /<details class="portal-menu">/);
  assert.doesNotMatch(markup, /class="(?:experience-strip|approach-section|statement-section)"/);
  assert.doesNotMatch(markup, /fake testimonial|trusted by players|start free trial/i);
  assert.match(markup, /<use href="#icon-star"><\/use><\/svg><span>The Purest of Sounds for the Heart and Soul<\/span>/);
  assert.doesNotMatch(markup, /font-awesome\/6\.4\.0\/css\/all\.min\.css/);
  for (const icon of ['star', 'menu', 'close', 'laptop', 'graduation', 'location', 'phone', 'envelope', 'instagram', 'whatsapp']) {
    assert.ok(markup.includes(`id="icon-${icon}"`));
    assert.ok(markup.includes(`href="#icon-${icon}"`));
  }
  for (const photoId of [
    'photo-1755287078382-94c1ad66cf8e',
    'photo-1621368286550-f54551f39b91',
    'photo-1471478331149-c72f17e33c73',
  ]) {
    assert.ok(markup.includes(`src="https://images.unsplash.com/${photoId}?auto=format&q=82&w=1200"`));
    assert.ok(markup.includes(`https://images.unsplash.com/${photoId}?auto=format&q=82&w=1600 1600w`));
  }
  assert.equal((markup.match(/sizes="\(max-width: 560px\) 90vw[^\"]+"/g) || []).length, 3);
  assert.equal((markup.match(/loading="lazy" decoding="async"/g) || []).length, 3);
  assert.doesNotMatch(markup, /photo-1520523839897-bd0b52f945a0|photo-1510915361894-db8b60106cb1/);
  assert.doesNotMatch(styles, /course-photo-(?:theory|practical|diploma)/);
  for (const field of ['firstName', 'lastName', 'email', 'ageGroup', 'lessonFormat', 'track']) {
    assert.match(markup, new RegExp(`<label class="form-field">[^<]+<(?:input|select)[^>]+name="${field}"`));
  }
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(script, /portalMenu\.open = false/);
  assert.match(script, /button\.setAttribute\('aria-pressed', 'true'\)/);
});

test('all portal entry and workspace pages share the academy visual language', async () => {
  const pages = ['auth.html', 'student-login.html', 'student-signup.html', 'reset-password.html', 'staff-login.html', 'admin-login.html', 'dashboard.html', 'admin.html'];
  for (const page of pages) {
    const markup = await read(page);
    assert.match(markup, /href="\.\/src\/styles\/portal-theme\.css"/);
    assert.match(markup, /family=Cormorant\+Garamond/);
    assert.doesNotMatch(markup, /family=Syne/);
  }
  for (const page of pages.slice(0, 6)) {
    const markup = await read(page);
    assert.match(markup, /<header class="auth-header">[\s\S]*?<a class="auth-back" href="[^"]+">[\s\S]*?<\/header>\s*<section class="auth-card">/);
    assert.equal((markup.match(/class="auth-back"/g) || []).length, 1);
  }

  const styles = await read('src/styles/portal-theme.css');
  assert.match(styles, /\.auth-page \{/);
  assert.match(styles, /\.auth-page \.auth-shell \{[\s\S]*?grid-template-columns: minmax\(0, \.94fr\) minmax\(0, 1\.06fr\)/);
  assert.match(styles, /\.auth-page \.auth-shell::after \{[\s\S]*?grid-row: 2;/);
  assert.match(styles, /@media \(max-width: 760px\) \{\s*\.auth-page \.auth-shell \{ grid-template-columns: 1fr;/);
  assert.match(styles, /\.auth-page \.auth-header,\s*\.portal-page \.portal-header \{/);
  assert.match(styles, /\.auth-page \.auth-card \{[\s\S]*?width: 100%;/);
  assert.match(styles, /\.portal-page \{/);
  assert.match(styles, /\.portal-page \.portal-welcome \{[\s\S]*?background: #291c15;/);
  assert.match(styles, /\.portal-page \.student-sidebar/);
  assert.match(styles, /\.portal-page \.admin-navigation/);
  assert.match(styles, /\.portal-page \.admin-shell > \.admin-metrics \{ order: 1; \}/);
  assert.match(styles, /\.portal-page \.management-form input/);
  assert.match(styles, /\.portal-page \.service-badge\.approved/);
});

test('management and student sections expose active state and responsive menus', async () => {
  const admin = await read('admin.html');
  const dashboard = await read('dashboard.html');
  const adminScript = await read('src/scripts/portals/applications.js');
  const studentScript = await read('src/scripts/portals/student-dashboard.js');
  const styles = await read('src/styles/styles.css');
  const portalTheme = await read('src/styles/portal-theme.css');

  assert.match(admin, /id="adminMenuToggle"[^>]*aria-controls="adminNavigation"/);
  assert.match(admin, /id="adminNavigation"[^>]*aria-label="Management sections"/);
  for (const panel of ['applications', 'students', 'lessons', 'classroom', 'learning', 'curriculum', 'services', 'courses', 'payments', 'announcements', 'staffAccess']) {
    assert.match(admin, new RegExp(`data-panel="${panel}"[^>]*aria-controls="${panel}Panel"[^>]*aria-pressed=`));
  }
  assert.match(admin, /id="staffAccessPanel"[^>]*data-admin-only/);
  assert.match(admin, /id="adminMetrics"[^>]*aria-busy="true"/);
  assert.match(adminScript, /applicationsLoaded \? applications\.length : '—'/);
  assert.match(adminScript, /button\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(adminScript, /adminMenuToggle\.setAttribute\('aria-expanded', String\(isOpen\)\)/);
  assert.match(styles, /\.admin-shell \{ max-width:1240px; display:grid/);
  assert.match(styles, /\.admin-navigation\.is-open \{ display:grid; \}/);
  assert.match(dashboard, /data-student-panel="classroom"[^>]*aria-controls="classroomStudentPanel"/);
  assert.match(studentScript, /button\.setAttribute\('aria-pressed', String\(active\)\)/);
  assert.match(dashboard, /id="applicationAction"/);
  assert.match(studentScript, /applicationAction\.hidden = latestEnrolment\.status !== 'active'/);
  assert.match(studentScript, /showStudentPanel\('classroom', true\)/);
  assert.match(styles, /\.student-portal-page \.dashboard-grid \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.student-portal-page \.dashboard-grid \.dashboard-card:first-child \{ grid-column:1\/-1; \}/);
  assert.match(dashboard, /<div class="student-overview-details">\s*<section class="dashboard-card student-profile-card">[\s\S]*?<section class="dashboard-card enrollment-history">/);
  assert.match(portalTheme, /grid-template-areas: "application lesson" "application payment"/);
  assert.match(portalTheme, /\.student-portal-page \.student-overview-details \{[\s\S]*?grid-template-columns: minmax\(0, 1\.45fr\) minmax\(0, \.8fr\)/);
  assert.match(portalTheme, /\.student-portal-page \.dashboard-grid #applicationAction\[hidden\] \{ display: none; \}/);
  assert.match(portalTheme, /grid-template-areas: "application" "lesson" "payment"/);
});
