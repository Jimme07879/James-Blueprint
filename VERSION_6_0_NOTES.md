# Blueprint OS 6.0 — Steve Action OS

## The milestone
6.0 turns the 5.9 Command Centre into an action-first operating screen.

## Added
- NOW / TODAY / WATCH priority buckets on Home.
- A richer Steve Action Queue, ranked by commercial importance.
- Direct actions from Home: Do Today, Call, Email, Open Customer/Prospect, Chase Payment/Open Finance, Tomorrow, Snooze and Done.
- A stronger “What should I do next?” panel with immediate execution buttons.
- “Tomorrow” creates the action with tomorrow’s deadline instead of merely hiding it.
- Customer/Sales prompts attempt to use the matching Sales phone/email directly when available.
- Home remains the command surface; detailed sections remain available for drill-down.
- Sage Bridge preparation remains deliberately separate so the stable read-only command system is not coupled to desktop Sage integration yet.

## Database
No new SQL is required for 6.0. It uses the `steve_alerts` table introduced in 5.9.
