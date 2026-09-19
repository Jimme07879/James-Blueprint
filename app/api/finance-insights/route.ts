import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    insights: {
      type: "array", minItems: 2, maxItems: 5,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          level: { type: "string", enum: ["priority", "watch", "positive", "info"] },
          title: { type: "string" }, detail: { type: "string" }
        }, required: ["level", "title", "detail"]
      }
    }
  }, required: ["insights"]
};

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: "Supabase authentication is not configured." }, { status: 503 });
  const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await client.auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_FINANCE_MODEL;
  if (!apiKey || !model) return NextResponse.json({ error: "The optional AI service needs OPENAI_API_KEY and OPENAI_FINANCE_MODEL in the server settings." }, { status: 503 });
  const body = await request.json();
  const prompt = `You are the financial-analysis layer for a UK food wholesaler. Analyse only the supplied Sage-derived figures. Do not recalculate or invent amounts. Identify the most decision-useful monthly cost movements, margin changes, missing postings, one-off-looking transactions, and areas to investigate. Distinguish evidence from possible explanations. A rise is not automatically a saving opportunity. Use concise British English. Management profit excludes corporation tax, dividends, interest and depreciation. Current month may be incomplete when its key matches the current calendar month.\n\nDATA:\n${JSON.stringify(body)}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, input: prompt,
      text: { format: { type: "json_schema", name: "finance_insights", strict: true, schema } }
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("Finance insights API error", response.status, detail.slice(0, 500));
    return NextResponse.json({ error: "AI analysis is temporarily unavailable." }, { status: 502 });
  }
  const result = await response.json();
  const outputText = result.output_text || result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
  if (!outputText) return NextResponse.json({ error: "AI analysis returned no usable result." }, { status: 502 });
  try { return NextResponse.json(JSON.parse(outputText)); }
  catch { return NextResponse.json({ error: "AI analysis returned an invalid result." }, { status: 502 }); }
}
