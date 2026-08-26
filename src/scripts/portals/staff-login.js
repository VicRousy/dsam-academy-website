import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const status = document.querySelector('#authStatus');
const show = (message, error = false) => { status.textContent = message; status.className = error ? 'auth-status error' : 'auth-status'; };

const requestStaffAccess = async (user) => {
  const { data: request, error: requestError } = await supabase
    .from('staff_access_requests')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (requestError) return show('Staff-access requests are not set up yet. Please contact the academy owner.', true);
  if (request?.status === 'pending') return show('Your staff-access request is pending owner approval. You cannot access staff records yet.');
  if (request?.status === 'denied') return show('Your staff-access request was not approved. Please contact the academy owner.', true);
  if (request?.status === 'approved') return window.location.replace('./admin.html');

  const { data: newRequest, error } = await supabase.from('staff_access_requests').insert({
    user_id: user.id,
    email: user.email,
  }).select('id').single();
  if (error) return show(error.message, true);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    fetch('/api/staff-access-request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ requestId: newRequest.id }),
    }).catch(() => undefined);
  }
  show('Your staff-access request has been sent to the DSAM owner for approval.');
};

const routeSignedInUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (role?.role === 'admin' || role?.role === 'staff') {
    window.location.replace('./admin.html');
    return;
  }
  await requestStaffAccess(user);
};

const { data: { session } } = await supabase.auth.getSession();
if (session) await routeSignedInUser();
document.querySelector('#googleButton').onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/staff-login.html` } });
  if (error) show(error.message, true);
};
