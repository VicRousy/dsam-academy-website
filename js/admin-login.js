import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
const status = document.querySelector('#authStatus');
const googleButton = document.querySelector('#googleButton');
const emailButton = document.querySelector('#emailButton');

const showStatus = (message, error = false) => {
  status.textContent = message;
  status.className = error ? 'auth-status error' : 'auth-status';
};

const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.replace('./admin.html');

googleButton.addEventListener('click', async () => {
  googleButton.disabled = true;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/admin-login.html` },
  });
  if (error) { showStatus(error.message, true); googleButton.disabled = false; }
});

document.querySelector('#adminLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  emailButton.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({
    email: document.querySelector('#email').value,
    password: document.querySelector('#password').value,
  });
  emailButton.disabled = false;
  if (error) return showStatus(error.message, true);
  window.location.replace('./admin.html');
});
