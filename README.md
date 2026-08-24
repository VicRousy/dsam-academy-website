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
