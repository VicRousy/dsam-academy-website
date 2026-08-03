import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const identity = document.querySelector('#adminIdentity');
const status = document.querySelector('#adminStatus');
const list = document.querySelector('#applicationList');
const { data: { session } } = await supabase.auth.getSession();

if (!session) window.location.replace('./auth.html');
identity.textContent = session.user.email;

const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
if (role?.role !== 'admin') {
  status.textContent = 'This account does not have admissions-admin access.';
  status.className = 'admin-status error';
} else {
  const { data: applications, error } = await supabase.from('enrollments').select('id,student_id,status,created_at,courses(title)').order('created_at', { ascending: false });
  if (error) {
    status.textContent = error.message;
    status.className = 'admin-status error';
  } else if (!applications?.length) {
    status.textContent = 'No enrolment applications yet.';
  } else {
    const ids = applications.map((application) => application.student_id);
    const { data: profiles = [] } = await supabase.from('profiles').select('id,email,full_name').in('id', ids);
    const students = new Map(profiles.map((profile) => [profile.id, profile]));
    list.innerHTML = applications.map((application) => {
      const student = students.get(application.student_id);
      const name = student?.full_name || student?.email || 'Student';
      return `<article class="application-card"><div><p class="card-label">${application.status.toUpperCase()}</p><h2>${application.courses?.title || 'Programme'}</h2><p>${name}</p><p class="application-date">Applied ${new Date(application.created_at).toLocaleDateString()}</p></div><div class="application-actions"><button data-action="active" data-id="${application.id}" ${application.status === 'active' ? 'disabled' : ''}>Approve</button><button data-action="declined" data-id="${application.id}" ${application.status === 'declined' ? 'disabled' : ''}>Decline</button></div></article>`;
    }).join('');
    list.hidden = false;
    list.querySelectorAll('button[data-id]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const { error: updateError } = await supabase.from('enrollments').update({ status: button.dataset.action }).eq('id', button.dataset.id);
      if (updateError) { status.textContent = updateError.message; status.className = 'admin-status error'; button.disabled = false; return; }
      window.location.reload();
    }));
  }
}
