# Blueprint OS 6.1 — Sage Live Bridge

## Added
- New Sage Live section inside Blueprint.
- Private Bridge Key generation; Blueprint stores only the SHA-256 hash.
- Read-only Windows Sage Bridge package.
- Sage ODBC SALES_LEDGER sync for customer account reference, name, balance, credit limit, email and telephone where available.
- Live bridge status, last sync time and customer count.
- Live Sage customer balance table.
- Home Business Pulse can use live Sage customer balances once records exist.
- Optional automatic Windows sync every 15 minutes.

## Safety
6.1 uses Sage's read-only ODBC driver. It cannot update Sage 50 data.

## Database
Run `supabase/v6_1_sage_live_bridge.sql` once before generating a Bridge Key.

## Windows
Copy the `sage-bridge` folder to the Sage computer and follow `sage-bridge/README.txt`.
