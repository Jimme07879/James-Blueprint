# Version 7.0 — N&J Management Accounts

## Added

- Management accounts P&L and balance-sheet snapshot
- Live Sage stock sync using quantity and average cost
- Monthly physical stock-count register
- Slow, damaged and obsolete stock provisions
- Month-end adjustments and budgets
- Month-end completion checklist and close status

## Deployment note

After the website and database migration are deployed, rerun the Sage Bridge installer on the office computer, then run the bridge once. Existing finance pages continue to work before the stock sync is run; the stock page will simply show that no live stock has synced yet.
