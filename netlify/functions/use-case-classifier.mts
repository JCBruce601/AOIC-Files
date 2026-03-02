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

// ─── Known Use Case Taxonomy ───

const USE_CASE_TAXONOMY = {
  general: [
    { id: "transparency", label: "Transparency & Open Government", keywords: ["transparency", "open data", "open government", "foia", "public records", "sunshine", "accountability"] },
    { id: "compliance", label: "Regulatory Compliance", keywords: ["compliance", "regulatory", "mandate", "requirement", "audit", "reporting requirement", "federal", "state requirement"] },
    { id: "performance", label: "Performance Management", keywords: ["performance", "kpi", "strategic plan", "metric", "benchmark", "dashboard", "scorecard", "goal", "outcome"] },
    { id: "civic_engagement", label: "Civic Engagement", keywords: ["civic", "community", "engagement", "public input", "feedback", "survey", "311", "resident", "citizen"] },
    { id: "equity", label: "Equity & Inclusion", keywords: ["equity", "racial equity", "inclusion", "disparity", "demographic", "diversity", "environmental justice", "underserved"] },
    { id: "legislative", label: "Legislative & Policy", keywords: ["legislative", "legislation", "ordinance", "resolution", "policy", "council", "commission", "statute", "code"] },
    { id: "internal_ops", label: "Internal Operations", keywords: ["internal", "operations", "workflow", "process", "efficiency", "inventory", "asset management", "fleet"] },
  ],
  specific: [
    { id: "public_safety", label: "Public Safety & Justice", keywords: ["crime", "police", "fire", "ems", "911", "incident", "arrest", "use of force", "shooting", "homicide", "calls for service", "emergency"] },
    { id: "finance_budget", label: "Finance & Budget", keywords: ["budget", "expenditure", "revenue", "payroll", "salary", "compensation", "tax", "financial", "procurement", "contract", "vendor", "spending"] },
    { id: "health", label: "Health & Human Services", keywords: ["health", "covid", "vaccination", "opioid", "mental health", "food inspection", "restaurant", "hospital", "clinic", "vital statistics", "death", "birth"] },
    { id: "transportation", label: "Transportation & Infrastructure", keywords: ["traffic", "transit", "road", "highway", "bridge", "bicycle", "pedestrian", "crash", "accident", "parking", "speed", "pothole", "pavement"] },
    { id: "environment", label: "Environment & Sustainability", keywords: ["air quality", "water quality", "energy", "emission", "climate", "tree", "recycling", "waste", "stormwater", "environmental"] },
    { id: "housing", label: "Housing & Development", keywords: ["permit", "building", "zoning", "housing", "property", "land use", "construction", "rental", "eviction", "code enforcement", "inspection"] },
    { id: "education", label: "Education", keywords: ["school", "student", "enrollment", "graduation", "test score", "teacher", "library", "education", "literacy"] },
    { id: "elections", label: "Elections & Voting", keywords: ["election", "voter", "ballot", "candidate", "campaign", "precinct", "poll", "registration", "vote"] },
    { id: "gis_mapping", label: "GIS & Geospatial", keywords: ["gis", "geospatial", "boundary", "parcel", "zoning map", "district", "ward", "census", "geocode", "shapefile"] },
    { id: "human_resources", label: "Human Resources & Workforce", keywords: ["employee", "position", "vacancy", "job", "workforce", "hr", "human resources", "staffing", "headcount"] },
    { id: "parks_recreation", label: "Parks & Recreation", keywords: ["park", "recreation", "facility", "playground", "trail", "community center", "pool", "athletic"] },
    { id: "utilities", label: "Utilities & Water", keywords: ["water", "sewer", "utility", "electric", "gas", "meter", "consumption", "outage", "infrastructure"] },
  ],
};

// ─── Rule-based signal detection ───

interface UseCaseSignal {
  id: string;
  label: string;
  category: "general" | "specific";
  matchCount: number;
  matchingAssets: { name: string; type: string; link: string; viewsMonth: number }[];
  confidence: "high" | "medium" | "low";
  totalViews: number;
}

function detectUseCaseSignals(results: DiscoveryResult[]): UseCaseSignal[] {
  const signals: Map<string, UseCaseSignal> = new Map();

  for (const taxonomy of [
    { category: "general" as const, items: USE_CASE_TAXONOMY.general },
    { category: "specific" as const, items: USE_CASE_TAXONOMY.specific },
  ]) {
    for (const uc of taxonomy.items) {
      const matchingAssets: UseCaseSignal["matchingAssets"] = [];

      for (const r of results) {
        const searchText = [
          r.resource.name,
          r.resource.description || "",
          r.classification?.domain_category || "",
          ...(r.classification?.domain_tags || []),
          ...(r.resource.columns_name || []),
        ].join(" ").toLowerCase();

        const matched = uc.keywords.some(kw => searchText.includes(kw));
        if (matched) {
          matchingAssets.push({
            name: r.resource.name,
            type: r.resource.type,
            link: r.link,
            viewsMonth: r.resource.page_views?.page_views_last_month || 0,
          });
        }
      }

      if (matchingAssets.length > 0) {
        const totalViews = matchingAssets.reduce((s, a) => s + a.viewsMonth, 0);
        signals.set(uc.id, {
          id: uc.id,
          label: uc.label,
          category: taxonomy.category,
          matchCount: matchingAssets.length,
          matchingAssets: matchingAssets.sort((a, b) => b.viewsMonth - a.viewsMonth).slice(0, 8),
          confidence: matchingAssets.length >= 10 ? "high" : matchingAssets.length >= 3 ? "medium" : "low",
          totalViews,
        });
      }
    }
  }

  return Array.from(signals.values()).sort((a, b) => b.matchCount - a.matchCount);
}

// ─── Build AI context for classification ───

function buildClassificationContext(
  domain: string,
  results: DiscoveryResult[],
  signals: UseCaseSignal[]
): string {
  const categories: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const types: Record<string, number> = {};

  for (const r of results) {
    types[r.resource.type] = (types[r.resource.type] || 0) + 1;
    if (r.classification?.domain_category) {
      categories[r.classification.domain_category] = (categories[r.classification.domain_category] || 0) + 1;
    }
    for (const t of r.classification?.domain_tags || []) {
      tags[t] = (tags[t] || 0) + 1;
    }
  }

  const topAssets = results.slice(0, 40).map(r => {
    return `[${r.resource.type}] "${r.resource.name}" | cat: ${r.classification?.domain_category || "N/A"} | views/mo: ${r.resource.page_views?.page_views_last_month || 0} | desc: ${(r.resource.description || "").slice(0, 120)}`;
  });

  // Also include a summary of stories specifically (they reveal editorial intent)
  const stories = results
    .filter(r => r.resource.type === "story")
    .slice(0, 15)
    .map(r => `"${r.resource.name}" — ${(r.resource.description || "No description").slice(0, 150)}`);

  return `
DOMAIN: ${domain}
TOTAL ASSETS: ${results.length} indexed

ASSET TYPES: ${JSON.stringify(types)}
TOP CATEGORIES: ${Object.entries(categories).sort((a,b) => b[1]-a[1]).slice(0, 15).map(([c,n]) => `${c}(${n})`).join(", ")}
TOP TAGS: ${Object.entries(tags).sort((a,b) => b[1]-a[1]).slice(0, 25).map(([t,n]) => `${t}(${n})`).join(", ")}

RULE-BASED SIGNAL DETECTION:
${signals.map(s => `- ${s.label} [${s.confidence}]: ${s.matchCount} assets, ${s.totalViews.toLocaleString()} monthly views`).join("\n")}

TOP ASSETS BY VIEWS:
${topAssets.join("\n")}

${stories.length > 0 ? `\nSTORIES (indicate editorial/narrative priorities):\n${stories.join("\n")}` : ""}
`.trim();
}

async function fetchAllAssets(domain: string, appToken?: string): Promise<{ results: DiscoveryResult[]; total: number }> {
  const allResults: DiscoveryResult[] = [];
  let offset = 0;
  const limit = 100;
  let total = 0;

  for (let page = 0; page < 10; page++) {
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
    const appToken = Netlify.env.get("SOCRATA_APP_TOKEN");
    const { results, total } = await fetchAllAssets(domain, appToken);

    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: `No assets found on ${domain}.` }),
        { status: 404 }
      );
    }

    // Step 1: Rule-based signal detection
    const signals = detectUseCaseSignals(results);

    // Step 2: AI-powered classification and synthesis
    const context = buildClassificationContext(domain, results, signals);

    const systemPrompt = `You are an expert at analyzing government open data portals to understand their purpose, priorities, and use cases.

Given a domain's full asset inventory and pre-detected use case signals, produce a comprehensive classification of the site's use cases.

Respond in this exact JSON structure:
{
  "sitePurpose": "1-2 sentence summary of what this portal primarily exists for",
  "primaryMission": "transparency|compliance|performance|civic_engagement|equity|legislative|internal_ops|mixed",
  "missionConfidence": "high|medium|low",
  "missionRationale": "Why you classified the mission this way",
  "generalUseCases": [
    {
      "id": "transparency|compliance|performance|civic_engagement|equity|legislative|internal_ops",
      "label": "Human-readable label",
      "strength": "dominant|strong|moderate|emerging|minimal",
      "evidence": "Specific evidence from the data that supports this classification",
      "assetCount": 0,
      "exampleAssets": ["Asset Name 1", "Asset Name 2"]
    }
  ],
  "specificUseCases": [
    {
      "id": "public_safety|finance_budget|health|transportation|environment|housing|education|elections|gis_mapping|human_resources|parks_recreation|utilities|other",
      "label": "Human-readable label",
      "strength": "dominant|strong|moderate|emerging|minimal",
      "evidence": "Specific evidence from the data",
      "assetCount": 0,
      "topAssets": ["Asset Name 1", "Asset Name 2", "Asset Name 3"],
      "viewsMonth": 0,
      "policyAreas": ["Specific policy areas this addresses"]
    }
  ],
  "narrativeThemes": [
    {
      "theme": "Name of theme found in stories/narratives",
      "description": "What this theme covers",
      "supportingStories": ["Story names"]
    }
  ],
  "dataConcentration": {
    "description": "Whether data is concentrated in certain areas or broadly distributed",
    "dominantAreas": ["Area 1", "Area 2"],
    "dominantAreaPct": 0,
    "gaps": ["Notable topic areas missing from the portal"]
  },
  "maturityAssessment": {
    "level": "advanced|intermediate|basic|nascent",
    "rationale": "Why this maturity level",
    "indicators": ["Specific indicators of maturity"]
  }
}

Be specific and reference actual asset names. Distinguish between dominant use cases (the portal clearly centers on this) and emerging ones (some data exists but it's not a major focus). Identify patterns the rule-based system may have missed.`;

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
        messages: [{
          role: "user",
          content: `Classify the use cases for this government data portal:\n\n${context}`,
        }],
      }),
    });

    if (!aiResp.ok) {
      const err = await aiResp.text();
      console.error("Anthropic API error:", err);
      return new Response(JSON.stringify({ error: "AI classification failed", detail: err }), { status: 502 });
    }

    const aiData = await aiResp.json();
    const aiText = aiData.content?.[0]?.text || "";

    let classification;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      classification = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      classification = null;
    }

    return new Response(JSON.stringify({
      domain,
      totalAssets: total,
      assetsFetched: results.length,
      signals,
      classification,
      rawAnalysis: classification ? undefined : aiText,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Use case classifier error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = { path: "/api/use-case-classifier" };
