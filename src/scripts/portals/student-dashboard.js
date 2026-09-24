import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.replace('./auth.html');
} else {
  const user = session.user;
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const formatDate = (value, options) => new Date(value).toLocaleDateString(undefined, options);
  const formatDateTime = (value) => new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatMoney = (amount) => `₦${Number(amount || 0).toLocaleString()}`;
  const statusLabels = { active: 'Approved', declined: 'Declined', pending: 'Pending', paid: 'Paid', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' };
  const applicationDetails = {
    active: 'Your enrolment is active. Your academy team will keep your lessons and payments updated here.',
    declined: "Your application was declined. Please contact DSAM'S Academy for assistance.",
    pending: "Your application is pending DSAM'S approval.",
  };

  const profileForm = document.querySelector('#profileForm');
  const profileStatus = document.querySelector('#profileStatus');
  const enrollmentList = document.querySelector('#enrollmentList');
  const enrollmentSummary = document.querySelector('#enrollmentSummary');
  const scheduleList = document.querySelector('#scheduleList');
  const paymentList = document.querySelector('#paymentList');
  const learningMaterialList = document.querySelector('#learningMaterialList');
  const progressEntryList = document.querySelector('#progressEntryList');
  const announcementFeed = document.querySelector('#announcementFeed');
  const requestLesson = document.querySelector('#requestLesson');
  const lessonRequestList = document.querySelector('#lessonRequestList');
  const ticketList = document.querySelector('#ticketList');
  const assignmentMaterial = document.querySelector('#assignmentMaterial');
  const assignmentList = document.querySelector('#assignmentList');
  const invoiceList = document.querySelector('#invoiceList');
  const notificationList = document.querySelector('#notificationList');
  const markNotificationsRead = document.querySelector('#markNotificationsRead');
  const classroomLiveList = document.querySelector('#classroomLiveList');
  const classroomRecordingList = document.querySelector('#classroomRecordingList');
  const studentMenuToggle = document.querySelector('#studentMenuToggle');
  const studentSidebar = document.querySelector('#studentSidebar');
  const studentPanels = document.querySelectorAll('.student-panel');
  const studentPanelButtons = document.querySelectorAll('[data-student-panel]');

  const showStudentPanel = (panelName) => {
    studentPanels.forEach((panel) => { panel.hidden = panel.id !== `${panelName}StudentPanel`; });
    studentPanelButtons.forEach((button) => {
      const active = button.dataset.studentPanel === panelName;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    studentSidebar.classList.remove('is-open');
    studentMenuToggle.setAttribute('aria-expanded', 'false');
  };

  studentPanelButtons.forEach((button) => button.addEventListener('click', () => showStudentPanel(button.dataset.studentPanel)));
  studentMenuToggle.addEventListener('click', () => {
    const isOpen = studentSidebar.classList.toggle('is-open');
    studentMenuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  document.querySelector('#studentName').textContent = `Welcome, ${user.user_metadata.full_name || user.email.split('@')[0]}`;
  document.querySelector('#signOutButton').onclick = async () => {
    await supabase.auth.signOut();
    window.location.replace('./auth.html');
  };

  async function loadProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name,email,phone,instrument')
      .eq('id', user.id)
      .maybeSingle();

    if (error) return;

    document.querySelector('#profileName').value = data?.full_name || user.user_metadata.full_name || '';
    document.querySelector('#profileEmail').value = data?.email || user.email || '';
    document.querySelector('#profilePhone').value = data?.phone || '';
    document.querySelector('#profileInstrument').value = data?.instrument || '';
    if (data?.instrument) document.querySelector('#studentWelcome').textContent = `Your ${data.instrument} learning journey is all in one place.`;
  }

  profileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = profileForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    profileStatus.textContent = 'Saving…';
    profileStatus.className = 'profile-status';

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: document.querySelector('#profileName').value.trim(),
        phone: document.querySelector('#profilePhone').value.trim() || null,
        instrument: document.querySelector('#profileInstrument').value.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    submitButton.disabled = false;
    if (error) {
      profileStatus.textContent = 'Profile could not be saved yet. Please try again.';
      profileStatus.className = 'profile-status error';
      return;
    }

    document.querySelector('#studentName').textContent = `Welcome, ${document.querySelector('#profileName').value.trim() || user.email.split('@')[0]}`;
    profileStatus.textContent = 'Profile saved';
    profileStatus.className = 'profile-status success';
  });

  async function loadEnrolments() {
    const { data: enrolments } = await supabase
      .from('enrollments')
      .select('id,status,created_at,courses(title)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (!enrolments?.length) return;

    const latestEnrolment = enrolments[0];
    const approvedCount = enrolments.filter((enrolment) => enrolment.status === 'active').length;
    document.querySelector('#courseName').textContent = latestEnrolment.courses?.title || 'Programme application';
    document.querySelector('#courseDetail').textContent = applicationDetails[latestEnrolment.status] || applicationDetails.pending;
    enrollmentSummary.textContent = `${enrolments.length} application${enrolments.length === 1 ? '' : 's'} submitted · ${approvedCount} approved`;
    enrollmentList.innerHTML = enrolments.map((enrolment) => `<article class="enrollment-row"><div><strong>${escapeHtml(enrolment.courses?.title || 'Programme application')}</strong><span>Submitted ${formatDate(enrolment.created_at)}</span></div><span class="enrollment-status ${escapeHtml(enrolment.status)}">${escapeHtml(statusLabels[enrolment.status] || 'Pending')}</span></article>`).join('');
  }

  async function loadLessons() {
    let result = await supabase
      .from('lesson_sessions')
      .select('id,starts_at,instructor,location,title,status,attendance_status,courses(title)')
      .eq('student_id', user.id)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(5);

    if (result.error) {
      result = await supabase
        .from('lesson_sessions')
        .select('starts_at,instructor,location')
        .eq('student_id', user.id)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(5);
    }

    const lessons = result.data || [];
    if (!lessons.length) return;

    requestLesson.innerHTML = ['<option value="">Select an upcoming lesson</option>', ...lessons.map((lesson) => `<option value="${lesson.id}">${escapeHtml(lesson.title || lesson.courses?.title || 'Lesson')} · ${new Date(lesson.starts_at).toLocaleString()}</option>`)].join('');

    const next = new Date(lessons[0].starts_at);
    document.querySelector('#lessonDate').textContent = formatDate(next, { weekday: 'long', month: 'short', day: 'numeric' });
    document.querySelector('#lessonDetail').textContent = `${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${lessons[0].location || "DSAM'S Academy"}`;
    scheduleList.innerHTML = lessons.map((lesson) => {
      const date = new Date(lesson.starts_at);
      const lessonTitle = lesson.title || lesson.courses?.title || 'Lesson session';
      const attendance = lesson.attendance_status && lesson.attendance_status !== 'scheduled' ? ` · ${lesson.attendance_status}` : '';
      return `<article class="lesson-row"><div><strong>${escapeHtml(lessonTitle)}</strong><span>${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>${escapeHtml(lesson.instructor || "DSAM'S Tutor")} · ${escapeHtml(lesson.location || "DSAM'S Academy")}${escapeHtml(attendance)}</span></div><span class="lesson-status">${escapeHtml(statusLabels[lesson.status] || 'Scheduled')}</span></article>`;
    }).join('');
  }

  async function loadClassroom() {
    const { data, error } = await supabase
      .from('classroom_sessions')
      .select('title,description,delivery_type,provider,starts_at,ends_at,join_url,recording_url,courses(title)')
      .order('starts_at', { ascending: false })
      .limit(30);

    if (error || !data?.length) return;

    const now = new Date();
    const liveClasses = data.filter((classroomSession) => classroomSession.delivery_type === 'live' && (!classroomSession.ends_at ? new Date(classroomSession.starts_at) >= now : new Date(classroomSession.ends_at) >= now));
    const recordings = data.filter((classroomSession) => classroomSession.delivery_type === 'recording');
    const renderClassroomItems = (sessions, type) => sessions.length ? sessions.map((classroomSession) => {
      const url = type === 'live' ? classroomSession.join_url : classroomSession.recording_url;
      const safeUrl = /^https:\/\//i.test(url || '') ? url : '';
      const action = safeUrl ? `<a class="dashboard-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${type === 'live' ? 'Join live class →' : 'Watch tutorial →'}</a>` : '';
      const provider = escapeHtml((classroomSession.provider || 'academy').replaceAll('_', ' '));
      const schedule = type === 'live' ? `${formatDateTime(classroomSession.starts_at)}${classroomSession.ends_at ? ` – ${new Date(classroomSession.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : `Published tutorial · ${provider}`;
      return `<article class="learning-entry classroom-entry"><p class="card-label">${type === 'live' ? 'LIVE CLASS' : 'RECORDING'} · ${escapeHtml(classroomSession.courses?.title || 'Programme')}</p><h3>${escapeHtml(classroomSession.title)}</h3><p>${escapeHtml(classroomSession.description || (type === 'live' ? 'Your academy team has scheduled this class.' : 'A tutorial from your academy team.'))}</p><span>${schedule}</span>${action}</article>`;
    }).join('') : `<p>${type === 'live' ? 'No live classes are scheduled for your programme.' : 'No tutorial recordings have been shared yet.'}</p>`;

    classroomLiveList.innerHTML = renderClassroomItems(liveClasses, 'live');
    classroomRecordingList.innerHTML = renderClassroomItems(recordings, 'recording');
  }

  async function loadPayments() {
    let result = await supabase
      .from('payments')
      .select('status,amount_ngn,created_at,reference')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
      .limit(8);

    if (result.error) {
      result = await supabase
        .from('payments')
        .select('status,amount_ngn,created_at')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);
    }

    const payments = result.data || [];
    if (!payments.length) return;

    const latestPayment = payments[0];
    document.querySelector('#paymentStatus').textContent = latestPayment.status === 'paid' ? 'Payment recorded' : 'Payment pending';
    document.querySelector('#paymentDetail').textContent = `Latest amount: ${formatMoney(latestPayment.amount_ngn)}`;
    paymentList.innerHTML = payments.map((payment) => `<article class="payment-row"><div><strong>${formatMoney(payment.amount_ngn)}</strong><span>${formatDate(payment.created_at)}${payment.reference ? ` · Ref: ${escapeHtml(payment.reference)}` : ''}</span></div><span class="payment-status ${escapeHtml(payment.status)}">${escapeHtml(statusLabels[payment.status] || payment.status || 'Pending')}</span></article>`).join('');
  }

  async function loadLearningMaterials() {
    const { data, error } = await supabase
      .from('learning_materials')
      .select('title,description,material_type,resource_url,created_at,courses(title)')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error || !data?.length) return;
    const assignments = data.filter((material) => material.material_type === 'assignment');
    if (assignments.length) assignmentMaterial.innerHTML = ['<option value="">Select an assignment</option>', ...assignments.map((material) => `<option value="${material.id}">${escapeHtml(material.title)} · ${escapeHtml(material.courses?.title || 'Programme')}</option>`)].join('');
    learningMaterialList.innerHTML = data.map((material) => {
      const safeUrl = /^https:\/\//i.test(material.resource_url || '') ? material.resource_url : '';
      const action = safeUrl ? `<a class="dashboard-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">Open resource →</a>` : '';
      return `<article class="learning-entry"><p class="card-label">${escapeHtml((material.material_type || 'resource').replace('_', ' '))} · ${escapeHtml(material.courses?.title || 'Programme')}</p><h3>${escapeHtml(material.title)}</h3><p>${escapeHtml(material.description || 'A learning resource from your academy team.')}</p>${action}</article>`;
    }).join('');
  }

  async function loadProgressEntries() {
    const { data, error } = await supabase
      .from('student_progress_entries')
      .select('title,feedback,practice_goal,progress_level,recorded_at,courses(title)')
      .order('recorded_at', { ascending: false })
      .limit(8);

    if (error || !data?.length) return;
    progressEntryList.innerHTML = data.map((entry) => `<article class="learning-entry"><p class="card-label">${escapeHtml(entry.progress_level || 'developing')} · ${escapeHtml(entry.courses?.title || 'General study')}</p><h3>${escapeHtml(entry.title)}</h3>${entry.feedback ? `<p>${escapeHtml(entry.feedback)}</p>` : ''}${entry.practice_goal ? `<p class="practice-goal"><strong>Practice goal:</strong> ${escapeHtml(entry.practice_goal)}</p>` : ''}<span>${formatDate(entry.recorded_at)}</span></article>`).join('');
  }

  async function loadAnnouncements() {
    const { data, error } = await supabase
      .from('academy_announcements')
      .select('title,body,published_at')
      .order('published_at', { ascending: false })
      .limit(6);

    if (error || !data?.length) return;
    announcementFeed.innerHTML = data.map((announcement) => `<article class="announcement-entry"><div><h3>${escapeHtml(announcement.title)}</h3><p>${escapeHtml(announcement.body)}</p></div><span>${formatDate(announcement.published_at)}</span></article>`).join('');
  }

  const renderHistory = (element, rows, render, emptyMessage) => {
    element.innerHTML = rows?.length ? rows.map(render).join('') : `<p>${emptyMessage}</p>`;
  };

  async function loadLessonRequests() {
    const { data, error } = await supabase.from('lesson_change_requests').select('request_type,requested_starts_at,reason,status,staff_response,created_at,lesson_sessions(title,starts_at)').order('created_at', { ascending: false }).limit(10);
    if (error) return;
    renderHistory(lessonRequestList, data, (request) => `<article class="service-entry"><div><strong>${escapeHtml(request.request_type === 'cancel' ? 'Cancellation request' : 'Reschedule request')}</strong><span>${escapeHtml(request.lesson_sessions?.title || 'Lesson')} · ${formatDate(request.lesson_sessions?.starts_at || request.created_at)}</span><p>${escapeHtml(request.reason)}</p>${request.staff_response ? `<p><strong>Academy response:</strong> ${escapeHtml(request.staff_response)}</p>` : ''}</div><span class="service-badge ${escapeHtml(request.status)}">${escapeHtml(request.status)}</span></article>`, 'No lesson-change requests yet.');
  }

  async function loadSupportTickets() {
    const { data, error } = await supabase.from('support_tickets').select('category,subject,message,status,staff_response,created_at').order('created_at', { ascending: false }).limit(10);
    if (error) return;
    renderHistory(ticketList, data, (ticket) => `<article class="service-entry"><div><strong>${escapeHtml(ticket.subject)}</strong><span>${escapeHtml(ticket.category)} · ${formatDate(ticket.created_at)}</span><p>${escapeHtml(ticket.message)}</p>${ticket.staff_response ? `<p><strong>Academy response:</strong> ${escapeHtml(ticket.staff_response)}</p>` : ''}</div><span class="service-badge ${escapeHtml(ticket.status)}">${escapeHtml(ticket.status.replace('_', ' '))}</span></article>`, 'No support requests yet.');
  }

  async function loadAssignments() {
    const { data, error } = await supabase.from('assignment_submissions').select('submission_text,resource_url,status,tutor_feedback,submitted_at,learning_materials(title,courses(title))').order('submitted_at', { ascending: false }).limit(10);
    if (error) return;
    renderHistory(assignmentList, data, (submission) => `<article class="service-entry"><div><strong>${escapeHtml(submission.learning_materials?.title || 'Assignment')}</strong><span>${escapeHtml(submission.learning_materials?.courses?.title || 'Programme')} · ${formatDate(submission.submitted_at)}</span><p>${escapeHtml(submission.submission_text || 'Link submitted.')}</p>${submission.tutor_feedback ? `<p><strong>Tutor feedback:</strong> ${escapeHtml(submission.tutor_feedback)}</p>` : ''}</div><span class="service-badge ${escapeHtml(submission.status)}">${escapeHtml(submission.status)}</span></article>`, 'No assignment submissions yet.');
  }

  async function loadInvoices() {
    const { data, error } = await supabase.from('invoices').select('invoice_number,amount_ngn,due_at,status,description,created_at').order('created_at', { ascending: false }).limit(10);
    if (error) return;
    renderHistory(invoiceList, data, (invoice) => `<article class="payment-row"><div><strong>${formatMoney(invoice.amount_ngn)}</strong><span>${escapeHtml(invoice.invoice_number)} · ${invoice.due_at ? `Due ${formatDate(invoice.due_at)}` : 'No due date'}</span><span>${escapeHtml(invoice.description || 'Academy invoice')}</span></div><span class="payment-status ${escapeHtml(invoice.status)}">${escapeHtml(invoice.status)}</span></article>`, 'No invoices have been issued yet.');
  }

  async function loadNotifications() {
    const { data, error } = await supabase.from('student_notifications').select('id,title,message,category,is_read,created_at').order('created_at', { ascending: false }).limit(12);
    if (error || !data?.length) return;
    notificationList.innerHTML = data.map((notification) => `<article class="notification-entry ${notification.is_read ? '' : 'unread'}"><div><p class="card-label">${escapeHtml(notification.category)}</p><h3>${escapeHtml(notification.title)}</h3><p>${escapeHtml(notification.message)}</p></div><span>${formatDate(notification.created_at)}</span></article>`).join('');
    markNotificationsRead.hidden = !data.some((notification) => !notification.is_read);
  }

  const setServiceStatus = (id, message, error = false) => {
    const element = document.querySelector(id);
    element.textContent = message;
    element.className = `service-status${error ? ' error' : ' success'}`;
  };

  document.querySelector('#requestType').addEventListener('change', (event) => {
    const isReschedule = event.target.value === 'reschedule';
    document.querySelector('#requestedTimeField').hidden = !isReschedule;
    document.querySelector('#requestedStartsAt').required = isReschedule;
  });

  document.querySelector('#lessonRequestForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const requestType = document.querySelector('#requestType').value;
    const requestedValue = document.querySelector('#requestedStartsAt').value;
    if (requestType === 'reschedule' && new Date(requestedValue) <= new Date()) return setServiceStatus('#lessonRequestStatus', 'Choose a future preferred time.', true);
    const { error } = await supabase.from('lesson_change_requests').insert({ lesson_session_id: requestLesson.value, student_id: user.id, request_type: requestType, requested_starts_at: requestType === 'reschedule' ? new Date(requestedValue).toISOString() : null, reason: document.querySelector('#requestReason').value.trim() });
    if (error) return setServiceStatus('#lessonRequestStatus', error.message, true);
    event.currentTarget.reset();
    setServiceStatus('#lessonRequestStatus', 'Request sent to the academy team.');
    await loadLessonRequests();
  });

  document.querySelector('#supportTicketForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const { error } = await supabase.from('support_tickets').insert({ student_id: user.id, category: document.querySelector('#ticketCategory').value, subject: document.querySelector('#ticketSubject').value.trim(), message: document.querySelector('#ticketMessage').value.trim() });
    if (error) return setServiceStatus('#ticketStatus', error.message, true);
    event.currentTarget.reset();
    setServiceStatus('#ticketStatus', 'Support request sent.');
    await loadSupportTickets();
  });

  document.querySelector('#assignmentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const resourceUrl = document.querySelector('#assignmentUrl').value.trim();
    if (resourceUrl && !/^https:\/\//i.test(resourceUrl)) return setServiceStatus('#assignmentStatus', 'Use a secure https:// link.', true);
    const submissionText = document.querySelector('#assignmentText').value.trim();
    if (!submissionText && !resourceUrl) return setServiceStatus('#assignmentStatus', 'Add a written submission or secure link.', true);
    const { error } = await supabase.from('assignment_submissions').insert({ material_id: assignmentMaterial.value, student_id: user.id, submission_text: submissionText || null, resource_url: resourceUrl || null });
    if (error) return setServiceStatus('#assignmentStatus', error.message, true);
    event.currentTarget.reset();
    setServiceStatus('#assignmentStatus', 'Assignment submitted for review.');
    await loadAssignments();
  });

  markNotificationsRead.addEventListener('click', async () => {
    markNotificationsRead.disabled = true;
    const { error } = await supabase.from('student_notifications').update({ is_read: true }).eq('student_id', user.id).eq('is_read', false);
    markNotificationsRead.disabled = false;
    if (error) return;
    await loadNotifications();
  });

  await Promise.all([loadProfile(), loadEnrolments(), loadLessons(), loadClassroom(), loadPayments(), loadLearningMaterials(), loadProgressEntries(), loadAnnouncements(), loadLessonRequests(), loadSupportTickets(), loadAssignments(), loadInvoices(), loadNotifications()]);
}
