import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.replace('./auth.html');
} else {
  const user = session.user;
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const formatDate = (value, options) => new Date(value).toLocaleDateString(undefined, options);
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
      .select('starts_at,instructor,location,title,status,attendance_status,courses(title)')
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

  await Promise.all([loadProfile(), loadEnrolments(), loadLessons(), loadPayments(), loadLearningMaterials(), loadProgressEntries(), loadAnnouncements()]);
}
