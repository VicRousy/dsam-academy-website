# DSAM'S Academy of Music Website

## Project layout

- `src/styles/` contains the website styles.
- `src/scripts/config/` contains editable academy and pricing settings.
- `src/scripts/site/` contains public homepage behaviour.
- `src/scripts/enrollment/` handles student enrolment submissions.
- `src/scripts/portals/` contains student, staff, and admin portal behaviour.
- `public/assets/` contains images served directly by the website.
- `api/` contains Vercel serverless functions.
- `supabase/` contains database setup and access-policy scripts.

## Run locally

1. Copy `.env.example` to `.env.local` and add your Supabase values.
2. Run `npm run dev`.
3. Open the local address shown in the terminal.

## Create a production build

Run `npm run build`.

## Owner staff-request emails

When a person requests Staff Portal access, the site can email the owner a secure review link. Set these Vercel environment variables when the owner is ready:

- `RESEND_API_KEY` — kept secret; never add it to website code.
- `FROM_EMAIL` — an address on the academy's verified domain.
- `STAFF_REQUEST_RECIPIENT` — normally `dsamacademyofmusic@gmail.com`.
- `APP_URL` — the final public website address.

The email review button opens Admin Portal. The owner must still sign in before approving or denying the request.
