import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const status = document.querySelector('#adminStatus');
const list = document.querySelector('#applicationList');
const portalKicker = document.querySelector('#portalKicker');
const portalTitle = document.querySelector('#portalTitle');
const staffRequests = document.querySelector('#staffRequests');
const staffRequestList = document.querySelector('#staffRequestList');
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.replace('./admin-login.html');
} else {
const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
if (!['admin', 'staff'].includes(role?.role)) {
  window.location.replace('./dashboard.html');
} else {
  const isAdmin = role.role === 'admin';
  const statusLabels = { active: 'APPROVED', pending: 'PENDING', declined: 'DECLINED' };
  portalKicker.textContent = isAdmin ? 'ADMIN PORTAL' : 'STAFF PORTAL';
  portalTitle.textContent = isAdmin ? 'Manage applications' : 'View applications';
  document.title = `${isAdmin ? 'Admin' : 'Staff'} Portal | DSAM'S Academy of Music`;
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  const loadStaffRequests = async () => {
    if (!isAdmin) return;
    staffRequests.hidden = false;
    const { data: requests = [], error: requestError } = await supabase
      .from('staff_access_requests')
      .select('id,email,requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    if (requestError) {
      staffRequestList.innerHTML = '<p class="admin-status error">Staff-access requests are not set up yet. Run the staff access SQL setup.</p>';
      return;
    }
    if (!requests.length) {
      staffRequestList.innerHTML = '<p class="staff-request-empty">No pending staff-access requests.</p>';
      return;
    }
    staffRequestList.innerHTML = requests.map((request) => `<article class="staff-request-card"><div><h3>${escapeHtml(request.email)}</h3><p>Requested ${new Date(request.requested_at).toLocaleDateString()}</p></div><div class="application-actions"><button data-request-decision="approved" data-request-id="${request.id}">Approve</button><button data-request-decision="denied" data-request-id="${request.id}">Deny</button></div></article>`).join('');
    staffRequestList.querySelectorAll('button[data-request-id]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const { error: decisionError } = await supabase.rpc('decide_staff_access', {
        request_id: Number(button.dataset.requestId),
        decision: button.dataset.requestDecision,
      });
      if (decisionError) {
        status.textContent = decisionError.message;
        status.className = 'admin-status error';
        button.disabled = false;
        return;
      }
      await loadStaffRequests();
    }));
  };
  await loadStaffRequests();
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
      const actions = isAdmin ? `<div class="application-actions"><button data-action="active" data-id="${application.id}" ${application.status === 'active' ? 'disabled' : ''}>${application.status === 'active' ? 'Approved' : 'Approve'}</button><button data-action="declined" data-id="${application.id}" ${application.status === 'declined' ? 'disabled' : ''}>${application.status === 'declined' ? 'Declined' : 'Decline'}</button></div>` : '<p class="staff-readonly">Read-only staff access</p>';
      return `<article class="application-card"><div><p class="card-label">${statusLabels[application.status] || 'PENDING'}</p><h2>${application.courses?.title || 'Programme'}</h2><p>${name}</p><p class="application-date">Applied ${new Date(application.created_at).toLocaleDateString()}</p></div>${actions}</article>`;
    }).join('');
    list.hidden = false;
    list.querySelectorAll('button[data-id]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const { error: updateError } = await supabase.from('enrollments').update({ status: button.dataset.action }).eq('id', button.dataset.id);
      if (updateError) { status.textContent = updateError.message; status.className = 'admin-status error'; button.disabled = false; return; }
      const applicationCard = button.closest('.application-card');
      applicationCard.querySelector('.card-label').textContent = statusLabels[button.dataset.action];
      applicationCard.querySelectorAll('button[data-id]').forEach((actionButton) => { actionButton.disabled = true; actionButton.textContent = actionButton.dataset.action === button.dataset.action ? (button.dataset.action === 'active' ? 'Approved' : 'Declined') : actionButton.textContent; });
      window.location.reload();
    }));
  }
}
}
