import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  window.location.replace('./auth.html');
} else {

const user = session.user;
document.querySelector('#studentName').textContent = `Welcome, ${user.user_metadata.full_name || user.email.split('@')[0]}`;
document.querySelector('#signOutButton').onclick = async () => {
  await supabase.auth.signOut();
  window.location.replace('./auth.html');
};

const { data: enrolments } = await supabase
  .from('enrollments')
  .select('status,created_at,courses(title)')
  .eq('student_id', user.id)
  .order('created_at', { ascending: false });

const applicationDetails = {
  active: 'Your enrolment is active.',
  declined: "Your application was declined. Please contact DSAM'S Academy for assistance.",
  pending: "Your application is pending DSAM'S approval.",
};
const statusLabels = { active: 'Approved', declined: 'Declined', pending: 'Pending' };
const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const enrollmentList = document.querySelector('#enrollmentList');
const enrollmentSummary = document.querySelector('#enrollmentSummary');

if (enrolments?.length) {
  const latestEnrolment = enrolments[0];
  const approvedCount = enrolments.filter((enrolment) => enrolment.status === 'active').length;
  document.querySelector('#courseName').textContent = latestEnrolment.courses?.title || 'Programme application';
  document.querySelector('#courseDetail').textContent = applicationDetails[latestEnrolment.status] || applicationDetails.pending;
  enrollmentSummary.textContent = `${enrolments.length} application${enrolments.length === 1 ? '' : 's'} submitted · ${approvedCount} approved`;
  enrollmentList.innerHTML = enrolments.map((enrolment) => `<article class="enrollment-row"><div><strong>${escapeHtml(enrolment.courses?.title || 'Programme application')}</strong><span>Submitted ${new Date(enrolment.created_at).toLocaleDateString()}</span></div><span class="enrollment-status ${escapeHtml(enrolment.status)}">${escapeHtml(statusLabels[enrolment.status] || 'Pending')}</span></article>`).join('');
}

const { data: lessons } = await supabase
  .from('lesson_sessions')
  .select('starts_at,instructor,location')
  .eq('student_id', user.id)
  .gte('starts_at', new Date().toISOString())
  .order('starts_at')
  .limit(5);
const upcomingLessons = lessons || [];

if (upcomingLessons.length) {
  const next = new Date(upcomingLessons[0].starts_at);
  document.querySelector('#lessonDate').textContent = next.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  document.querySelector('#lessonDetail').textContent = `${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${upcomingLessons[0].location || "DSAM'S Academy"}`;
  document.querySelector('#scheduleList').innerHTML = upcomingLessons.map((lesson) => `<p><b>${new Date(lesson.starts_at).toLocaleDateString()}</b> · ${new Date(lesson.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${lesson.instructor || "DSAM'S Tutor"}</p>`).join('');
}

const { data: payment } = await supabase
  .from('payments')
  .select('status,amount_ngn')
  .eq('student_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (payment) {
  document.querySelector('#paymentStatus').textContent = payment.status === 'paid' ? 'Paid' : 'Payment pending';
  document.querySelector('#paymentDetail').textContent = `Latest amount: ₦${Number(payment.amount_ngn).toLocaleString()}`;
}
}
