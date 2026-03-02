import type { Context } from "@netlify/functions";

// Deep domain indexing: fetches all assets across multiple pages, then
// sends the aggregated profile to Claude for AI-powered use case analysis.

interface DiscoveryResult {
  results: any[];
  resultSetSize: number;
}

async function fetchAllAssets(domain: string, appToken?: string): Promise<{ results: any[]; total: number }> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (appToken) headers["X-App-Token"] = appToken;

  const allResults: any[] = [];
  let offset = 0;
  const pageSize = 100;
  let total = 0;
  const maxPages = 10; // Cap at 1000 assets to stay under limits

  for (let page = 0; page < maxPages; page++) {
    const url = `https://api.us.socrata.com/api/catalog/v1?published=true&domains=${encodeURIComponent(domain)}&limit=${pageSize}&offset=${offset}&order=page_views_last_month`;
    const resp = await fetch(url, { headers });
    if (!resp.ok) break;
    const data: DiscoveryResult = await resp.json();
    if (page === 0) total = data.resultSetSize;
    if (!data.results?.length) break;
    allResults.push(...data.results);
    offset += pageSize;
    if (allResults.length >= total || allResults.length >= 1000) break;
  }

  return { results: allResults, total };
}

function buildSiteProfile(domain: string, results: any[], total: number) {
  const types: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const tags: Record<string, number> = {};
  let totalViewsMonth = 0;
  let totalViewsTotal = 0;
  let totalDownloads = 0;
  const freshness = { week: 0, month: 0, quarter: 0, stale: 0 };
  const agencies: Record<string, number> = {};
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

    if (res.attribution) {
      agencies[res.attribution] = (agencies[res.attribution] || 0) + 1;
    }

    const updated = res.data_updated_at || res.updatedAt;
    if (updated) {
      const days = (now - new Date(updated).getTime()) / 86400000;
      if (days < 7) freshness.week++;
      else if (days < 30) freshness.month++;
      else if (days < 90) freshness.quarter++;
      else freshness.stale++;
    }
  }

  // Top datasets by views with column info for use case detection
  const topDatasets = results
    .filter(r => r.resource.type === "dataset")
    .sort((a, b) => (b.resource.page_views?.page_views_last_month || 0) - (a.resource.page_views?.page_views_last_month || 0))
    .slice(0, 20)
    .map(r => ({
      name: r.resource.name,
      id: r.resource.id,
      category: r.classification?.domain_category || "Uncategorized",
      description: (r.resource.description || "").slice(0, 200),
      viewsMonth: r.resource.page_views?.page_views_last_month || 0,
      downloads: r.resource.download_count || 0,
      columns: (r.resource.columns_name || []).slice(0, 15),
      columnTypes: (r.resource.columns_datatype || []).slice(0, 15),
      tags: r.classification?.domain_tags || [],
      updatedAt: r.resource.data_updated_at || r.resource.updatedAt,
      attribution: r.resource.attribution,
    }));

  const sortDesc = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]);

  return {
    domain,
    totalAssets: total,
    indexedAssets: results.length,
    assetTypes: sortDesc(types),
    categories: sortDesc(categories),
    topTags: sortDesc(tags).slice(0, 25),
    agencies: sortDesc(agencies).slice(0, 15),
    engagement: { monthlyViews: totalViewsMonth, totalViews: totalViewsTotal, totalDownloads: totalDownloads },
    freshness,
    topDatasets,
  };
}

async function generateAiAnalysis(profile: any, apiKey: string): Promise<string> {
  const prompt = `You are an expert analyst for Tyler Technologies' Data & Insights division. You help Client Success Managers understand government open data portals built on the Socrata platform.

Analyze this site profile for "${profile.domain}" and produce a comprehensive Site Intelligence Report. Be specific, citing actual dataset names, categories, and patterns you observe.

SITE PROFILE:
- Total assets: ${profile.totalAssets} (${profile.indexedAssets} indexed)
- Asset types: ${profile.assetTypes.map(([t,c]: [string,number]) => `${t}: ${c}`).join(", ")}
- Categories: ${profile.categories.map(([c,n]: [string,number]) => `${c} (${n})`).join(", ")}
- Top tags: ${profile.topTags.slice(0,15).map(([t,c]: [string,number]) => t).join(", ")}
- Contributing agencies: ${profile.agencies.slice(0,10).map(([a,c]: [string,number]) => `${a} (${c})`).join(", ")}
- Monthly views: ${profile.engagement.monthlyViews.toLocaleString()} | Total views: ${profile.engagement.totalViews.toLocaleString()} | Downloads: ${profile.engagement.totalDownloads.toLocaleString()}
- Data freshness: ${profile.freshness.week} updated this week, ${profile.freshness.month} this month, ${profile.freshness.quarter} this quarter, ${profile.freshness.stale} stale (90+ days)

TOP 20 DATASETS (by monthly views):
${profile.topDatasets.map((ds: any) => `- "${ds.name}" [${ds.category}] ${ds.viewsMonth.toLocaleString()} views/mo, ${ds.downloads.toLocaleString()} downloads
  Attribution: ${ds.attribution || "N/A"}
  Columns: ${ds.columns.join(", ")}
  Tags: ${ds.tags.join(", ")}
  Last updated: ${ds.updatedAt || "N/A"}`).join("\n")}

Produce the following sections:

1. EXECUTIVE SUMMARY (2-3 sentences capturing what this portal is about, its maturity, and engagement level)

2. PRIMARY USE CASES (identify 4-8 distinct use cases this portal serves, with specific dataset evidence)

3. DEPARTMENT COVERAGE (which agencies/departments are well represented vs gaps)

4. ENGAGEMENT ANALYSIS (what's driving traffic, what's underperforming, automation signals from freshness data)

5. DATA MATURITY ASSESSMENT (rate Low/Medium/High across: breadth, depth, freshness, engagement, metadata quality)

6. EXPANSION OPPORTUNITIES (specific Tyler D&I products/features that could add value: TIR dashboards, performance analytics, Stories, connected reporting)

7. RISK SIGNALS (stale data, low engagement areas, missing categories that peer cities typically publish)

Be concise but specific. Use the actual dataset names and numbers. This report will be used by CSMs for account planning.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`AI analysis failed: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.content?.[0]?.text || "Analysis unavailable.";
}

export default async function handler(req: Request, context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), { status: 405 });
  }

  try {
    const { domain, analyze } = await req.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: "domain is required" }), { status: 400 });
    }

    const appToken = Netlify.env.get("SOCRATA_APP_TOKEN") || "";
    const { results, total } = await fetchAllAssets(domain, appToken);

    if (results.length === 0) {
      return new Response(JSON.stringify({ error: `No assets found for domain: ${domain}` }), { status: 404 });
    }

    const profile = buildSiteProfile(domain, results, total);

    let aiAnalysis: string | null = null;
    if (analyze) {
      const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
      if (apiKey) {
        aiAnalysis = await generateAiAnalysis(profile, apiKey);
      } else {
        aiAnalysis = "AI analysis unavailable: ANTHROPIC_API_KEY not configured.";
      }
    }

    return new Response(JSON.stringify({ profile, aiAnalysis }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = {
  path: "/api/index-site",
};
