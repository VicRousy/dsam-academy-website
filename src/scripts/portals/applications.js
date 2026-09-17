import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const status = document.querySelector('#adminStatus');
const list = document.querySelector('#applicationList');
const portalKicker = document.querySelector('#portalKicker');
const portalRole = document.querySelector('#portalRole');
const portalTitle = document.querySelector('#portalTitle');
const portalDescription = document.querySelector('#portalDescription');
const staffRequests = document.querySelector('#staffRequests');
const staffRequestList = document.querySelector('#staffRequestList');
const details = document.querySelector('#applicationDetails');
const detailsTitle = document.querySelector('#detailsTitle');
const detailsContent = document.querySelector('#detailsContent');
const search = document.querySelector('#applicationSearch');
const statusFilter = document.querySelector('#applicationStatus');
const statusLabels = { active: 'APPROVED', pending: 'PENDING', declined: 'DECLINED' };
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const formatDate = (value) => new Date(value).toLocaleString();
const formatNaira = (value) => `₦${Number(value || 0).toLocaleString()}`;
let applications = [];
let profiles = [];
let courses = [];
let privateNotes = new Map();
let isAdmin = false;
let pendingStaffCount = 0;

const showStatus = (message, error = false) => {
  status.textContent = message;
  status.className = error ? 'admin-status error' : 'admin-status';
};

const showPanel = async (panelName) => {
  document.querySelectorAll('.admin-panel').forEach((panel) => { panel.hidden = panel.id !== `${panelName}Panel`; });
  document.querySelectorAll('.admin-nav-button').forEach((button) => { button.classList.toggle('active', button.dataset.panel === panelName); });
  if (panelName === 'students') renderStudents();
  if (panelName === 'courses') await loadCourses();
  if (panelName === 'lessons') await loadLessons();
  if (panelName === 'payments') await loadPayments();
};

const updateMetrics = () => {
  document.querySelector('#totalApplications').textContent = applications.length;
  document.querySelector('#pendingApplications').textContent = applications.filter((application) => application.status === 'pending').length;
  document.querySelector('#activeStudents').textContent = new Set(applications.filter((application) => application.status === 'active').map((application) => application.student_id)).size;
  document.querySelector('#pendingStaffRequests').textContent = pendingStaffCount;
};

const filteredApplications = () => {
  const query = search.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  return applications.filter((application) => {
    const student = application.student;
    const searchable = [student?.full_name, student?.email, application.courses?.title].join(' ').toLowerCase();
    return (selectedStatus === 'all' || application.status === selectedStatus) && (!query || searchable.includes(query));
  });
};

const showDetails = (applicationId) => {
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return;
  const student = application.student;
  detailsTitle.textContent = student?.full_name || student?.email || 'Student application';
  detailsContent.innerHTML = `<dl class="details-grid"><div><dt>Programme</dt><dd>${escapeHtml(application.courses?.title || 'Not specified')}</dd></div><div><dt>Status</dt><dd>${statusLabels[application.status] || 'PENDING'}</dd></div><div><dt>Student email</dt><dd>${escapeHtml(student?.email || 'Not available')}</dd></div><div><dt>Application date</dt><dd>${formatDate(application.created_at)}</dd></div><div><dt>Student ID</dt><dd>${escapeHtml(application.student_id)}</dd></div><div><dt>Application ID</dt><dd>${escapeHtml(application.id)}</dd></div></dl>`;
  details.hidden = false;
  details.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const decideApplication = async (button) => {
  button.disabled = true;
  const { error } = await supabase.from('enrollments').update({ status: button.dataset.action }).eq('id', button.dataset.id);
  if (error) {
    showStatus(error.message, true);
    button.disabled = false;
    return;
  }
  const application = applications.find((item) => item.id === button.dataset.id);
  if (application) application.status = button.dataset.action;
  updateMetrics();
  renderApplications();
  showStatus(`Application ${button.dataset.action === 'active' ? 'approved' : 'declined'}.`);
};

const renderApplications = () => {
  const visibleApplications = filteredApplications();
  if (!visibleApplications.length) {
    list.hidden = false;
    list.innerHTML = '<p class="admin-empty">No applications match the current filters.</p>';
    return;
  }
  list.hidden = false;
  list.innerHTML = visibleApplications.map((application) => {
    const student = application.student;
    const name = student?.full_name || student?.email || 'Student';
    const course = application.courses?.title || 'Programme application';
    const actions = isAdmin
      ? `<div class="application-actions"><button data-action="active" data-id="${application.id}" ${application.status === 'active' ? 'disabled' : ''}>${application.status === 'active' ? 'Approved' : 'Approve'}</button><button data-action="declined" data-id="${application.id}" ${application.status === 'declined' ? 'disabled' : ''}>${application.status === 'declined' ? 'Declined' : 'Decline'}</button></div>`
      : '<p class="staff-readonly">Read-only staff access</p>';
    return `<article class="application-card"><div><p class="card-label">${statusLabels[application.status] || 'PENDING'}</p><h2>${escapeHtml(course)}</h2><p>${escapeHtml(name)}</p><p class="application-email">${escapeHtml(student?.email || 'No email available')}</p><p class="application-date">Applied ${new Date(application.created_at).toLocaleDateString()}</p></div><div class="application-card-actions"><button class="details-button" data-details-id="${application.id}" type="button">View details</button>${actions}</div></article>`;
  }).join('');
  list.querySelectorAll('[data-details-id]').forEach((button) => button.addEventListener('click', () => showDetails(button.dataset.detailsId)));
  list.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => decideApplication(button)));
};

const loadStaffRequests = async () => {
  if (!isAdmin) return;
  staffRequests.hidden = false;
  const { data: requests = [], error } = await supabase.from('staff_access_requests').select('id,email,requested_at').eq('status', 'pending').order('requested_at', { ascending: true });
  if (error) {
    staffRequestList.innerHTML = '<p class="admin-status error">Staff-access requests are not set up yet. Run the staff access SQL setup.</p>';
    return;
  }
  pendingStaffCount = requests.length;
  if (!requests.length) {
    staffRequestList.innerHTML = '<p class="staff-request-empty">No pending staff-access requests.</p>';
    return;
  }
  staffRequestList.innerHTML = requests.map((request) => `<article class="staff-request-card"><div><h3>${escapeHtml(request.email)}</h3><p>Requested ${new Date(request.requested_at).toLocaleDateString()}</p></div><div class="application-actions"><button data-request-decision="approved" data-request-id="${request.id}">Approve</button><button data-request-decision="denied" data-request-id="${request.id}">Deny</button></div></article>`).join('');
  staffRequestList.querySelectorAll('[data-request-id]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    const { error: decisionError } = await supabase.rpc('decide_staff_access', { request_id: Number(button.dataset.requestId), decision: button.dataset.requestDecision });
    if (decisionError) {
      showStatus(decisionError.message, true);
      button.disabled = false;
      return;
    }
    await loadStaffRequests();
    updateMetrics();
    showStatus(`Staff request ${button.dataset.requestDecision === 'approved' ? 'approved' : 'denied'}.`);
  }));
};

const loadApplications = async () => {
  const { data: rows, error } = await supabase.from('enrollments').select('id,student_id,status,created_at,courses(title)').order('created_at', { ascending: false });
  if (error) {
    showStatus(error.message, true);
    return;
  }
  applications = rows || [];
};

const renderStudentOptions = () => {
  const options = ['<option value="">Select a student</option>', ...profiles.map((profile) => `<option value="${profile.id}">${escapeHtml(profile.full_name || profile.email || 'Student')} · ${escapeHtml(profile.email || '')}</option>`)].join('');
  document.querySelector('#lessonStudent').innerHTML = options;
  document.querySelector('#paymentStudent').innerHTML = options;
};

const loadProfiles = async () => {
  const detailedQuery = await supabase.from('profiles').select('id,email,full_name,phone,instrument').order('full_name', { ascending: true });
  const fallbackQuery = detailedQuery.error ? await supabase.from('profiles').select('id,email,full_name').order('full_name', { ascending: true }) : detailedQuery;
  if (fallbackQuery.error) {
    showStatus(fallbackQuery.error.message, true);
    return;
  }
  profiles = fallbackQuery.data || [];
  const students = new Map(profiles.map((profile) => [profile.id, profile]));
  applications = applications.map((application) => ({ ...application, student: students.get(application.student_id) }));
  renderStudentOptions();
};

const loadPrivateNotes = async () => {
  if (!isAdmin) return;
  const { data, error } = await supabase.from('student_admin_notes').select('student_id,notes').limit(500);
  if (error) return;
  privateNotes = new Map((data || []).map((note) => [note.student_id, note.notes || '']));
};

const renderStudents = () => {
  const studentList = document.querySelector('#studentList');
  if (!profiles.length) {
    studentList.innerHTML = '<p class="admin-empty">No student records are available yet.</p>';
    return;
  }
  studentList.innerHTML = profiles.map((profile) => {
    const studentApplications = applications.filter((application) => application.student_id === profile.id);
    const approvedCount = studentApplications.filter((application) => application.status === 'active').length;
    const latestCourse = studentApplications[0]?.courses?.title || 'No application yet';
    const edit = isAdmin ? `<button class="details-button" data-student-id="${profile.id}" type="button">Edit record</button>` : '<span class="staff-readonly">Read-only</span>';
    return `<article class="management-card"><div><p class="card-label">${approvedCount ? 'ACTIVE STUDENT' : 'STUDENT RECORD'}</p><h3>${escapeHtml(profile.full_name || profile.email || 'Student')}</h3><p>${escapeHtml(profile.email || 'No email available')}</p><p>${escapeHtml(latestCourse)} · ${studentApplications.length} application${studentApplications.length === 1 ? '' : 's'}</p></div>${edit}</article>`;
  }).join('');
  studentList.querySelectorAll('[data-student-id]').forEach((button) => button.addEventListener('click', () => openStudentEditor(button.dataset.studentId)));
};

const openStudentEditor = (studentId) => {
  const profile = profiles.find((item) => item.id === studentId);
  if (!profile || !isAdmin) return;
  document.querySelector('#studentId').value = profile.id;
  document.querySelector('#studentFullName').value = profile.full_name || '';
  document.querySelector('#studentPhone').value = profile.phone || '';
  document.querySelector('#studentInstrument').value = profile.instrument || '';
  document.querySelector('#studentNotes').value = privateNotes.get(profile.id) || '';
  document.querySelector('#studentForm').hidden = false;
  document.querySelector('#studentForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const loadCourses = async () => {
  const courseList = document.querySelector('#courseList');
  const { data, error } = await supabase.from('courses').select('id,title,description,duration_weeks,tuition_ngn,is_active').order('title');
  if (error) {
    courseList.innerHTML = '<p class="admin-status error">Course management needs the `admin_operations.sql` migration to be run in Supabase first.</p>';
    return;
  }
  courses = data || [];
  document.querySelector('#lessonCourse').innerHTML = ['<option value="">No programme selected</option>', ...courses.filter((course) => course.is_active).map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`)].join('');
  courseList.innerHTML = courses.length ? courses.map((course) => `<article class="management-card"><div><p class="card-label">${course.is_active ? 'OPEN FOR ENROLMENT' : 'ARCHIVED'}</p><h3>${escapeHtml(course.title)}</h3><p>${escapeHtml(course.description || 'No description added.')}</p><p>${course.duration_weeks ? `${course.duration_weeks} weeks` : 'Duration not set'} · ${course.tuition_ngn === null ? 'Tuition not set' : formatNaira(course.tuition_ngn)}</p></div><button class="details-button" data-course-id="${course.id}" type="button">Edit</button></article>`).join('') : '<p class="admin-empty">No programmes have been added yet.</p>';
  courseList.querySelectorAll('[data-course-id]').forEach((button) => button.addEventListener('click', () => openCourseEditor(button.dataset.courseId)));
};

const openCourseEditor = (courseId) => {
  const course = courses.find((item) => item.id === courseId);
  if (!course || !isAdmin) return;
  document.querySelector('#courseId').value = course.id;
  document.querySelector('#courseTitle').value = course.title || '';
  document.querySelector('#courseDuration').value = course.duration_weeks || '';
  document.querySelector('#courseTuition').value = course.tuition_ngn || '';
  document.querySelector('#courseActive').value = String(course.is_active);
  document.querySelector('#courseDescription').value = course.description || '';
  document.querySelector('#cancelCourseEdit').hidden = false;
};

const resetCourseForm = () => {
  document.querySelector('#courseForm').reset();
  document.querySelector('#courseId').value = '';
  document.querySelector('#cancelCourseEdit').hidden = true;
};

const loadLessons = async () => {
  const lessonList = document.querySelector('#lessonList');
  if (!courses.length) await loadCourses();
  const { data, error } = await supabase.from('lesson_sessions').select('id,student_id,course_id,title,starts_at,instructor,location,status,courses(title)').order('starts_at', { ascending: true }).limit(100);
  if (error) {
    lessonList.innerHTML = '<p class="admin-status error">Lesson scheduling needs the `admin_operations.sql` migration to be run in Supabase first.</p>';
    return;
  }
  lessonList.innerHTML = data?.length ? data.map((lesson) => {
    const student = profiles.find((profile) => profile.id === lesson.student_id);
    return `<article class="management-card"><div><p class="card-label">${escapeHtml(lesson.status || 'scheduled').toUpperCase()}</p><h3>${escapeHtml(lesson.title || lesson.courses?.title || 'Lesson session')}</h3><p>${escapeHtml(student?.full_name || student?.email || 'Student')} · ${formatDate(lesson.starts_at)}</p><p>${escapeHtml(lesson.instructor || "DSAM'S Tutor")} · ${escapeHtml(lesson.location || "DSAM'S Academy")}</p></div></article>`;
  }).join('') : '<p class="admin-empty">No lessons are scheduled yet.</p>';
};

const loadPayments = async () => {
  const paymentList = document.querySelector('#paymentList');
  const { data, error } = await supabase.from('payments').select('id,student_id,amount_ngn,status,created_at,reference,notes').order('created_at', { ascending: false }).limit(100);
  if (error) {
    paymentList.innerHTML = '<p class="admin-status error">Payment management needs the `admin_operations.sql` migration to be run in Supabase first.</p>';
    return;
  }
  paymentList.innerHTML = data?.length ? data.map((payment) => {
    const student = profiles.find((profile) => profile.id === payment.student_id);
    return `<article class="management-card"><div><p class="card-label">${escapeHtml(payment.status || 'pending').toUpperCase()}</p><h3>${formatNaira(payment.amount_ngn)}</h3><p>${escapeHtml(student?.full_name || student?.email || 'Student')} · ${new Date(payment.created_at).toLocaleDateString()}</p><p>${escapeHtml(payment.reference || 'No reference')} ${payment.notes ? `· ${escapeHtml(payment.notes)}` : ''}</p></div></article>`;
  }).join('') : '<p class="admin-empty">No payment records have been added yet.</p>';
};

const bindForms = () => {
  document.querySelector('#studentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const studentId = document.querySelector('#studentId').value;
    const updates = {
      full_name: document.querySelector('#studentFullName').value.trim(),
      phone: document.querySelector('#studentPhone').value.trim() || null,
      instrument: document.querySelector('#studentInstrument').value.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('profiles').update(updates).eq('id', studentId);
    if (error) return showStatus(error.message, true);
    const note = document.querySelector('#studentNotes').value.trim() || null;
    const { error: noteError } = await supabase.from('student_admin_notes').upsert({ student_id: studentId, notes: note, updated_at: new Date().toISOString() });
    if (noteError) return showStatus(noteError.message, true);
    const profile = profiles.find((item) => item.id === studentId);
    if (profile) Object.assign(profile, updates);
    privateNotes.set(studentId, note || '');
    document.querySelector('#studentForm').hidden = true;
    renderStudents();
    showStatus('Student record updated.');
  });
  document.querySelector('#cancelStudentEdit').addEventListener('click', () => { document.querySelector('#studentForm').hidden = true; });
  document.querySelector('#courseForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const courseId = document.querySelector('#courseId').value;
    const duration = document.querySelector('#courseDuration').value;
    const tuition = document.querySelector('#courseTuition').value;
    const payload = {
      title: document.querySelector('#courseTitle').value.trim(),
      description: document.querySelector('#courseDescription').value.trim() || null,
      duration_weeks: duration ? Number(duration) : null,
      tuition_ngn: tuition ? Number(tuition) : null,
      is_active: document.querySelector('#courseActive').value === 'true',
      updated_at: new Date().toISOString(),
    };
    const request = courseId ? supabase.from('courses').update(payload).eq('id', courseId) : supabase.from('courses').insert(payload);
    const { error } = await request;
    if (error) return showStatus(error.message, true);
    resetCourseForm();
    await loadCourses();
    showStatus(`Programme ${courseId ? 'updated' : 'created'}.`);
  });
  document.querySelector('#cancelCourseEdit').addEventListener('click', resetCourseForm);
  document.querySelector('#lessonForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      student_id: document.querySelector('#lessonStudent').value,
      course_id: document.querySelector('#lessonCourse').value || null,
      title: document.querySelector('#lessonTitle').value.trim() || null,
      starts_at: new Date(document.querySelector('#lessonStartsAt').value).toISOString(),
      instructor: document.querySelector('#lessonInstructor').value.trim() || null,
      location: document.querySelector('#lessonLocation').value.trim() || null,
    };
    const { error } = await supabase.from('lesson_sessions').insert(payload);
    if (error) return showStatus(error.message, true);
    event.currentTarget.reset();
    await loadLessons();
    showStatus('Lesson scheduled.');
  });
  document.querySelector('#paymentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      student_id: document.querySelector('#paymentStudent').value,
      amount_ngn: Number(document.querySelector('#paymentAmount').value),
      status: document.querySelector('#paymentStatus').value,
      reference: document.querySelector('#paymentReference').value.trim() || null,
      notes: document.querySelector('#paymentNotes').value.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('payments').insert(payload);
    if (error) return showStatus(error.message, true);
    event.currentTarget.reset();
    await loadPayments();
    showStatus('Payment record saved.');
  });
};

const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  window.location.replace('./admin-login.html');
} else {
  document.querySelector('#signOutButton').onclick = async () => {
    await supabase.auth.signOut();
    window.location.replace('./admin-login.html');
  };
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
  if (!['admin', 'staff'].includes(role?.role)) {
    window.location.replace('./dashboard.html');
  } else {
    isAdmin = role.role === 'admin';
    portalKicker.textContent = isAdmin ? 'ADMIN PORTAL' : 'STAFF PORTAL';
    portalRole.textContent = isAdmin ? 'ADMIN PORTAL' : 'STAFF PORTAL';
    portalTitle.textContent = isAdmin ? 'Academy operations' : 'Teaching operations';
    portalDescription.textContent = isAdmin ? 'Manage admissions, student records, programmes, lessons, payments, and staff access.' : 'Review applications and manage lessons with approved staff access.';
    document.title = `${isAdmin ? 'Admin' : 'Staff'} Portal | DSAM'S Academy of Music`;
    if (!isAdmin) document.querySelectorAll('[data-admin-only]').forEach((element) => { element.hidden = true; });
    search.addEventListener('input', renderApplications);
    statusFilter.addEventListener('change', renderApplications);
    document.querySelector('#closeDetails').addEventListener('click', () => { details.hidden = true; });
    document.querySelectorAll('.admin-nav-button').forEach((button) => button.addEventListener('click', () => showPanel(button.dataset.panel)));
    bindForms();
    await loadApplications();
    await loadProfiles();
    await loadPrivateNotes();
    await loadStaffRequests();
    updateMetrics();
    renderApplications();
  }
}
