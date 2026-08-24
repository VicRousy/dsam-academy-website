import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

window.handleEnrollment = async () => {
  const form = document.querySelector('#enrollmentForm');
  const status = document.querySelector('#formStatus');
  const button = document.querySelector('#submitBtn');
  const payload = Object.fromEntries(new FormData(form).entries());
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    status.textContent = 'Please sign in or create a Student Portal account before enrolling.';
    status.className = 'form-status error';
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving your enrolment...';

  try {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('title', payload.track)
      .single();
    if (courseError) throw courseError;

    const { error } = await supabase
      .from('enrollments')
      .insert({ student_id: user.id, course_id: course.id, status: 'pending' });
    if (error?.code === '23505') {
      status.textContent = 'You already have an application for this programme. Please contact admissions if you need it reviewed.';
      status.className = 'form-status error';
      return;
    }
    if (error) throw error;

    const notificationResponse = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    status.textContent = notificationResponse.ok
      ? 'Enrolment received. You can track it in your Student Portal.'
      : 'Enrolment received. Please contact admissions to confirm your application was received.';
    status.className = 'form-status success';
    form.reset();
  } catch (error) {
    status.textContent = `We could not save your enrolment: ${error.message}`;
    status.className = 'form-status error';
  } finally {
    button.disabled = false;
    button.textContent = 'Submit Formal Enrollment Application';
  }
};
