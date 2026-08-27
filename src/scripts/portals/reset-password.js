import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const form = document.querySelector('#resetPasswordForm');
const status = document.querySelector('#resetStatus');
const password = document.querySelector('#newPassword');
const confirmPassword = document.querySelector('#confirmNewPassword');
const passwordToggle = document.querySelector('#newPasswordToggle');
const submitButton = document.querySelector('#resetPasswordButton');

function showStatus(message, error = false) {
  status.textContent = message;
  status.className = `auth-status${error ? ' error' : ''}`;
}

passwordToggle.addEventListener('click', () => {
  const shouldShowPassword = password.type === 'password';
  password.type = shouldShowPassword ? 'text' : 'password';
  passwordToggle.textContent = shouldShowPassword ? 'Hide' : 'Show';
  passwordToggle.setAttribute('aria-label', shouldShowPassword ? 'Hide new password' : 'Show new password');
  passwordToggle.setAttribute('aria-pressed', String(shouldShowPassword));
});

if (!url || !key) {
  [submitButton, passwordToggle].forEach((button) => { button.disabled = true; });
  showStatus('Password reset is being set up. Please check back shortly.', true);
} else {
  const supabase = createClient(url, key);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    submitButton.disabled = true;
    showStatus('Open the password reset link from your email to set a new password.', true);
  } else {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (password.value !== confirmPassword.value) {
        showStatus('Your passwords do not match. Please check them and try again.', true);
        return;
      }

      submitButton.disabled = true;
      showStatus('Saving your new password…');
      const { error } = await supabase.auth.updateUser({ password: password.value });
      submitButton.disabled = false;

      if (error) {
        showStatus(error.message, true);
        return;
      }

      showStatus('Password updated. You can now sign in with your email and new password.');
      await supabase.auth.signOut();
      window.setTimeout(() => window.location.replace('./auth.html'), 1800);
    });
  }
}
