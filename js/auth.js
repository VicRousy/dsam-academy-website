import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const form = document.querySelector('#authForm');
const googleButton = document.querySelector('#googleButton');
const modeButton = document.querySelector('#modeButton');
const emailButton = document.querySelector('#emailButton');
const status = document.querySelector('#authStatus');
const authCard = document.querySelector('#authCard');
const signedInCard = document.querySelector('#signedInCard');
let createMode = false;

function showStatus(message, error = false) {
  status.textContent = message;
  status.className = `auth-status${error ? ' error' : ''}`;
}

function setMode() {
  emailButton.textContent = createMode ? 'Create Account' : 'Sign In';
  modeButton.textContent = createMode ? 'Already have an account? Sign in' : 'New to DSAM? Create an account';
  document.querySelector('#password').autocomplete = createMode ? 'new-password' : 'current-password';
  showStatus('');
}

if (!url || !key) {
  [googleButton, emailButton, modeButton].forEach((button) => { button.disabled = true; });
  showStatus('Student accounts are being set up. Please check back shortly.', true);
} else {
  const supabase = createClient(url, key);
  const showMember = (session) => {
    authCard.hidden = true;
    signedInCard.hidden = false;
    document.querySelector('#memberEmail').textContent = session.user.email;
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (session) showMember(session);

  googleButton.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth.html` } });
    if (error) showStatus(error.message, true);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.querySelector('#email').value;
    const password = document.querySelector('#password').value;
    emailButton.disabled = true;
    showStatus(createMode ? 'Creating your account…' : 'Signing you in…');
    const result = createMode
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth.html` } })
      : await supabase.auth.signInWithPassword({ email, password });
    emailButton.disabled = false;
    if (result.error) return showStatus(result.error.message, true);
    if (createMode) return showStatus('Check your email to confirm your new DSAM account.');
    showMember(result.data.session);
  });

  modeButton.addEventListener('click', () => { createMode = !createMode; setMode(); });
  document.querySelector('#signOutButton').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.reload(); });
}
