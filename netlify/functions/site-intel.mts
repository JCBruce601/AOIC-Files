import type { Context } from "@netlify/functions";

const DISCOVERY_API = "https://api.us.socrata.com/api/catalog/v1";

interface DiscoveryResult {
  resource: {
    name: string;
    id: string;
    type: string;
    description: string;
    attribution: string;
    updatedAt: string;
    createdAt: string;
    data_updated_at: string;
    page_views: {
      page_views_last_week: number;
      page_views_last_month: number;
      page_views_total: number;
    };
    download_count: number;
    columns_name: string[];
    columns_datatype: string[];
    columns_description: string[];
  };
  classification: {
    domain_category: string;
    domain_tags: string[];
  };
  metadata: {
    domain: string;
  };
  link: string;
}

async function fetchAllAssets(domain: string, appToken?: string): Promise<{ results: DiscoveryResult[]; total: number }> {
  const allResults: DiscoveryResult[] = [];
  let offset = 0;
  const limit = 100;
  let total = 0;

  // Fetch up to 500 assets (5 pages) to get comprehensive view
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      published: "true",
      domains: domain,
      limit: String(limit),
      offset: String(offset),
      order: "page_views_last_month",
    });

    const headers: Record<string, string> = { Accept: "application/json" };
    if (appToken) headers["X-App-Token"] = appToken;

    const resp = await fetch(`${DISCOVERY_API}?${params}`, { headers });
    if (!resp.ok) throw new Error(`Discovery API error: ${resp.status}`);

    const data = await resp.json();
    total = data.resultSetSize || 0;
    allResults.push(...data.results);

    if (data.results.length < limit || allResults.length >= total) break;
    offset += limit;
  }

  return { results: allResults, total };
}

function buildSiteAnalytics(results: DiscoveryResult[], total: number) {
  const types: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const tags: Record<string, number> = {};
  let totalViewsMonth = 0;
  let totalViewsTotal = 0;
  let totalDownloads = 0;
  const freshness = { recent: 0, stale30: 0, stale90: 0, dormant: 0 };
  const now = Date.now();

  for (const r of results) {
    const res = r.resource;
    types[res.type] = (types[res.type] || 0) + 1;
    const cat = r.classification?.domain_category || "Uncategorized";
    categories[cat] = (categories[cat] || 0) + 1;
    for (const t of r.classification?.domain_tags || []) {
      tags[t] = (tags[t] || 0) + 1;
    }
    totalViewsMonth += res.page_views?.page_views_last_month || 0;
    totalViewsTotal += res.page_views?.page_views_total || 0;
    totalDownloads += res.download_count || 0;

    const updated = res.data_updated_at || res.updatedAt;
    if (updated) {
      const days = (now - new Date(updated).getTime()) / 86400000;
      if (days < 7) freshness.recent++;
      else if (days < 30) freshness.stale30++;
      else if (days < 90) freshness.stale90++;
      else freshness.dormant++;
    }
  }

  return {
    totalAssets: total,
    assetsFetched: results.length,
    assetTypes: types,
    categories: Object.entries(categories).sort((a, b) => b[1] - a[1]),
    topTags: Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 30),
    engagement: { monthlyViews: totalViewsMonth, totalViews: totalViewsTotal, downloads: totalDownloads },
    freshness,
  };
}

function buildAIContext(domain: string, results: DiscoveryResult[], analytics: ReturnType<typeof buildSiteAnalytics>) {
  // Build a rich but token-efficient context for the AI
  const topAssets = results.slice(0, 60).map((r) => {
    const res = r.resource;
    const cols = (res.columns_name || []).slice(0, 12).join(", ");
    return `[${res.type}] "${res.name}" | cat: ${r.classification?.domain_category || "N/A"} | views/mo: ${res.page_views?.page_views_last_month || 0} | cols: ${cols || "N/A"} | desc: ${(res.description || "").slice(0, 150)}`;
  });

  return `
DOMAIN: ${domain}
TOTAL ASSETS: ${analytics.totalAssets}
ASSET BREAKDOWN: ${JSON.stringify(analytics.assetTypes)}
TOP CATEGORIES: ${analytics.categories.slice(0, 15).map(([c, n]) => `${c} (${n})`).join(", ")}
TOP TAGS: ${analytics.topTags.slice(0, 20).map(([t, n]) => `${t} (${n})`).join(", ")}
ENGAGEMENT: ${analytics.engagement.monthlyViews.toLocaleString()} monthly views, ${analytics.engagement.downloads.toLocaleString()} downloads
DATA FRESHNESS: ${analytics.freshness.recent} updated <7d, ${analytics.freshness.stale30} <30d, ${analytics.freshness.stale90} <90d, ${analytics.freshness.dormant} >90d

ASSET INVENTORY (top ${topAssets.length} by monthly views):
${topAssets.join("\n")}
`.trim();
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), { status: 500 });
  }

  const { domain } = await req.json();
  if (!domain) {
    return new Response(JSON.stringify({ error: "domain is required" }), { status: 400 });
  }

  try {
    // Step 1: Crawl the domain
    const appToken = Netlify.env.get("SOCRATA_APP_TOKEN");
    const { results, total } = await fetchAllAssets(domain, appToken);

    if (results.length === 0) {
      return new Response(JSON.stringify({ error: `No assets found on ${domain}. Verify the domain is correct.` }), { status: 404 });
    }

    // Step 2: Build analytics
    const analytics = buildSiteAnalytics(results, total);

    // Step 3: Build AI context and generate profile
    const context = buildAIContext(domain, results, analytics);

    const systemPrompt = `You are a senior Client Success Manager at Tyler Technologies, Data & Insights division. You specialize in analyzing Socrata open data portals to understand how government clients use our platform.

Given a complete inventory of a client's data portal, generate a structured Site Intelligence Profile. Your analysis should be insightful, specific, and actionable. Identify patterns in the data that reveal the client's priorities, maturity, and opportunities.

Respond in this exact JSON structure:
{
  "summary": "2-3 sentence executive summary of the site's purpose, scale, and health",
  "primaryUseCases": [
    { "name": "Use case name", "description": "What this use case accomplishes", "assets": ["asset names that support it"], "strength": "strong|moderate|emerging" }
  ],
  "departmentsServed": [
    { "name": "Department name", "dataAreas": ["list of data topics they publish"], "engagement": "high|medium|low" }
  ],
  "platformHealth": {
    "overallScore": "A|B|C|D|F",
    "dataFreshness": "Description of how current the data is",
    "engagementLevel": "Description of usage patterns",
    "contentQuality": "Assessment of descriptions, categorization, metadata quality",
    "risks": ["Specific risk factors identified"],
    "strengths": ["Specific strengths identified"]
  },
  "expansionOpportunities": [
    { "opportunity": "Name", "rationale": "Why this makes sense based on their current data", "products": ["Relevant Tyler D&I products"] }
  ],
  "recommendedActions": [
    { "priority": "high|medium|low", "action": "Specific recommended action", "rationale": "Why" }
  ],
  "keyMetrics": {
    "engagementTier": "Enterprise|Growth|Starter",
    "dataDomains": "Number of distinct subject areas",
    "automationSignals": "Evidence of automated data pipelines vs manual uploads",
    "transparencyMaturity": "Advanced|Intermediate|Basic"
  }
}

Be specific. Reference actual dataset names and categories from the inventory. Identify genuine patterns, not generic observations. The CSM will use this to prepare for client meetings and build account plans.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Analyze this Socrata data portal and generate a Site Intelligence Profile:\n\n${context}`,
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const err = await aiResp.text();
      console.error("Anthropic API error:", err);
      return new Response(JSON.stringify({ error: "AI analysis failed", detail: err }), { status: 502 });
    }

    const aiData = await aiResp.json();
    const aiText = aiData.content?.[0]?.text || "";

    // Parse the JSON from the AI response
    let profile;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      profile = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      profile = null;
    }

    return new Response(
      JSON.stringify({
        domain,
        analytics,
        profile,
        rawAnalysis: profile ? undefined : aiText,
        assets: results.slice(0, 20).map((r) => ({
          name: r.resource.name,
          id: r.resource.id,
          type: r.resource.type,
          category: r.classification?.domain_category,
          viewsMonth: r.resource.page_views?.page_views_last_month,
          viewsTotal: r.resource.page_views?.page_views_total,
          downloads: r.resource.download_count,
          columns: r.resource.columns_name?.length || 0,
          updated: r.resource.data_updated_at || r.resource.updatedAt,
          link: r.link,
        })),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Site intel error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = {
  path: "/api/site-intel",
};
