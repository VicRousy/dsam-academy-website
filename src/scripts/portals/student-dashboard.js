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
      .select('starts_at,instructor,location,title,status,courses(title)')
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
      return `<article class="lesson-row"><div><strong>${escapeHtml(lessonTitle)}</strong><span>${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span>${escapeHtml(lesson.instructor || "DSAM'S Tutor")} · ${escapeHtml(lesson.location || "DSAM'S Academy")}</span></div><span class="lesson-status">${escapeHtml(statusLabels[lesson.status] || 'Scheduled')}</span></article>`;
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

  await Promise.all([loadProfile(), loadEnrolments(), loadLessons(), loadPayments()]);
}
