# Finance Blueprint V1

Finance Blueprint is a separate financial-only interface within the existing Blueprint deployment.

Route: `/finance-blueprint`

## Included in V1

- Sage financial-year reporting from 1 April 2026
- Monthly sales, gross profit, running costs and management profit
- Monthly cost comparison by staff, premises, vehicles, administration/technology and finance
- Individual Sage cost transaction drill-down
- Total live Sage customer debt
- Built-in, deterministic financial checks that work without an AI service
- Optional server-side AI analysis using the OpenAI Responses API and structured output

## Required existing environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Optional AI environment variables

- `OPENAI_API_KEY`
- `OPENAI_FINANCE_MODEL`

The API key remains server-side. The AI endpoint verifies the signed-in Supabase user before accepting a request. If the optional AI service is not configured or unavailable, the dashboard continues to show its built-in checks.

AI commentary is advisory. All calculations are performed in application code from the Sage-derived values, and individual costs remain traceable to their source transactions.
