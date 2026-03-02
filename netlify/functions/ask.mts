import type { Context, Config } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI assistant not configured. Set ANTHROPIC_API_KEY in Netlify env vars." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { question, searchResults } = await req.json();

    // Build context from search results for the AI
    let dataContext = "";
    if (searchResults && searchResults.length > 0) {
      dataContext = searchResults
        .slice(0, 15)
        .map((r: any, i: number) => {
          const res = r.resource;
          const meta = r.metadata;
          const cls = r.classification;
          return [
            `${i + 1}. "${res.name}"`,
            `   Domain: ${meta?.domain}`,
            `   Type: ${res.type} | Category: ${cls?.domain_category || "N/A"}`,
            `   Views (month): ${res.page_views?.page_views_last_month?.toLocaleString() || "N/A"}`,
            `   Downloads: ${res.download_count?.toLocaleString() || "N/A"}`,
            `   Description: ${(res.description || "").slice(0, 300)}`,
            `   Columns: ${(res.columns_name || []).slice(0, 12).join(", ")}`,
            `   Link: ${r.link}`,
          ].join("\n");
        })
        .join("\n\n");
    }

    const systemPrompt = `You are an expert on government open data, transparency, and the Socrata/Tyler Data & Insights platform. You help government officials, data analysts, and the public discover how open data portals are being used across the country.

Your role:
- Help people find relevant datasets, stories, dashboards, and measures across all Socrata-powered open data sites
- Explain how different governments structure and publish their data
- Identify use cases, best practices, and trends in government data publishing
- Suggest related searches or datasets they might not have considered
- Speak knowledgeably about asset types: datasets, stories (narrative pages), charts, maps, measures (KPIs), filters (saved views), and calendars

When search results are provided, analyze them to give specific, actionable answers. Reference specific datasets by name and domain. Note patterns across jurisdictions.

Keep responses concise but insightful. Use specific examples from the data. Never fabricate dataset names or URLs.`;

    const userMessage = dataContext
      ? `Based on these search results from the Socrata Discovery API:\n\n${dataContext}\n\nUser question: ${question}`
      : `User question (no search results available yet): ${question}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `AI API error: ${response.status}`, detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || "No response generated.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "AI error", message: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config: Config = { path: "/api/ask" };
