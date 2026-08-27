import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (url && key) {
  const supabase = createClient(url, key);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.replace('./dashboard.html');
}
