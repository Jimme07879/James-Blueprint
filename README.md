# The James Blueprint — Private Cloud Version

This package is a deploy-ready private web application for one user.

## What is included
- Secure Supabase email/password login
- Cloud-synced Daily Command Centre
- Daily history and editing
- Weekly reviews
- Business KPI snapshots
- Sales pipeline
- Relationship notes and score trend
- Health trends
- Goals and projects
- Vision and standards
- Row-level security so each user can only access their own records
- Mobile-friendly layout
- Vercel-ready Next.js project

## Setup

### 1. Create a Supabase project
Create a new Supabase project.

### 2. Create the database
Open **SQL Editor** in Supabase and run:

`supabase/schema.sql`

This creates every table and the row-level security rules.

### 3. Create your private user
In Supabase:
- Open **Authentication → Users**
- Add a user with your email and a strong password
- In **Authentication → Providers → Email**, disable public sign-ups if you want the app restricted to only users you create manually

### 4. Get the connection details
In Supabase project settings, copy:
- Project URL
- Anon public key

Create a local file called `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Never use the service-role key in this app.

### 5. Test locally
Install Node.js 20 or newer, then run:

```bash
npm install
npm run dev
```

Open the address shown in the terminal, usually `http://localhost:3000`.

### 6. Deploy privately on Vercel
- Put this project into a private GitHub repository
- Import that repository into Vercel
- Add the two environment variables from `.env.local`
- Deploy
- Use the Vercel address on your phone and computer
- Sign in with the private Supabase user you created

## Security notes
- Row-level security is enabled on every table.
- The browser only receives the Supabase anon key.
- Data access is limited by the logged-in user's ID.
- Disable public sign-ups in Supabase for a one-person system.
- Turn on multi-factor authentication when you are ready.
- Keep the GitHub repository private.
- Use a strong unique password.

## Current scope
This is the private personal cloud release. It does not yet include Sage CSV import, Outlook integration, reminders or automated backups outside Supabase. Those can be added later without changing the core structure.
