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
    columns_field_name: string[];
  };
  classification: {
    domain_category: string;
    domain_tags: string[];
    domain_metadata: { key: string; value: string }[];
  };
  metadata: {
    domain: string;
  };
  link: string;
}

// ─── Scoring Dimensions ───

interface DimensionScore {
  score: number;       // 0-100
  grade: string;       // A-F
  label: string;
  details: string[];   // bullet-point explanations
  weight: number;      // how much this contributes to overall
}

interface ReportCard {
  domain: string;
  overallScore: number;
  overallGrade: string;
  generatedAt: string;
  totalAssets: number;
  assetsFetched: number;
  dimensions: {
    metadataCompleteness: DimensionScore;
    dataFreshness: DimensionScore;
    engagement: DimensionScore;
    contentDiversity: DimensionScore;
    catalogOrganization: DimensionScore;
    portalActivity: DimensionScore;
  };
  trends: {
    weekOverWeekViewChange: number | null;
    activelyMaintainedPct: number;
    avgAssetAge: number;
    newestAssetDate: string;
    oldestAssetDate: string;
  };
  topPerformers: { name: string; type: string; viewsMonth: number; link: string }[];
  staleAssets: { name: string; type: string; lastUpdated: string; daysSinceUpdate: number; link: string }[];
  recommendations: string[];
}

function toGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
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

// ─── Scoring Functions ───

function scoreMetadataCompleteness(results: DiscoveryResult[]): DimensionScore {
  let hasDescription = 0;
  let hasCategory = 0;
  let hasTags = 0;
  let hasAttribution = 0;
  let hasColumnDescriptions = 0;
  const total = results.length;

  for (const r of results) {
    const res = r.resource;
    if (res.description && res.description.trim().length > 20) hasDescription++;
    if (r.classification?.domain_category) hasCategory++;
    if (r.classification?.domain_tags?.length > 0) hasTags++;
    if (res.attribution && res.attribution.trim().length > 0) hasAttribution++;
    if (res.columns_description?.some((d: string) => d && d.trim().length > 0)) hasColumnDescriptions++;
  }

  const descPct = total ? (hasDescription / total) * 100 : 0;
  const catPct = total ? (hasCategory / total) * 100 : 0;
  const tagPct = total ? (hasTags / total) * 100 : 0;
  const attrPct = total ? (hasAttribution / total) * 100 : 0;
  const colDescPct = total ? (hasColumnDescriptions / total) * 100 : 0;

  // Weighted average: descriptions matter most, then categories, then tags, then attribution, then col descriptions
  const score = Math.round(descPct * 0.30 + catPct * 0.25 + tagPct * 0.20 + attrPct * 0.10 + colDescPct * 0.15);

  const details: string[] = [];
  details.push(`${hasDescription}/${total} assets have meaningful descriptions (${descPct.toFixed(0)}%)`);
  details.push(`${hasCategory}/${total} assets are categorized (${catPct.toFixed(0)}%)`);
  details.push(`${hasTags}/${total} assets have tags (${tagPct.toFixed(0)}%)`);
  details.push(`${hasAttribution}/${total} assets have attribution (${attrPct.toFixed(0)}%)`);
  details.push(`${hasColumnDescriptions}/${total} datasets have column descriptions (${colDescPct.toFixed(0)}%)`);

  return { score, grade: toGrade(score), label: "Metadata Completeness", details, weight: 0.20 };
}

function scoreDataFreshness(results: DiscoveryResult[]): DimensionScore {
  const now = Date.now();
  let recent = 0, within30 = 0, within90 = 0, within365 = 0, dormant = 0;
  const ages: number[] = [];

  for (const r of results) {
    const updated = r.resource.data_updated_at || r.resource.updatedAt;
    if (!updated) { dormant++; continue; }
    const days = (now - new Date(updated).getTime()) / 86400000;
    ages.push(days);
    if (days < 7) recent++;
    else if (days < 30) within30++;
    else if (days < 90) within90++;
    else if (days < 365) within365++;
    else dormant++;
  }

  const total = results.length;
  const activePct = total ? ((recent + within30) / total) * 100 : 0;
  const freshPct = total ? ((recent + within30 + within90) / total) * 100 : 0;
  const dormantPct = total ? (dormant / total) * 100 : 0;

  // Score formula: active data = good, dormant data = bad
  let score = Math.round(
    (activePct * 0.50) +     // Recently updated (< 30d) is heavily rewarded
    (freshPct * 0.30) +      // Updated within 90d is moderately rewarded
    ((100 - dormantPct) * 0.20)  // Penalty for dormant data
  );
  score = Math.min(100, Math.max(0, score));

  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const details: string[] = [];
  details.push(`${recent} assets updated in last 7 days (${total ? ((recent/total)*100).toFixed(0) : 0}%)`);
  details.push(`${recent + within30} assets updated in last 30 days (${total ? (((recent + within30)/total)*100).toFixed(0) : 0}%)`);
  details.push(`${dormant} assets dormant >1 year (${dormantPct.toFixed(0)}%)`);
  details.push(`Average asset age: ${avgAge} days since last update`);

  return { score, grade: toGrade(score), label: "Data Freshness", details, weight: 0.25 };
}

function scoreEngagement(results: DiscoveryResult[]): DimensionScore {
  let totalViewsMonth = 0;
  let totalViewsWeek = 0;
  let totalDownloads = 0;
  let assetsWithViews = 0;
  let assetsWithDownloads = 0;

  for (const r of results) {
    const views = r.resource.page_views;
    totalViewsMonth += views?.page_views_last_month || 0;
    totalViewsWeek += views?.page_views_last_week || 0;
    totalDownloads += r.resource.download_count || 0;
    if ((views?.page_views_last_month || 0) > 0) assetsWithViews++;
    if ((r.resource.download_count || 0) > 0) assetsWithDownloads++;
  }

  const total = results.length;
  const viewedPct = total ? (assetsWithViews / total) * 100 : 0;
  const downloadedPct = total ? (assetsWithDownloads / total) * 100 : 0;
  const avgViewsPerAsset = total ? totalViewsMonth / total : 0;

  // Scoring: combination of breadth (% of assets viewed) and depth (views per asset)
  let score = 0;
  // Breadth: what % of assets get any views?
  score += viewedPct * 0.30;
  // Depth: logarithmic scale for average views per asset (100 views/asset = ~50pts, 1000 = ~75pts)
  const depthScore = avgViewsPerAsset > 0 ? Math.min(100, Math.log10(avgViewsPerAsset) * 33) : 0;
  score += depthScore * 0.40;
  // Downloads indicate higher-value engagement
  score += Math.min(downloadedPct * 2, 30) * 0.30;
  score = Math.min(100, Math.max(0, Math.round(score)));

  const weekOverWeekChange = totalViewsMonth > 0 ? ((totalViewsWeek * 4.33 - totalViewsMonth) / totalViewsMonth) * 100 : null;

  const details: string[] = [];
  details.push(`${totalViewsMonth.toLocaleString()} total monthly page views`);
  details.push(`${assetsWithViews}/${total} assets viewed this month (${viewedPct.toFixed(0)}%)`);
  details.push(`${avgViewsPerAsset.toFixed(0)} average views per asset`);
  details.push(`${totalDownloads.toLocaleString()} total downloads across ${assetsWithDownloads} assets`);
  if (weekOverWeekChange != null) {
    details.push(`Week-over-week velocity: ${weekOverWeekChange > 0 ? '+' : ''}${weekOverWeekChange.toFixed(1)}%`);
  }

  return { score, grade: toGrade(score), label: "Usage & Engagement", details, weight: 0.25 };
}

function scoreContentDiversity(results: DiscoveryResult[]): DimensionScore {
  const types: Record<string, number> = {};
  const categories = new Set<string>();
  let hasStories = false;
  let hasMeasures = false;
  let hasMaps = false;
  let hasCharts = false;

  for (const r of results) {
    const type = r.resource.type;
    types[type] = (types[type] || 0) + 1;
    if (r.classification?.domain_category) categories.add(r.classification.domain_category);
    if (type === "story") hasStories = true;
    if (type === "measure") hasMeasures = true;
    if (type === "map") hasMaps = true;
    if (type === "chart") hasCharts = true;
  }

  const typeCount = Object.keys(types).length;
  const catCount = categories.size;

  // Score: variety of asset types + category breadth + use of advanced features
  let score = 0;

  // Type diversity: 1 type = 10, 2 = 30, 3 = 50, 4 = 65, 5+ = 80
  score += Math.min(typeCount * 16, 80) * 0.35;

  // Category breadth (log scale: 1 cat = low, 5 = moderate, 10+ = good, 20+ = excellent)
  const catScore = catCount > 0 ? Math.min(100, Math.log2(catCount + 1) * 22) : 0;
  score += catScore * 0.35;

  // Advanced feature usage
  let featureBonus = 0;
  if (hasStories) featureBonus += 25;
  if (hasMeasures) featureBonus += 25;
  if (hasMaps) featureBonus += 25;
  if (hasCharts) featureBonus += 25;
  score += featureBonus * 0.30;

  score = Math.min(100, Math.max(0, Math.round(score)));

  const details: string[] = [];
  details.push(`${typeCount} distinct asset types in use`);
  details.push(`${catCount} content categories represented`);
  details.push(`Asset mix: ${Object.entries(types).sort((a,b) => b[1]-a[1]).map(([t,n]) => `${t}(${n})`).join(', ')}`);
  if (hasStories) details.push("Uses Stories (narrative data pages)");
  if (hasMeasures) details.push("Uses Measures (KPI tracking)");
  if (!hasStories && !hasMeasures) details.push("No Stories or Measures — opportunity for richer content");

  return { score, grade: toGrade(score), label: "Content Diversity", details, weight: 0.15 };
}

function scoreCatalogOrganization(results: DiscoveryResult[]): DimensionScore {
  let categorized = 0;
  let tagged = 0;
  let multiTagged = 0;
  const categoryCounts: Record<string, number> = {};
  const total = results.length;

  for (const r of results) {
    if (r.classification?.domain_category) {
      categorized++;
      const cat = r.classification.domain_category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const tagCount = r.classification?.domain_tags?.length || 0;
    if (tagCount > 0) tagged++;
    if (tagCount >= 3) multiTagged++;
  }

  const catPct = total ? (categorized / total) * 100 : 0;
  const tagPct = total ? (tagged / total) * 100 : 0;
  const catEntries = Object.entries(categoryCounts);
  const hasUncategorizedDominance = catEntries.some(([cat, count]) =>
    cat.toLowerCase() === "uncategorized" && total > 0 && (count / total) > 0.3
  );

  // Check for over-reliance on one category
  const topCatPct = catEntries.length > 0
    ? Math.max(...catEntries.map(([, c]) => c)) / total * 100
    : 0;

  let score = 0;
  score += catPct * 0.40;
  score += tagPct * 0.30;
  score += (total ? (multiTagged / total) * 100 : 0) * 0.15;
  // Penalty for poor distribution
  if (hasUncategorizedDominance) score -= 15;
  if (topCatPct > 60 && catEntries.length > 1) score -= 10;
  // Bonus for many well-used categories
  score += Math.min(catEntries.length * 2, 15) * 0.15;

  score = Math.min(100, Math.max(0, Math.round(score)));

  const details: string[] = [];
  details.push(`${categorized}/${total} assets categorized (${catPct.toFixed(0)}%)`);
  details.push(`${tagged}/${total} assets tagged (${tagPct.toFixed(0)}%)`);
  details.push(`${multiTagged}/${total} assets with 3+ tags`);
  details.push(`${catEntries.length} distinct categories in use`);
  if (hasUncategorizedDominance) details.push("Warning: >30% of assets are uncategorized");
  if (topCatPct > 60 && catEntries.length > 1) details.push(`Warning: Top category contains ${topCatPct.toFixed(0)}% of all assets`);

  return { score, grade: toGrade(score), label: "Catalog Organization", details, weight: 0.10 };
}

function scorePortalActivity(results: DiscoveryResult[]): DimensionScore {
  const now = Date.now();
  let created7d = 0, created30d = 0, created90d = 0;
  let updated7d = 0, updated30d = 0;
  const total = results.length;

  for (const r of results) {
    const created = r.resource.createdAt;
    if (created) {
      const days = (now - new Date(created).getTime()) / 86400000;
      if (days < 7) created7d++;
      if (days < 30) created30d++;
      if (days < 90) created90d++;
    }
    const updated = r.resource.data_updated_at || r.resource.updatedAt;
    if (updated) {
      const days = (now - new Date(updated).getTime()) / 86400000;
      if (days < 7) updated7d++;
      if (days < 30) updated30d++;
    }
  }

  // Actively publishing new content = high score
  // Actively maintaining existing content = moderate score
  let score = 0;

  // New content creation (within 90 days)
  const newContentScore = created90d > 0
    ? Math.min(100, created90d * 5 + (created30d * 10) + (created7d * 20))
    : 0;
  score += newContentScore * 0.40;

  // Maintenance activity (updates within 30 days)
  const maintenancePct = total ? (updated30d / total) * 100 : 0;
  score += maintenancePct * 0.40;

  // Update velocity (weekly updates)
  const weeklyVelocity = total ? (updated7d / total) * 100 : 0;
  score += Math.min(weeklyVelocity * 5, 100) * 0.20;

  score = Math.min(100, Math.max(0, Math.round(score)));

  const details: string[] = [];
  details.push(`${created7d} new assets created this week`);
  details.push(`${created30d} new assets created this month`);
  details.push(`${created90d} new assets created in last 90 days`);
  details.push(`${updated7d} assets updated this week`);
  details.push(`${updated30d}/${total} assets updated this month (${total ? ((updated30d/total)*100).toFixed(0) : 0}%)`);

  return { score, grade: toGrade(score), label: "Portal Activity", details, weight: 0.05 };
}

function generateRecommendations(dims: ReportCard["dimensions"], results: DiscoveryResult[]): string[] {
  const recs: string[] = [];

  if (dims.metadataCompleteness.score < 60) {
    recs.push("Prioritize a metadata enrichment sprint — add descriptions, categories, and tags to undocumented assets to improve discoverability.");
  }
  if (dims.dataFreshness.score < 50) {
    recs.push("Many assets appear stale. Review automated update schedules and consider archiving datasets that are no longer maintained.");
  }
  if (dims.engagement.score < 40) {
    recs.push("Low engagement suggests the portal may lack visibility. Consider promoting key datasets through Stories or embedding visualizations on agency websites.");
  }
  if (dims.contentDiversity.score < 50) {
    recs.push("The portal is dataset-heavy. Adding Stories, Measures, or Maps would create a more compelling public-facing experience.");
  }
  if (dims.catalogOrganization.score < 50) {
    recs.push("Many assets lack proper categorization. Implement a governance process for tagging and organizing new publications.");
  }
  if (dims.portalActivity.score < 30) {
    recs.push("Portal publishing activity is low. Schedule regular check-ins to encourage departments to publish and refresh content.");
  }
  if (dims.metadataCompleteness.score >= 80 && dims.engagement.score >= 70) {
    recs.push("Strong metadata and engagement — this site is a candidate for showcasing best practices to other clients.");
  }
  if (dims.dataFreshness.score >= 80) {
    recs.push("Excellent data freshness indicates active automation. Document pipeline patterns for replication across other departments.");
  }

  return recs;
}

export default async function handler(req: Request, _context: Context) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
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
        JSON.stringify({ error: `No assets found on ${domain}. Verify the domain is correct.` }),
        { status: 404 }
      );
    }

    // Score each dimension
    const metadataCompleteness = scoreMetadataCompleteness(results);
    const dataFreshness = scoreDataFreshness(results);
    const engagement = scoreEngagement(results);
    const contentDiversity = scoreContentDiversity(results);
    const catalogOrganization = scoreCatalogOrganization(results);
    const portalActivity = scorePortalActivity(results);

    const dimensions = {
      metadataCompleteness,
      dataFreshness,
      engagement,
      contentDiversity,
      catalogOrganization,
      portalActivity,
    };

    // Calculate weighted overall score
    const overallScore = Math.round(
      Object.values(dimensions).reduce((sum, d) => sum + d.score * d.weight, 0)
    );

    // Build trends
    const now = Date.now();
    const ages = results.map(r => {
      const d = r.resource.data_updated_at || r.resource.updatedAt;
      return d ? (now - new Date(d).getTime()) / 86400000 : 9999;
    }).filter(a => a < 9999);

    const createdDates = results.map(r => r.resource.createdAt).filter(Boolean).sort();

    let weekOverWeekViewChange: number | null = null;
    const totalViewsMonth = results.reduce((s, r) => s + (r.resource.page_views?.page_views_last_month || 0), 0);
    const totalViewsWeek = results.reduce((s, r) => s + (r.resource.page_views?.page_views_last_week || 0), 0);
    if (totalViewsMonth > 0) {
      weekOverWeekViewChange = ((totalViewsWeek * 4.33 - totalViewsMonth) / totalViewsMonth) * 100;
    }

    // Top performers and stale assets
    const topPerformers = results
      .filter(r => (r.resource.page_views?.page_views_last_month || 0) > 0)
      .sort((a, b) => (b.resource.page_views?.page_views_last_month || 0) - (a.resource.page_views?.page_views_last_month || 0))
      .slice(0, 10)
      .map(r => ({
        name: r.resource.name,
        type: r.resource.type,
        viewsMonth: r.resource.page_views?.page_views_last_month || 0,
        link: r.link,
      }));

    const staleAssets = results
      .map(r => {
        const updated = r.resource.data_updated_at || r.resource.updatedAt;
        return {
          name: r.resource.name,
          type: r.resource.type,
          lastUpdated: updated || "Unknown",
          daysSinceUpdate: updated ? Math.round((now - new Date(updated).getTime()) / 86400000) : 9999,
          link: r.link,
        };
      })
      .filter(a => a.daysSinceUpdate > 180)
      .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
      .slice(0, 10);

    const recommendations = generateRecommendations(dimensions, results);

    const reportCard: ReportCard = {
      domain,
      overallScore,
      overallGrade: toGrade(overallScore),
      generatedAt: new Date().toISOString(),
      totalAssets: total,
      assetsFetched: results.length,
      dimensions,
      trends: {
        weekOverWeekViewChange,
        activelyMaintainedPct: ages.length ? Math.round(ages.filter(a => a < 30).length / ages.length * 100) : 0,
        avgAssetAge: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0,
        newestAssetDate: createdDates[createdDates.length - 1] || "",
        oldestAssetDate: createdDates[0] || "",
      },
      topPerformers,
      staleAssets,
      recommendations,
    };

    return new Response(JSON.stringify(reportCard), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Report card error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = { path: "/api/report-card" };
