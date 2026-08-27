import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isSignup = document.body.dataset.authMode === 'signup';
const form = document.querySelector('#authForm');
const googleButton = document.querySelector('#googleButton');
const emailButton = document.querySelector('#emailButton');
const status = document.querySelector('#authStatus');
const password = document.querySelector('#password');
const passwordToggle = document.querySelector('#passwordToggle');
const confirmPassword = document.querySelector('#confirmPassword');
const forgotPasswordButton = document.querySelector('#forgotPasswordButton');

function showStatus(message, error = false) {
  status.textContent = message;
  status.className = `auth-status${error ? ' error' : ''}`;
}

passwordToggle.addEventListener('click', () => {
  const shouldShowPassword = password.type === 'password';
  password.type = shouldShowPassword ? 'text' : 'password';
  if (confirmPassword) confirmPassword.type = shouldShowPassword ? 'text' : 'password';
  passwordToggle.textContent = shouldShowPassword ? 'Hide' : 'Show';
  passwordToggle.setAttribute('aria-label', shouldShowPassword ? 'Hide password' : 'Show password');
  passwordToggle.setAttribute('aria-pressed', String(shouldShowPassword));
});

if (!url || !key) {
  [googleButton, emailButton, passwordToggle, forgotPasswordButton].filter(Boolean).forEach((button) => { button.disabled = true; });
  showStatus('Student accounts are being set up. Please check back shortly.', true);
} else {
  const supabase = createClient(url, key);
  const redirectTo = `${window.location.origin}/auth.html`;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.replace('./dashboard.html');

  googleButton.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) showStatus(error.message, true);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#email').value.trim();
    const passwordValue = password.value;
    if (isSignup && passwordValue !== confirmPassword.value) return showStatus('Your passwords do not match. Please check them and try again.', true);
    emailButton.disabled = true;
    showStatus(isSignup ? 'Creating your account…' : 'Logging you in…');
    const result = isSignup
      ? await supabase.auth.signUp({ email, password: passwordValue, options: { emailRedirectTo: redirectTo } })
      : await supabase.auth.signInWithPassword({ email, password: passwordValue });
    emailButton.disabled = false;
    if (result.error) {
      const message = result.error.message === 'Invalid login credentials'
        ? 'Those details did not match. Check your email and password, or choose Forgot password.'
        : result.error.message;
      return showStatus(message, true);
    }
    if (isSignup) return showStatus("Check your email to confirm your new DSAM'S account.");
    window.location.replace('./dashboard.html');
  });

  if (forgotPasswordButton) forgotPasswordButton.addEventListener('click', async () => {
    const email = document.querySelector('#email').value.trim();
    if (!email) return showStatus('Enter your email address first, then select Forgot password.', true);
    forgotPasswordButton.disabled = true;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password.html` });
    forgotPasswordButton.disabled = false;
    if (error) return showStatus(error.message, true);
    showStatus('If that email has a Student Portal account, we sent a password reset link.');
  });
}
