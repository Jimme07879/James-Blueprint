Blueprint Sage Bridge 6.1
========================

Read-only Sage 50 Accounts v32 customer/debtor sync for Blueprint OS.

WHAT IT DOES
- Reads Sage's SALES_LEDGER table through the Sage ODBC driver.
- Syncs customer account reference, name, balance, credit limit, phone and email where those fields exist.
- Sends the snapshot securely to Blueprint using the private Bridge Key.
- Does NOT write anything back to Sage.

SETUP
1. In Supabase run: supabase/v6_1_sage_live_bridge.sql
2. Deploy Blueprint OS 6.1.
3. Open Blueprint > Sage Live.
4. Generate a Bridge Key and download the bridge config.
5. Copy this sage-bridge folder to the computer that runs Sage.
6. Put the downloaded config in this folder and name it:
   blueprint-sage-bridge-config.json
7. Run Install-BlueprintSageBridge.ps1 in Windows PowerShell.
