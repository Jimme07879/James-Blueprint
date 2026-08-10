# Blueprint OS 5.3 — Steve Inbox Ops

This release turns the live Outlook connection into an operations workflow rather than a passive inbox.

## New
- Steve triage buckets: Needs Action, Orders, Supplier & Finance, Routine, Handled.
- Private Supabase sync of Outlook message metadata and handled state.
- Create Task from any email. Tasks use the existing Goals table with `Inbox task` status and are separated from normal goal metrics; completing an inbox task removes it from the action board.
- Mark Handled / Reopen controls.
- Open in Outlook remains available for full message handling.
- Inbox task action board on the Email screen.
- Goals screen now separates Inbox Tasks from strategic goals/projects.
- Home/Email metrics ignore handled mail when calculating current workload.

## Database
If `public.email_messages` is not already installed, run `supabase/v5_3_email_bridge.sql` once in Supabase SQL Editor. It is safe to run repeatedly.

## Microsoft
The browser integration still only requires `NEXT_PUBLIC_MICROSOFT_CLIENT_ID` and delegated `Mail.Read`. No client secret is required for this build.
