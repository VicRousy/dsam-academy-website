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
let learningMaterials = [];
let curriculumStages = [];
let curriculumSessions = [];
let announcements = [];
let classroomSessions = [];
let classroomAccessStats = new Map();
let isAdmin = false;
let pendingStaffCount = 0;
const materialBucket = 'academy-materials';
const maxMaterialFileSize = 50 * 1024 * 1024;
const supportedMaterialExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'mp3', 'wav', 'm4a', 'mp4', 'mov']);

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
  if (panelName === 'classroom') await loadClassroom();
  if (panelName === 'learning') await loadLearningWorkspace();
  if (panelName === 'curriculum') await loadCurriculum();
  if (panelName === 'services') await loadStudentServices();
  if (panelName === 'payments') await loadPayments();
  if (panelName === 'announcements') await loadAnnouncements();
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

const showDetails = async (applicationId) => {
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return;
  const student = application.student;
  detailsTitle.textContent = student?.full_name || student?.email || 'Student application';
  detailsContent.innerHTML = `<dl class="details-grid"><div><dt>Programme</dt><dd>${escapeHtml(application.courses?.title || 'Not specified')}</dd></div><div><dt>Status</dt><dd>${statusLabels[application.status] || 'PENDING'}</dd></div><div><dt>Student email</dt><dd>${escapeHtml(student?.email || 'Not available')}</dd></div><div><dt>Application date</dt><dd>${formatDate(application.created_at)}</dd></div><div><dt>Student ID</dt><dd>${escapeHtml(application.student_id)}</dd></div><div><dt>Application ID</dt><dd>${escapeHtml(application.id)}</dd></div></dl>`;
  document.querySelector('#applicationIntakeForm').reset();
  document.querySelector('#intakeEnrollmentId').value = application.id;
  const intakeStatus = document.querySelector('#intakeStatus');
  intakeStatus.className = 'form-hint';
  intakeStatus.textContent = 'Loading application form details…';
  details.hidden = false;
  details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const { data, error } = await supabase.from('application_intake_details')
    .select('surname,first_name,middle_name,address,phone,study_duration,major_instrument,minor_instrument,grade_level,paper_signed_on')
    .eq('enrollment_id', applicationId).maybeSingle();
  if (details.hidden || document.querySelector('#intakeEnrollmentId').value !== applicationId) return;
  if (error) {
    intakeStatus.className = 'form-hint error';
    intakeStatus.textContent = 'Application form details need the curriculum workspace database upgrade.';
    return;
  }
  intakeStatus.className = 'form-hint';
  if (!data) {
    intakeStatus.textContent = 'No paper application details have been recorded yet.';
    return;
  }
  const fields = {
    intakeSurname: data.surname,
    intakeFirstName: data.first_name,
    intakeMiddleName: data.middle_name,
    intakeAddress: data.address,
    intakePhone: data.phone,
    intakeDuration: data.study_duration,
    intakeMajorInstrument: data.major_instrument,
    intakeMinorInstrument: data.minor_instrument,
    intakeGradeLevel: data.grade_level,
    intakeSignedOn: data.paper_signed_on,
  };
  Object.entries(fields).forEach(([id, value]) => { document.getElementById(id).value = value || ''; });
  intakeStatus.textContent = 'Application form details are saved for staff review.';
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
  document.querySelector('#progressStudent').innerHTML = options;
  document.querySelector('#invoiceStudent').innerHTML = options;
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
  document.querySelector('#materialCourse').innerHTML = ['<option value="">Select a programme</option>', ...courses.map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`)].join('');
  document.querySelector('#progressCourse').innerHTML = ['<option value="">No programme selected</option>', ...courses.map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`)].join('');
  document.querySelector('#classroomCourse').innerHTML = ['<option value="">Select a programme</option>', ...courses.filter((course) => course.is_active).map((course) => `<option value="${course.id}">${escapeHtml(course.title)}</option>`)].join('');
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

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const toggleClassroomFields = () => {
  const isLive = document.querySelector('#classroomType').value === 'live';
  document.querySelector('#classroomJoinField').hidden = !isLive;
  document.querySelector('#classroomRecordingField').hidden = isLive;
  document.querySelector('#classroomEndsField').hidden = !isLive;
  document.querySelector('#classroomJoinUrl').required = isLive;
  document.querySelector('#classroomRecordingUrl').required = !isLive;
};

const resetClassroomForm = () => {
  document.querySelector('#classroomForm').reset();
  document.querySelector('#classroomId').value = '';
  document.querySelector('#cancelClassroomEdit').hidden = true;
  toggleClassroomFields();
};

const openClassroomEditor = (classroomId) => {
  const classroomSession = classroomSessions.find((item) => item.id === classroomId);
  if (!classroomSession) return;
  document.querySelector('#classroomId').value = classroomSession.id;
  document.querySelector('#classroomCourse').value = classroomSession.course_id;
  document.querySelector('#classroomType').value = classroomSession.delivery_type;
  document.querySelector('#classroomProvider').value = classroomSession.provider || 'other';
  document.querySelector('#classroomStartsAt').value = toDateTimeLocal(classroomSession.starts_at);
  document.querySelector('#classroomEndsAt').value = toDateTimeLocal(classroomSession.ends_at);
  document.querySelector('#classroomTitle').value = classroomSession.title || '';
  document.querySelector('#classroomJoinUrl').value = classroomSession.join_url || '';
  document.querySelector('#classroomRecordingUrl').value = classroomSession.recording_url || '';
  document.querySelector('#classroomDescription').value = classroomSession.description || '';
  document.querySelector('#classroomPublished').value = String(classroomSession.is_published);
  document.querySelector('#cancelClassroomEdit').hidden = false;
  toggleClassroomFields();
  document.querySelector('#classroomForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const loadClassroom = async () => {
  await loadCourses();
  const classroomList = document.querySelector('#classroomList');
  const { data, error } = await supabase
    .from('classroom_sessions')
    .select('id,course_id,title,description,delivery_type,provider,starts_at,ends_at,join_url,recording_url,is_published,courses(title)')
    .order('starts_at', { ascending: false })
    .limit(100);

  if (error) {
    classroomList.innerHTML = '<p class="admin-status error">Classroom delivery needs the `classroom_delivery.sql` migration to be run in Supabase first.</p>';
    return;
  }

  classroomSessions = data || [];
  const { data: accessEvents } = await supabase
    .from('classroom_access_events')
    .select('classroom_session_id,student_id,accessed_at')
    .order('accessed_at', { ascending: false })
    .limit(1000);
  classroomAccessStats = new Map();
  (accessEvents || []).forEach((accessEvent) => {
    const current = classroomAccessStats.get(accessEvent.classroom_session_id) || { students: new Set(), latestAccess: null };
    current.students.add(accessEvent.student_id);
    if (!current.latestAccess || new Date(accessEvent.accessed_at) > new Date(current.latestAccess)) current.latestAccess = accessEvent.accessed_at;
    classroomAccessStats.set(accessEvent.classroom_session_id, current);
  });
  classroomList.innerHTML = classroomSessions.length
    ? classroomSessions.map((classroomSession) => {
      const access = classroomAccessStats.get(classroomSession.id);
      const accessSummary = access ? `${access.students.size} student${access.students.size === 1 ? '' : 's'} opened this item${access.latestAccess ? ` · Last opened ${formatDate(access.latestAccess)}` : ''}` : 'No student access recorded yet';
      return `<article class="management-card"><div><p class="card-label">${escapeHtml(classroomSession.delivery_type).toUpperCase()} · ${classroomSession.is_published ? 'PUBLISHED' : 'DRAFT'}</p><h3>${escapeHtml(classroomSession.title)}</h3><p>${escapeHtml(classroomSession.courses?.title || 'Programme')} · ${formatDate(classroomSession.starts_at)}</p><p>${escapeHtml(classroomSession.provider || 'other').replaceAll('_', ' ')}${classroomSession.description ? ` · ${escapeHtml(classroomSession.description)}` : ''}</p><p>${escapeHtml(accessSummary)}</p></div><button class="details-button" data-classroom-id="${classroomSession.id}" type="button">Edit</button></article>`;
    }).join('')
    : '<p class="admin-empty">No live classes or recordings have been added yet.</p>';
  classroomList.querySelectorAll('[data-classroom-id]').forEach((button) => button.addEventListener('click', () => openClassroomEditor(button.dataset.classroomId)));
};

const loadLessons = async () => {
  const lessonList = document.querySelector('#lessonList');
  if (!courses.length) await loadCourses();
  let result = await supabase.from('lesson_sessions').select('id,student_id,course_id,title,starts_at,instructor,location,status,attendance_status,courses(title)').order('starts_at', { ascending: true }).limit(100);
  if (result.error) result = await supabase.from('lesson_sessions').select('id,student_id,course_id,title,starts_at,instructor,location,status,courses(title)').order('starts_at', { ascending: true }).limit(100);
  if (result.error) {
    lessonList.innerHTML = '<p class="admin-status error">Lesson scheduling needs the `admin_operations.sql` migration to be run in Supabase first.</p>';
    return;
  }
  lessonList.innerHTML = result.data?.length ? result.data.map((lesson) => {
    const student = profiles.find((profile) => profile.id === lesson.student_id);
    const attendance = lesson.attendance_status ? `<label class="lesson-attendance">Attendance<select data-attendance-id="${lesson.id}"><option value="scheduled" ${lesson.attendance_status === 'scheduled' ? 'selected' : ''}>Scheduled</option><option value="attended" ${lesson.attendance_status === 'attended' ? 'selected' : ''}>Attended</option><option value="missed" ${lesson.attendance_status === 'missed' ? 'selected' : ''}>Missed</option><option value="cancelled" ${lesson.attendance_status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></label>` : '';
    return `<article class="management-card"><div><p class="card-label">${escapeHtml(lesson.status || 'scheduled').toUpperCase()}</p><h3>${escapeHtml(lesson.title || lesson.courses?.title || 'Lesson session')}</h3><p>${escapeHtml(student?.full_name || student?.email || 'Student')} · ${formatDate(lesson.starts_at)}</p><p>${escapeHtml(lesson.instructor || "DSAM'S Tutor")} · ${escapeHtml(lesson.location || "DSAM'S Academy")}</p></div>${attendance}</article>`;
  }).join('') : '<p class="admin-empty">No lessons are scheduled yet.</p>';
  lessonList.querySelectorAll('[data-attendance-id]').forEach((select) => select.addEventListener('change', async () => {
    const { error } = await supabase.from('lesson_sessions').update({ attendance_status: select.value, updated_at: new Date().toISOString() }).eq('id', select.dataset.attendanceId);
    if (error) return showStatus(error.message, true);
    showStatus('Lesson attendance updated.');
  }));
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

const resetMaterialForm = () => {
  document.querySelector('#materialForm').reset();
  document.querySelector('#materialId').value = '';
  document.querySelector('#cancelMaterialEdit').hidden = true;
  document.querySelector('#materialFileStatus').textContent = 'Use either a secure link or a file up to 50 MB. Students in the selected programme are the only students who can open uploaded files.';
};

const openMaterialEditor = (materialId) => {
  const material = learningMaterials.find((item) => item.id === materialId);
  if (!material) return;
  document.querySelector('#materialId').value = material.id;
  document.querySelector('#materialCourse').value = material.course_id;
  document.querySelector('#materialType').value = material.material_type || 'resource';
  document.querySelector('#materialTitle').value = material.title || '';
  document.querySelector('#materialUrl').value = material.resource_url || '';
  document.querySelector('#materialDescription').value = material.description || '';
  document.querySelector('#materialPublished').value = String(material.is_published);
  document.querySelector('#cancelMaterialEdit').hidden = false;
  document.querySelector('#materialFileStatus').textContent = material.storage_path ? `Current private upload: ${material.storage_path.split('/').at(-1)}. Choose a new file or enter a replacement link to replace it.` : 'This material currently uses an external link or has no uploaded file.';
  document.querySelector('#materialForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const loadLearningWorkspace = async () => {
  await loadCourses();
  const materialList = document.querySelector('#materialList');
  const { data, error } = await supabase.from('learning_materials').select('id,course_id,title,description,material_type,resource_url,storage_path,is_published,created_at,courses(title)').order('created_at', { ascending: false }).limit(100);
  if (error) {
    materialList.innerHTML = '<p class="admin-status error">Learning tools need the `learning_workspace.sql` migration to be run in Supabase first.</p>';
    document.querySelector('#progressList').innerHTML = '';
    return;
  }
  learningMaterials = data || [];
  materialList.innerHTML = learningMaterials.length ? learningMaterials.map((material) => `<article class="management-card"><div><p class="card-label">${escapeHtml(material.material_type || 'resource').replace('_', ' ').toUpperCase()} · ${material.is_published ? 'PUBLISHED' : 'DRAFT'}</p><h3>${escapeHtml(material.title)}</h3><p>${escapeHtml(material.courses?.title || 'Programme')}</p><p>${escapeHtml(material.description || 'No description added.')}</p><p>${material.storage_path ? 'Private uploaded file' : material.resource_url ? 'External resource link' : 'No file or link attached'}</p></div><button class="details-button" data-material-id="${material.id}" type="button">Edit</button></article>`).join('') : '<p class="admin-empty">No learning materials have been added yet.</p>';
  materialList.querySelectorAll('[data-material-id]').forEach((button) => button.addEventListener('click', () => openMaterialEditor(button.dataset.materialId)));
  await loadProgressEntries();
};

const uploadMaterialFile = async (file, courseId) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!supportedMaterialExtensions.has(extension)) return { error: 'Choose a PDF, Office document, image, audio, or video file.' };
  if (file.size > maxMaterialFileSize) return { error: 'Uploaded files must be 50 MB or smaller.' };
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || `material.${extension}`;
  const path = `${courseId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(materialBucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
  return error ? { error: error.message } : { path };
};

const loadProgressEntries = async () => {
  const progressList = document.querySelector('#progressList');
  const { data, error } = await supabase.from('student_progress_entries').select('id,student_id,course_id,title,feedback,practice_goal,progress_level,recorded_at,courses(title)').order('recorded_at', { ascending: false }).limit(100);
  if (error) {
    progressList.innerHTML = '<p class="admin-status error">Student progress needs the `learning_workspace.sql` migration to be run in Supabase first.</p>';
    return;
  }
  progressList.innerHTML = data?.length ? data.map((entry) => {
    const student = profiles.find((profile) => profile.id === entry.student_id);
    return `<article class="management-card"><div><p class="card-label">${escapeHtml(entry.progress_level || 'developing').toUpperCase()}</p><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(student?.full_name || student?.email || 'Student')} · ${escapeHtml(entry.courses?.title || 'General study')}</p><p>${escapeHtml(entry.feedback || entry.practice_goal || 'Progress update recorded.')}</p></div></article>`;
  }).join('') : '<p class="admin-empty">No student progress updates have been recorded yet.</p>';
};

const resetAnnouncementForm = () => {
  document.querySelector('#announcementForm').reset();
  document.querySelector('#announcementId').value = '';
  document.querySelector('#cancelAnnouncementEdit').hidden = true;
};

const openAnnouncementEditor = (announcementId) => {
  const announcement = announcements.find((item) => item.id === announcementId);
  if (!announcement || !isAdmin) return;
  document.querySelector('#announcementId').value = announcement.id;
  document.querySelector('#announcementTitle').value = announcement.title || '';
  document.querySelector('#announcementAudience').value = announcement.audience || 'students';
  document.querySelector('#announcementPublished').value = String(announcement.is_published);
  document.querySelector('#announcementBody').value = announcement.body || '';
  document.querySelector('#cancelAnnouncementEdit').hidden = false;
  document.querySelector('#announcementForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const loadAnnouncements = async () => {
  const announcementList = document.querySelector('#announcementList');
  const { data, error } = await supabase.from('academy_announcements').select('id,title,body,audience,is_published,published_at,updated_at').order('published_at', { ascending: false }).limit(100);
  if (error) {
    announcementList.innerHTML = '<p class="admin-status error">Announcements need the `learning_workspace.sql` migration to be run in Supabase first.</p>';
    return;
  }
  announcements = data || [];
  announcementList.innerHTML = announcements.length ? announcements.map((announcement) => `<article class="management-card"><div><p class="card-label">${announcement.is_published ? 'PUBLISHED' : 'DRAFT'} · ${escapeHtml(announcement.audience || 'students').replace('_', ' ').toUpperCase()}</p><h3>${escapeHtml(announcement.title)}</h3><p>${escapeHtml(announcement.body)}</p><p>${formatDate(announcement.updated_at || announcement.published_at)}</p></div><button class="details-button" data-announcement-id="${announcement.id}" type="button">Edit</button></article>`).join('') : '<p class="admin-empty">No announcements have been created yet.</p>';
  announcementList.querySelectorAll('[data-announcement-id]').forEach((button) => button.addEventListener('click', () => openAnnouncementEditor(button.dataset.announcementId)));
};

const resetCurriculumStageForm = () => {
  document.querySelector('#curriculumStageForm').reset();
  document.querySelector('#curriculumStageId').value = '';
  document.querySelector('#curriculumStageEditorTitle').textContent = 'Add a curriculum stage';
};

const resetCurriculumSessionForm = () => {
  document.querySelector('#curriculumSessionForm').reset();
  document.querySelector('#curriculumSessionId').value = '';
  document.querySelector('#curriculumSessionEditorTitle').textContent = 'Add a session';
};

const openCurriculumStageEditor = (stageId) => {
  const stage = curriculumStages.find((item) => item.id === stageId);
  if (!stage) return;
  document.querySelector('#curriculumStageId').value = stage.id;
  document.querySelector('#curriculumTrackName').value = stage.track_name;
  document.querySelector('#curriculumStageName').value = stage.stage_name;
  document.querySelector('#curriculumStageOrder').value = stage.stage_order;
  document.querySelector('#curriculumStageEditorTitle').textContent = 'Edit curriculum stage';
  const editor = document.querySelector('#curriculumStageForm').closest('details');
  editor.open = true;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const openCurriculumSessionEditor = (sessionId) => {
  const curriculumSession = curriculumSessions.find((item) => item.id === sessionId);
  if (!curriculumSession) return;
  document.querySelector('#curriculumStageSelect').value = curriculumSession.stage_id;
  renderCurriculum();
  document.querySelector('#curriculumSessionId').value = curriculumSession.id;
  document.querySelector('#curriculumSessionOrder').value = curriculumSession.session_order;
  document.querySelector('#curriculumSessionLabel').value = curriculumSession.session_label;
  document.querySelector('#curriculumTopic').value = curriculumSession.topic;
  document.querySelector('#curriculumObjectives').value = curriculumSession.objectives;
  document.querySelector('#curriculumSessionEditorTitle').textContent = 'Edit session';
  const editor = document.querySelector('#curriculumSessionEditor');
  editor.open = true;
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const renderCurriculum = () => {
  const selectedId = document.querySelector('#curriculumStageSelect').value;
  const selectedStage = curriculumStages.find((stage) => stage.id === selectedId);
  const stageList = document.querySelector('#curriculumStageList');
  const sessionCounts = new Map();
  curriculumSessions.forEach((item) => { sessionCounts.set(item.stage_id, (sessionCounts.get(item.stage_id) || 0) + 1); });
  stageList.innerHTML = curriculumStages.length ? curriculumStages.map((stage) => `<article class="management-card"><div><p class="card-label">${escapeHtml(stage.track_name).toUpperCase()} · STAGE ${stage.stage_order}</p><h3>${escapeHtml(stage.stage_name)}</h3><p>${sessionCounts.get(stage.id) || 0} session blocks</p></div><button class="details-button" type="button" data-curriculum-stage-id="${stage.id}">Edit stage</button></article>`).join('') : '<p class="admin-empty">No curriculum stages have been added yet.</p>';
  stageList.querySelectorAll('[data-curriculum-stage-id]').forEach((button) => button.addEventListener('click', () => openCurriculumStageEditor(button.dataset.curriculumStageId)));
  document.querySelector('#curriculumSessionsTitle').textContent = selectedStage ? `${selectedStage.track_name} · ${selectedStage.stage_name}` : 'Sessions';
  document.querySelector('#curriculumSessionEditor').hidden = !selectedStage;
  const sessionList = document.querySelector('#curriculumSessionList');
  if (!selectedStage) {
    sessionList.innerHTML = '<p class="admin-empty">Choose a stage to view its sessions.</p>';
    return;
  }
  const visibleSessions = curriculumSessions.filter((item) => item.stage_id === selectedId);
  sessionList.innerHTML = visibleSessions.length ? visibleSessions.map((item) => `<article class="curriculum-session-card"><div><p class="card-label">${escapeHtml(item.session_label).toUpperCase()}</p><h4>Topic</h4><p>${escapeHtml(item.topic)}</p><h4>Specific objectives</h4><p>${escapeHtml(item.objectives)}</p></div><button class="details-button" type="button" data-curriculum-session-id="${item.id}">Edit session</button></article>`).join('') : '<p class="admin-empty">No sessions have been added for this stage.</p>';
  sessionList.querySelectorAll('[data-curriculum-session-id]').forEach((button) => button.addEventListener('click', () => openCurriculumSessionEditor(button.dataset.curriculumSessionId)));
};

const loadCurriculum = async (preferredStageId) => {
  const stageSelect = document.querySelector('#curriculumStageSelect');
  const selectedId = preferredStageId || stageSelect.value;
  const [stageResult, sessionResult] = await Promise.all([
    supabase.from('curriculum_stages').select('id,track_name,stage_name,stage_order').order('track_name').order('stage_order'),
    supabase.from('curriculum_sessions').select('id,stage_id,session_order,session_label,topic,objectives').order('session_order'),
  ]);
  if (stageResult.error || sessionResult.error) {
    document.querySelector('#curriculumStageList').innerHTML = '<p class="admin-status error">Curriculum needs the `curriculum_workspace.sql` database upgrade.</p>';
    document.querySelector('#curriculumSessionList').innerHTML = '';
    return;
  }
  curriculumStages = stageResult.data || [];
  curriculumSessions = sessionResult.data || [];
  stageSelect.innerHTML = curriculumStages.length ? curriculumStages.map((stage) => `<option value="${stage.id}">${escapeHtml(stage.track_name)} · ${escapeHtml(stage.stage_name)}</option>`).join('') : '<option value="">No stages available</option>';
  if (curriculumStages.some((stage) => stage.id === selectedId)) stageSelect.value = selectedId;
  renderCurriculum();
};

const serviceStudentName = (studentId) => {
  const profile = profiles.find((item) => item.id === studentId);
  return profile?.full_name || profile?.email || 'Student';
};

const serviceDecisionForm = (kind, id, statusOptions) => `<form class="service-decision-form" data-service-kind="${kind}" data-service-id="${id}"><label>Status<select name="status">${statusOptions}</select></label><label>Response<textarea name="response" rows="2" maxlength="2000" placeholder="Visible to the student"></textarea></label><button type="submit">Save response</button></form>`;

const loadStudentServices = async () => {
  const [requestResult, ticketResult, submissionResult, invoiceResult] = await Promise.all([
    supabase.from('lesson_change_requests').select('id,student_id,request_type,requested_starts_at,reason,status,staff_response,created_at,lesson_sessions(title,starts_at)').order('created_at', { ascending: false }).limit(100),
    supabase.from('support_tickets').select('id,student_id,category,subject,message,status,staff_response,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('assignment_submissions').select('id,student_id,submission_text,resource_url,status,tutor_feedback,submitted_at,learning_materials(title,courses(title))').order('submitted_at', { ascending: false }).limit(100),
    isAdmin ? supabase.from('invoices').select('id,student_id,invoice_number,amount_ngn,due_at,status,description,created_at').order('created_at', { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
  ]);
  const requestList = document.querySelector('#lessonRequestAdminList');
  const ticketList = document.querySelector('#supportTicketAdminList');
  const submissionList = document.querySelector('#assignmentAdminList');
  const invoiceList = document.querySelector('#invoiceAdminList');
  requestList.innerHTML = requestResult.error ? '<p class="admin-status error">Student services needs the `student_services.sql` migration first.</p>' : (requestResult.data?.length ? requestResult.data.map((request) => `<article class="management-card service-admin-card"><div><p class="card-label">${escapeHtml(request.status).toUpperCase()} · ${escapeHtml(request.request_type).toUpperCase()}</p><h3>${escapeHtml(serviceStudentName(request.student_id))}</h3><p>${escapeHtml(request.lesson_sessions?.title || 'Lesson')} · ${formatDate(request.lesson_sessions?.starts_at || request.created_at)}</p><p>${escapeHtml(request.reason)}</p></div>${serviceDecisionForm('lesson', request.id, `<option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option><option value="approved" ${request.status === 'approved' ? 'selected' : ''}>Approve</option><option value="declined" ${request.status === 'declined' ? 'selected' : ''}>Decline</option>`)}</article>`).join('') : '<p class="admin-empty">No lesson-change requests yet.</p>');
  ticketList.innerHTML = ticketResult.error ? '' : (ticketResult.data?.length ? ticketResult.data.map((ticket) => `<article class="management-card service-admin-card"><div><p class="card-label">${escapeHtml(ticket.status).toUpperCase()} · ${escapeHtml(ticket.category).toUpperCase()}</p><h3>${escapeHtml(ticket.subject)}</h3><p>${escapeHtml(serviceStudentName(ticket.student_id))}</p><p>${escapeHtml(ticket.message)}</p></div>${serviceDecisionForm('ticket', ticket.id, `<option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Open</option><option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>In progress</option><option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolved</option>`)}</article>`).join('') : '<p class="admin-empty">No support tickets yet.</p>');
  submissionList.innerHTML = submissionResult.error ? '' : (submissionResult.data?.length ? submissionResult.data.map((submission) => `<article class="management-card service-admin-card"><div><p class="card-label">${escapeHtml(submission.status).toUpperCase()}</p><h3>${escapeHtml(submission.learning_materials?.title || 'Assignment')}</h3><p>${escapeHtml(serviceStudentName(submission.student_id))} · ${escapeHtml(submission.learning_materials?.courses?.title || 'Programme')}</p><p>${escapeHtml(submission.submission_text || submission.resource_url || 'Submission received.')}</p></div>${serviceDecisionForm('assignment', submission.id, `<option value="submitted" ${submission.status === 'submitted' ? 'selected' : ''}>Submitted</option><option value="reviewed" ${submission.status === 'reviewed' ? 'selected' : ''}>Reviewed</option><option value="returned" ${submission.status === 'returned' ? 'selected' : ''}>Returned</option>`)}</article>`).join('') : '<p class="admin-empty">No assignment submissions yet.</p>');
  if (isAdmin) invoiceList.innerHTML = invoiceResult.data?.length ? invoiceResult.data.map((invoice) => `<article class="management-card"><div><p class="card-label">${escapeHtml(invoice.status).toUpperCase()}</p><h3>${escapeHtml(invoice.invoice_number)} · ${formatNaira(invoice.amount_ngn)}</h3><p>${escapeHtml(serviceStudentName(invoice.student_id))} · ${invoice.due_at ? `Due ${new Date(invoice.due_at).toLocaleDateString()}` : 'No due date'}</p><p>${escapeHtml(invoice.description || 'Academy invoice')}</p></div></article>`).join('') : '<p class="admin-empty">No invoices issued yet.</p>';
  document.querySelectorAll('.service-decision-form').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const kind = form.dataset.serviceKind;
    if (kind === 'lesson') {
      const { error } = await supabase.rpc('decide_lesson_change_request', { request_id: form.dataset.serviceId, decision: formData.get('status'), response_text: String(formData.get('response') || '').trim() || null });
      if (error) return showStatus(error.message, true);
      await loadStudentServices();
      await loadLessons();
      showStatus('Lesson request decision saved and the lesson schedule updated when approved.');
      return;
    }
    const table = kind === 'ticket' ? 'support_tickets' : 'assignment_submissions';
    const responseField = kind === 'assignment' ? 'tutor_feedback' : 'staff_response';
    const payload = { status: formData.get('status'), [responseField]: String(formData.get('response') || '').trim() || null, updated_at: new Date().toISOString() };
    if (kind === 'ticket') Object.assign(payload, { responded_at: new Date().toISOString(), responded_by: session.user.id });
    if (kind === 'assignment') Object.assign(payload, { reviewed_at: new Date().toISOString(), reviewed_by: session.user.id });
    const { error } = await supabase.from(table).update(payload).eq('id', form.dataset.serviceId);
    if (error) return showStatus(error.message, true);
    await loadStudentServices();
    showStatus('Student service response saved.');
  }));
};

const bindForms = () => {
  document.querySelector('#applicationIntakeForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const enrollmentId = document.querySelector('#intakeEnrollmentId').value;
    if (!enrollmentId) return;
    const optionalValue = (id) => document.getElementById(id).value.trim() || null;
    const payload = {
      enrollment_id: enrollmentId,
      surname: document.querySelector('#intakeSurname').value.trim(),
      first_name: document.querySelector('#intakeFirstName').value.trim(),
      middle_name: optionalValue('intakeMiddleName'),
      address: optionalValue('intakeAddress'),
      phone: optionalValue('intakePhone'),
      study_duration: optionalValue('intakeDuration'),
      major_instrument: optionalValue('intakeMajorInstrument'),
      minor_instrument: optionalValue('intakeMinorInstrument'),
      grade_level: optionalValue('intakeGradeLevel'),
      paper_signed_on: optionalValue('intakeSignedOn'),
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    };
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const { error } = await supabase.from('application_intake_details').upsert(payload, { onConflict: 'enrollment_id' });
    submitButton.disabled = false;
    if (document.querySelector('#intakeEnrollmentId').value !== enrollmentId) return;
    document.querySelector('#intakeStatus').className = error ? 'form-hint error' : 'form-hint';
    document.querySelector('#intakeStatus').textContent = error ? error.message : 'Application form details saved for staff review.';
    if (error) showStatus(error.message, true);
  });
  document.querySelector('#curriculumStageSelect').addEventListener('change', () => {
    resetCurriculumSessionForm();
    renderCurriculum();
  });
  document.querySelector('#curriculumStageForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const stageId = document.querySelector('#curriculumStageId').value;
    const payload = {
      track_name: document.querySelector('#curriculumTrackName').value.trim(),
      stage_name: document.querySelector('#curriculumStageName').value.trim(),
      stage_order: Number(document.querySelector('#curriculumStageOrder').value),
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    };
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const request = stageId
      ? supabase.from('curriculum_stages').update(payload).eq('id', stageId).select('id').single()
      : supabase.from('curriculum_stages').insert({ ...payload, created_by: session.user.id }).select('id').single();
    const { data, error } = await request;
    submitButton.disabled = false;
    if (error) return showStatus(error.message, true);
    resetCurriculumStageForm();
    document.querySelector('#curriculumStageForm').closest('details').open = false;
    await loadCurriculum(data.id);
    showStatus(`Curriculum stage ${stageId ? 'updated' : 'created'}.`);
  });
  document.querySelector('#cancelCurriculumStageEdit').addEventListener('click', resetCurriculumStageForm);
  document.querySelector('#curriculumSessionForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const stageId = document.querySelector('#curriculumStageSelect').value;
    if (!stageId) return showStatus('Choose a curriculum stage first.', true);
    const sessionId = document.querySelector('#curriculumSessionId').value;
    const payload = {
      stage_id: stageId,
      session_order: Number(document.querySelector('#curriculumSessionOrder').value),
      session_label: document.querySelector('#curriculumSessionLabel').value.trim(),
      topic: document.querySelector('#curriculumTopic').value.trim(),
      objectives: document.querySelector('#curriculumObjectives').value.trim(),
      updated_at: new Date().toISOString(),
      updated_by: session.user.id,
    };
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const request = sessionId
      ? supabase.from('curriculum_sessions').update(payload).eq('id', sessionId).select('id').single()
      : supabase.from('curriculum_sessions').insert({ ...payload, created_by: session.user.id }).select('id').single();
    const { error } = await request;
    submitButton.disabled = false;
    if (error) return showStatus(error.message, true);
    resetCurriculumSessionForm();
    document.querySelector('#curriculumSessionEditor').open = false;
    await loadCurriculum(stageId);
    showStatus(`Curriculum session ${sessionId ? 'updated' : 'created'}.`);
  });
  document.querySelector('#cancelCurriculumSessionEdit').addEventListener('click', resetCurriculumSessionForm);
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
  document.querySelector('#classroomType').addEventListener('change', toggleClassroomFields);
  toggleClassroomFields();
  document.querySelector('#classroomForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const classroomId = document.querySelector('#classroomId').value;
    const deliveryType = document.querySelector('#classroomType').value;
    const startsAt = document.querySelector('#classroomStartsAt').value;
    const endsAt = document.querySelector('#classroomEndsAt').value;
    const accessUrl = (deliveryType === 'live' ? document.querySelector('#classroomJoinUrl') : document.querySelector('#classroomRecordingUrl')).value.trim();
    if (!/^https:\/\//i.test(accessUrl)) return showStatus('Use a secure https:// classroom link.', true);
    if (deliveryType === 'live' && endsAt && new Date(endsAt) <= new Date(startsAt)) return showStatus('The class end time must be after its start time.', true);
    const payload = {
      course_id: document.querySelector('#classroomCourse').value,
      title: document.querySelector('#classroomTitle').value.trim(),
      description: document.querySelector('#classroomDescription').value.trim() || null,
      delivery_type: deliveryType,
      provider: document.querySelector('#classroomProvider').value,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: deliveryType === 'live' && endsAt ? new Date(endsAt).toISOString() : null,
      join_url: deliveryType === 'live' ? accessUrl : null,
      recording_url: deliveryType === 'recording' ? accessUrl : null,
      is_published: document.querySelector('#classroomPublished').value === 'true',
      updated_at: new Date().toISOString(),
    };
    const request = classroomId
      ? supabase.from('classroom_sessions').update(payload).eq('id', classroomId)
      : supabase.from('classroom_sessions').insert({ ...payload, created_by: session.user.id });
    const { error } = await request;
    if (error) return showStatus(error.message, true);
    resetClassroomForm();
    await loadClassroom();
    showStatus(`Classroom ${classroomId ? 'item updated' : 'item saved'}.`);
  });
  document.querySelector('#cancelClassroomEdit').addEventListener('click', resetClassroomForm);
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
  document.querySelector('#materialForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const materialId = document.querySelector('#materialId').value;
    const existingMaterial = learningMaterials.find((material) => material.id === materialId);
    const materialType = document.querySelector('#materialType').value;
    const resourceUrl = document.querySelector('#materialUrl').value.trim();
    const file = document.querySelector('#materialFile').files?.[0];
    const fileStatus = document.querySelector('#materialFileStatus');
    if (resourceUrl && file) return showStatus('Use either an external link or an uploaded file, not both.', true);
    if (resourceUrl && !/^https:\/\//i.test(resourceUrl)) return showStatus('Resource links must start with https://.', true);
    if (!resourceUrl && !file && !existingMaterial?.storage_path && !existingMaterial?.resource_url && materialType !== 'assignment') return showStatus('Add a secure external link or upload a file for this material.', true);
    let uploadedPath = null;
    if (file) {
      fileStatus.textContent = 'Uploading private material…';
      const upload = await uploadMaterialFile(file, document.querySelector('#materialCourse').value);
      if (upload.error) {
        fileStatus.textContent = upload.error;
        return showStatus(upload.error, true);
      }
      uploadedPath = upload.path;
    }
    const payload = {
      course_id: document.querySelector('#materialCourse').value,
      material_type: materialType,
      title: document.querySelector('#materialTitle').value.trim(),
      resource_url: file ? null : resourceUrl || existingMaterial?.resource_url || null,
      storage_path: uploadedPath || (resourceUrl ? null : existingMaterial?.storage_path || null),
      description: document.querySelector('#materialDescription').value.trim() || null,
      is_published: document.querySelector('#materialPublished').value === 'true',
      updated_at: new Date().toISOString(),
    };
    const request = materialId
      ? supabase.from('learning_materials').update(payload).eq('id', materialId)
      : supabase.from('learning_materials').insert({ ...payload, created_by: session.user.id });
    const { error } = await request;
    if (error) {
      if (uploadedPath) await supabase.storage.from(materialBucket).remove([uploadedPath]);
      return showStatus(error.message, true);
    }
    if (existingMaterial?.storage_path && existingMaterial.storage_path !== payload.storage_path) await supabase.storage.from(materialBucket).remove([existingMaterial.storage_path]);
    resetMaterialForm();
    await loadLearningWorkspace();
    showStatus(`Learning material ${materialId ? 'updated' : 'published'}${uploadedPath ? ' with a private file' : ''}.`);
  });
  document.querySelector('#cancelMaterialEdit').addEventListener('click', resetMaterialForm);
  document.querySelector('#progressForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      student_id: document.querySelector('#progressStudent').value,
      course_id: document.querySelector('#progressCourse').value || null,
      title: document.querySelector('#progressTitle').value.trim(),
      feedback: document.querySelector('#progressFeedback').value.trim() || null,
      practice_goal: document.querySelector('#progressGoal').value.trim() || null,
      progress_level: document.querySelector('#progressLevel').value,
      created_by: session.user.id,
    };
    const { error } = await supabase.from('student_progress_entries').insert(payload);
    if (error) return showStatus(error.message, true);
    event.currentTarget.reset();
    await loadProgressEntries();
    showStatus('Student progress update recorded.');
  });
  document.querySelector('#announcementForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const announcementId = document.querySelector('#announcementId').value;
    const payload = {
      title: document.querySelector('#announcementTitle').value.trim(),
      audience: document.querySelector('#announcementAudience').value,
      is_published: document.querySelector('#announcementPublished').value === 'true',
      body: document.querySelector('#announcementBody').value.trim(),
      updated_at: new Date().toISOString(),
    };
    const request = announcementId
      ? supabase.from('academy_announcements').update(payload).eq('id', announcementId)
      : supabase.from('academy_announcements').insert({ ...payload, created_by: session.user.id });
    const { error } = await request;
    if (error) return showStatus(error.message, true);
    resetAnnouncementForm();
    await loadAnnouncements();
    showStatus(`Announcement ${announcementId ? 'updated' : 'saved'}.`);
  });
  document.querySelector('#cancelAnnouncementEdit').addEventListener('click', resetAnnouncementForm);
  document.querySelector('#invoiceForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      student_id: document.querySelector('#invoiceStudent').value,
      invoice_number: document.querySelector('#invoiceNumber').value.trim(),
      amount_ngn: Number(document.querySelector('#invoiceAmount').value),
      status: document.querySelector('#invoiceStatus').value,
      due_at: document.querySelector('#invoiceDueAt').value || null,
      description: document.querySelector('#invoiceDescription').value.trim() || null,
      created_by: session.user.id,
    };
    const { error } = await supabase.from('invoices').insert(payload);
    if (error) return showStatus(error.message, true);
    event.currentTarget.reset();
    await loadStudentServices();
    showStatus('Invoice saved.');
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
