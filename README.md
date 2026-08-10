# The James Blueprint — Private Cloud Version 1.2

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


## Version 1.1 additions
- Daily standard on the dashboard
- Today's mission and relationship action shown immediately
- 30-day momentum cards for exercise, smoke-free days, priorities and goals
- Stronger CEO focus on the home dashboard
- No database migration required from Version 1.0

## Updating your live Vercel app
Replace the files in your GitHub repository with this package and commit them. Vercel should automatically deploy the update. Keep your existing Supabase database and environment variables.


## Version 1.2 additions
- Automatically opens today's saved daily entry
- Daily worksheet completion percentage and progress bar
- Consecutive daily check-in streak
- Exercise and smoke-free streaks
- Automatic seven-day performance summary
- Weekly review KPI cards
- Goal completion progress
- Overdue goal warnings
- One-click goal completion
- No Supabase database migration required

## Updating the live app
Upload and commit the extracted Version 1.2 files to the same GitHub repository. Vercel will automatically create a new deployment. Your existing Supabase database, login and environment variables remain unchanged.

## Blueprint OS 4.0 North Star Foundation
This release reorganises the application around James rather than around business operations.

### New navigation
Home, Daily, Me, Relationships, Health, Goals, CEO, Analytics, Weekly, Business Hub and Settings.

### Deployment
Upload and commit the extracted files to the existing GitHub repository. Vercel will deploy automatically. Keep the existing Supabase project and environment variables. No SQL migration is required.


## Blueprint OS 4.0 North Star
- Stevie Daily Brief generated from your existing data
- Transparent pattern detection for sleep, energy, mood, stress, exercise, recovery and relationship actions
- Personalised next-action recommendation
- Life Balance radar wheel
- Morning dashboard with direct Daily and Stevie buttons
- CEO and business pulse inside the briefing
- No database migration or external AI key required

## Privacy
Version 3.0 uses local application rules against records already held in your Supabase account. It does not transmit your personal journal or wellbeing data to an external AI provider.


## Version 4.0
Adds Proof Timeline and Blueprint Vault. Run `supabase/v4_0_north_star.sql` once, then deploy the code update.


## Blueprint OS 5.0 — Judgement & Balance
- Blueprint Score on Home
- Weighted score breakdown
- Decision Journal
- Decision review dates and lessons
- Home decision review card

Run `supabase/v5_0_decision_journal.sql` once before using the Decisions module.

## Version 5.1 — Executive Edition
Adds a premium mobile-first visual system, persistent dark mode, improved Home and Stevie presentation, refined cards and controls, and a redesigned login experience. No SQL migration is required.


## Blueprint OS 5.2 — Steve Ops
Adds the Outlook Email Focus module and Steve's Inbox Brief. Follow `MICROSOFT_EMAIL_SETUP.md` and add `NEXT_PUBLIC_MICROSOFT_CLIENT_ID` to Vercel.
