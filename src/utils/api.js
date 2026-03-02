// Discovery API wrapper
export async function discoverAssets(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set("q", params.q);
  if (params.only) searchParams.set("only", params.only);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.order) searchParams.set("order", params.order);
  if (params.min_should_match) searchParams.set("min_should_match", String(params.min_should_match));
  if (params.search_context) searchParams.set("search_context", params.search_context);

  const resp = await fetch(`/api/discover?${searchParams.toString()}`);
  if (!resp.ok) throw new Error(`Discovery API error: ${resp.status}`);
  return resp.json();
}

// AI assistant
export async function askAssistant(question, searchResults = []) {
  const resp = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, searchResults }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `AI error: ${resp.status}`);
  }
  return resp.json();
}

// Site Intelligence (internal module)
export async function analyzeSite(domain) {
  const resp = await fetch("/api/site-intel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Site intel error: ${resp.status}`);
  }
  return resp.json();
}

// Quick domain stats (no AI, just crawl)
export async function fetchDomainStats(domain) {
  const params = new URLSearchParams({ published: "true", domains: domain, limit: "1" });
  const resp = await fetch(`/api/discover?${params}`);
  if (!resp.ok) throw new Error("Failed to fetch domain stats");
  const data = await resp.json();
  return { total: data.resultSetSize || 0, exists: (data.resultSetSize || 0) > 0 };
}

// Dataset metadata
export async function fetchMetadata(domain, id) {
  const resp = await fetch(`/api/metadata?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`);
  if (!resp.ok) throw new Error(`Metadata error: ${resp.status}`);
  return resp.json();
}

// Format numbers
export function formatNumber(n) {
  if (n == null) return "N/A";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

// Format date relative
export function timeAgo(dateStr) {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const days = Math.floor(diffMs / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// Asset type config
export const ASSET_TYPES = {
  dataset: { label: "Datasets", icon: "◫", color: "blue" },
  story: { label: "Stories", icon: "◇", color: "violet" },
  chart: { label: "Charts", icon: "◰", color: "cyan" },
  map: { label: "Maps", icon: "◎", color: "emerald" },
  measure: { label: "Measures", icon: "◈", color: "amber" },
  filter: { label: "Filters", icon: "⊞", color: "rose" },
  calendar: { label: "Calendars", icon: "▤", color: "purple" },
  href: { label: "Links", icon: "⊡", color: "gray" },
};

// Rank options
export const RANK_OPTIONS = [
  { value: "page_views_last_month", label: "Views (Month)" },
  { value: "page_views_last_week", label: "Views (Week)" },
  { value: "page_views_total", label: "Views (All Time)" },
];

// Suggested searches organized by category
export const SUGGESTED_SEARCHES = [
  { category: "Public Safety", terms: ["Crime", "911 Calls", "Police Incidents", "Fire", "Use of Force"] },
  { category: "Finance & Budget", terms: ["Budget", "Payroll", "Expenditures", "Revenue", "Contracts"] },
  { category: "Health & Human Services", terms: ["COVID", "Opioids", "Mental Health", "Homelessness", "Food Inspections"] },
  { category: "Transportation", terms: ["Traffic", "Transit", "Bicycle", "Pedestrian", "Parking Violations"] },
  { category: "Environment", terms: ["Air Quality", "Water Quality", "Energy", "Trees", "Recycling"] },
  { category: "Housing & Development", terms: ["Permits", "Building", "Zoning", "Housing", "Property"] },
  { category: "Education", terms: ["Schools", "Enrollment", "Test Scores", "Libraries", "Graduation"] },
  { category: "Performance & Results", terms: ["Performance", "Dashboard", "KPI", "Strategic Plan", "Equity"] },
];

// ─── Internal Module: Site Indexer ───

export async function indexSite(domain, analyze = true) {
  const resp = await fetch("/api/index-site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, analyze }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Index error: ${resp.status}`);
  }
  return resp.json();
}

// ─── Report Card ───

export async function fetchReportCard(domain) {
  const resp = await fetch("/api/report-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Report card error: ${resp.status}`);
  }
  return resp.json();
}

// ─── Use Case Classifier ───

export async function classifyUseCases(domain) {
  const resp = await fetch("/api/use-case-classifier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `Use case classifier error: ${resp.status}`);
  }
  return resp.json();
}
