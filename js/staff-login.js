import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const status = document.querySelector('#authStatus');
const show = (message, error = false) => { status.textContent = message; status.className = error ? 'auth-status error' : 'auth-status'; };
const routeSignedInUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (role?.role === 'admin' || role?.role === 'staff') {
    window.location.replace('./admin.html');
    return;
  }
  window.location.replace('./dashboard.html');
};

const { data: { session } } = await supabase.auth.getSession();
if (session) await routeSignedInUser();
document.querySelector('#googleButton').onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/staff-login.html` } });
  if (error) show(error.message, true);
};
document.querySelector('#staffLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#email').value, password: document.querySelector('#password').value });
  if (error) return show(error.message, true);
  await routeSignedInUser();
});
