# Blueprint OS 5.7 — Financial Intelligence

## Added
- Dedicated Finance / Financial Intelligence centre.
- CSV import centre for Sage, Fresho and other exports.
- Flexible column mapping and five-row preview before import.
- Imported sales, gross profit, GP %, debtors and overdue debt KPIs.
- 12-week sales and gross-profit trend.
- Customer intelligence: declining, dormant and growing customers.
- Steve Financial Brief with a suggested commercial move.
- One-click conversion of declining/dormant customer signals into Sales follow-ups.
- Import history with row counts and financial totals.

## Database
Run `supabase/v5_7_financial_intelligence.sql` once before opening Finance.

## Design principle
Sage and Fresho remain the source systems. Blueprint stores imported analysis rows and turns the figures into action.
