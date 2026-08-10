import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: { session } } = await supabase.auth.getSession();
if (!session) window.location.replace('./auth.html');

const user = session.user;
document.querySelector('#studentName').textContent = `Welcome, ${user.user_metadata.full_name || user.email.split('@')[0]}`;
document.querySelector('#signOutButton').onclick = async () => {
  await supabase.auth.signOut();
  window.location.replace('./auth.html');
};

const { data: enrolment } = await supabase
  .from('enrollments')
  .select('status,courses(title)')
  .eq('student_id', user.id)
  .order('id', { ascending: false })
  .limit(1)
  .maybeSingle();

if (enrolment) {
  document.querySelector('#courseName').textContent = enrolment.courses.title;
  document.querySelector('#courseDetail').textContent = enrolment.status === 'active'
    ? 'Your enrolment is active.'
    : "Your application is pending DSAM'S approval.";
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
