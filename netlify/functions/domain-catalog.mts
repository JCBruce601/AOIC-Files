import type { Context } from "@netlify/functions";

// Crawls the Discovery API to build a complete domain catalog
// Returns all unique Socrata domains with aggregated stats

interface DomainInfo {
  domain: string;
  count: number;
  viewsMonth: number;
  viewsTotal: number;
  types: Record<string, number>;
  categories: Record<string, number>;
  topTags: string[];
  latestUpdate: string;
  oldestAsset: string;
}

// Simple in-memory cache (persists across warm invocations)
let cachedCatalog: { domains: DomainInfo[]; fetchedAt: string; totalAssets: number } | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function buildCatalog(appToken?: string): Promise<{ domains: DomainInfo[]; totalAssets: number }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (appToken) headers["X-App-Token"] = appToken;

  const domains: Record<string, DomainInfo> = {};
  let totalAssets = 0;

  // Fetch in parallel batches. API caps at offset 10000, so we use multiple strategies.
  const fetches: Promise<any>[] = [];

  // Strategy 1: Sequential pages (default ordering)
  for (let offset = 0; offset <= 9500; offset += 500) {
    fetches.push(
      fetch(`https://api.us.socrata.com/api/catalog/v1?published=true&limit=500&offset=${offset}`, { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    );
  }

  const results = await Promise.all(fetches);

  for (const data of results) {
    if (!data?.results) continue;
    if (data.resultSetSize) totalAssets = Math.max(totalAssets, data.resultSetSize);

    for (const r of data.results) {
      const dom = r.metadata?.domain;
      if (!dom) continue;

      if (!domains[dom]) {
        domains[dom] = {
          domain: dom,
          count: 0,
          viewsMonth: 0,
          viewsTotal: 0,
          types: {},
          categories: {},
          topTags: [],
          latestUpdate: "",
          oldestAsset: "9999",
        };
      }

      const info = domains[dom];
      info.count++;
      info.viewsMonth += r.resource.page_views?.page_views_last_month || 0;
      info.viewsTotal += r.resource.page_views?.page_views_total || 0;

      const type = r.resource.type;
      info.types[type] = (info.types[type] || 0) + 1;

      const cat = r.classification?.domain_category;
      if (cat) info.categories[cat] = (info.categories[cat] || 0) + 1;

      const upd = r.resource.data_updated_at || r.resource.updatedAt || "";
      if (upd > info.latestUpdate) info.latestUpdate = upd;

      const created = r.resource.createdAt || "";
      if (created < info.oldestAsset) info.oldestAsset = created;
    }
  }

  // Build tag lists from categories
  const domainList = Object.values(domains).map(d => ({
    ...d,
    topTags: Object.entries(d.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat]) => cat),
  }));

  return { domains: domainList, totalAssets };
}

export default async function handler(req: Request, context: Context) {
  const now = Date.now();

  // Return cached if fresh
  if (cachedCatalog && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return new Response(JSON.stringify(cachedCatalog), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
    });
  }

  try {
    const appToken = Netlify.env.get("SOCRATA_APP_TOKEN") || "";
    const { domains, totalAssets } = await buildCatalog(appToken);

    cachedCatalog = { domains, fetchedAt: new Date().toISOString(), totalAssets };
    cacheTimestamp = now;

    return new Response(JSON.stringify(cachedCatalog), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=1800" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = { path: "/api/domain-catalog" };
