# DSAM Student Portal setup

The login page is ready at `/auth.html`. To activate it:

1. Create a free Supabase project at [supabase.com](https://supabase.com).
2. In **Authentication → Providers**, enable **Email** and **Google**.
3. In Google Cloud, create a Web OAuth client. Add `https://dsam-academy-website.vercel.app` as an authorized JavaScript origin, and add Supabase's callback URL from its Google provider setup screen as an authorized redirect URI.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://dsam-academy-website.vercel.app` and add `https://dsam-academy-website.vercel.app/auth.html` to Redirect URLs.
5. In Vercel → Project → Settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
6. Redeploy the site. Never put a Supabase service-role key in browser code.

After that, users can sign in with Google or create and confirm an email/password account.
