import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const status = document.querySelector('#authStatus');
const show = (message, error = false) => { status.textContent = message; status.className = error ? 'auth-status error' : 'auth-status'; };
const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.replace('./admin.html');
document.querySelector('#googleButton').onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/staff-login.html` } });
  if (error) show(error.message, true);
};
document.querySelector('#staffLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({ email: document.querySelector('#email').value, password: document.querySelector('#password').value });
  if (error) return show(error.message, true);
  window.location.replace('./admin.html');
});
