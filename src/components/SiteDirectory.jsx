import { useState, useEffect, useMemo, useRef } from "react";
import { formatNumber, timeAgo, ASSET_TYPES } from "../utils/api.js";
import segmentationData from "../data/segmentation.json";

/* ─── Icons ─── */
const Icon = ({ d, size = 16, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const SearchIcon = () => <Icon d="M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.35-4.35" size={18} sw={2} />;
const ExternalIcon = () => <Icon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={14} />;
const FilterIcon = () => <Icon d="M22 3H2l8 9.46V19l4 2v-8.54L22 3" size={14} />;
const ChevronDown = () => <Icon d="M6 9l6 6 6-6" size={12} />;
const GridIcon = () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" size={14} />;
const ListIcon = () => <Icon d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" size={14} />;
const ScanIcon = () => <Icon d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" size={14} />;

const mono = { fontFamily: "'Roboto Mono', monospace" };
const sCard = { background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', boxShadow: 'var(--forge-elevation-1)' };

/* ─── Segment Badge ─── */
function SegBadge({ label, color }) {
  const colors = {
    "Justice": { bg: '#fce4ec', c: '#b71c1c' },
    "Public Admin": { bg: '#e8eaf6', c: '#283593' },
    "State": { bg: '#e0f2f1', c: '#00695c' },
    "Local Government - Enterprise": { bg: '#e3f2fd', c: '#1565c0' },
    "Local Government - Pro": { bg: '#fff8e1', c: '#f57f17' },
    "State & Federal": { bg: '#f3e5f5', c: '#6a1b9a' },
    "Schools - Enterprise": { bg: '#e8f5e9', c: '#2e7d32' },
    "Schools - Pro": { bg: '#fff3e0', c: '#e65100' },
  };
  const s = colors[label] || { bg: 'var(--forge-surface-container-minimum)', c: 'var(--forge-text-medium)' };
  return <span style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.6125rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 500, background: s.bg, color: s.c, border: `1px solid ${s.c}22`, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>{label}</span>;
}

/* ─── Freshness Dot ─── */
function FreshnessDot({ dateStr }) {
  if (!dateStr) return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#bdbdbd', display: 'inline-block' }} title="Unknown" />;
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  const color = days < 7 ? '#2e7d32' : days < 30 ? '#66bb6a' : days < 90 ? '#ffc107' : '#ef5350';
  const label = days < 7 ? 'Active' : days < 30 ? 'Recent' : days < 90 ? 'Aging' : 'Stale';
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6875rem', color: 'var(--forge-text-medium)' }} title={`Last updated: ${timeAgo(dateStr)}`}><span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />{label}</span>;
}

/* ─── Type Mini Chart ─── */
function TypeMiniBar({ types }) {
  const total = Object.values(types).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const typeColors = { dataset: '#3f51b5', chart: '#00bcd4', map: '#4caf50', story: '#9c27b0', measure: '#ff9800', filter: '#e91e63', calendar: '#795548', href: '#607d8b' };
  return (
    <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', width: 80 }} title={Object.entries(types).map(([t, c]) => `${t}: ${c}`).join(', ')}>
      {Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
        <div key={t} style={{ width: `${(c / total * 100).toFixed(0)}%`, background: typeColors[t] || '#bdbdbd' }} />
      ))}
    </div>
  );
}

/* ─── Filter Dropdown ─── */
function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ appearance: 'none', padding: '6px 28px 6px 10px', fontSize: '0.75rem', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', background: value ? 'var(--forge-primary-container-low)' : 'var(--forge-surface)', color: 'var(--forge-text-high)', cursor: 'pointer', fontFamily: 'var(--forge-font-family)', minWidth: 120 }}>
        <option value="">{label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--forge-text-low)' }}><ChevronDown /></span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function SiteDirectory({ onSelectDomain }) {
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("viewsMonth");
  const [sortDir, setSortDir] = useState("desc");
  const [vertFilter, setVertFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [view, setView] = useState("table"); // "table" | "grid"
  const inputRef = useRef(null);

  // Fetch domain catalog
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/domain-catalog");
        if (!resp.ok) throw new Error("Failed to load catalog");
        const data = await resp.json();
        setCatalog(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Merge catalog with segmentation
  const domains = useMemo(() => {
    if (!catalog?.domains) return [];
    return catalog.domains.map(d => {
      const seg = segmentationData.domains[d.domain] || {};
      return {
        ...d,
        clientName: seg.clientName || d.domain.replace(/^(data\.|www\.|datahub\.|performance\.|internal[-.]?)/, '').replace(/\.(gov|org|com|net|us|ca|info|au|co)$/, '').replace(/\./g, ' '),
        verticalGroup: seg.verticalGroup || null,
        marketSegment: seg.marketSegment || null,
        tylerSegmentation: seg.tylerSegmentation || null,
        isMapped: !!seg.clientName,
      };
    });
  }, [catalog]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...domains];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.domain.toLowerCase().includes(q) ||
        (d.clientName || '').toLowerCase().includes(q) ||
        d.topTags.some(t => t.toLowerCase().includes(q)) ||
        Object.keys(d.categories).some(c => c.toLowerCase().includes(q)) ||
        Object.keys(d.types).some(t => t.toLowerCase().includes(q))
      );
    }

    if (vertFilter) result = result.filter(d => d.verticalGroup === vertFilter);
    if (marketFilter) result = result.filter(d => d.marketSegment === marketFilter);

    result.sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'domain') return mul * a.domain.localeCompare(b.domain);
      if (sortBy === 'count') return mul * (a.count - b.count);
      if (sortBy === 'viewsMonth') return mul * (a.viewsMonth - b.viewsMonth);
      if (sortBy === 'viewsTotal') return mul * (a.viewsTotal - b.viewsTotal);
      if (sortBy === 'freshness') return mul * (a.latestUpdate || '').localeCompare(b.latestUpdate || '');
      return 0;
    });

    return result;
  }, [domains, search, sortBy, sortDir, vertFilter, marketFilter]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortHeader = ({ col, label, width }) => (
    <th onClick={() => toggleSort(col)} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', width, whiteSpace: 'nowrap' }}>
      {label} {sortBy === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--forge-text-low)', gap: 8 }}>
      <div style={{ width: 20, height: 20, border: '2px solid var(--forge-outline)', borderTopColor: 'var(--forge-tertiary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '0.875rem' }}>Loading domain catalog...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--forge-error)' }}>{error}</div>;

  const stats = {
    total: domains.length,
    mapped: domains.filter(d => d.isMapped).length,
    totalViews: domains.reduce((a, d) => a + d.viewsMonth, 0),
    totalAssets: domains.reduce((a, d) => a + d.count, 0),
  };

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header Stats */}
      <div className="animate-fade-up" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 500, margin: 0 }}>Site Directory</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--forge-text-low)', margin: 0 }}>{stats.total} Socrata domains · {formatNumber(stats.totalAssets)} assets · {formatNumber(stats.totalViews)} monthly views</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--forge-surface-container-minimum)', borderRadius: 'var(--forge-shape-medium)', padding: 2 }}>
            {[{ id: 'table', icon: <ListIcon /> }, { id: 'grid', icon: <GridIcon /> }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                style={{ padding: '4px 8px', borderRadius: 'var(--forge-shape-small)', background: view === v.id ? 'var(--forge-surface)' : 'transparent', border: view === v.id ? '1px solid var(--forge-outline)' : '1px solid transparent', color: view === v.id ? 'var(--forge-text-high)' : 'var(--forge-text-low)', cursor: 'pointer', display: 'flex' }}>
                {v.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
            <input ref={inputRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search domains, categories, tags, use cases..."
              className="forge-input" style={{ width: '100%', paddingLeft: 36, fontSize: '0.8125rem' }} />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--forge-text-low)' }}><SearchIcon /></span>
          </div>
          <FilterSelect label="Vertical Group" value={vertFilter} onChange={setVertFilter}
            options={segmentationData._meta.lenses.verticalGroup.values} />
          <FilterSelect label="Market Segment" value={marketFilter} onChange={setMarketFilter}
            options={segmentationData._meta.lenses.marketSegment.values} />
          {(vertFilter || marketFilter || search) && (
            <button onClick={() => { setVertFilter(''); setMarketFilter(''); setSearch(''); }}
              style={{ padding: '6px 10px', fontSize: '0.75rem', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', background: 'transparent', color: 'var(--forge-text-medium)', cursor: 'pointer' }}>Clear</button>
          )}
        </div>
      </div>

      {/* Results Count */}
      <div style={{ fontSize: '0.75rem', color: 'var(--forge-text-low)', marginBottom: 8 }}>
        {filtered.length === domains.length ? `${filtered.length} domains` : `${filtered.length} of ${domains.length} domains`}
      </div>

      {/* Table View */}
      {view === 'table' && (
        <div className="animate-fade-in" style={{ ...sCard, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--forge-surface-container-minimum)' }}>
                  <SortHeader col="domain" label="Domain" />
                  <th style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Segment</th>
                  <SortHeader col="count" label="Assets" width={80} />
                  <SortHeader col="viewsMonth" label="Views/Mo" width={90} />
                  <th style={{ padding: '10px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Types</th>
                  <th style={{ padding: '10px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>Top Categories</th>
                  <SortHeader col="freshness" label="Freshness" width={80} />
                  <th style={{ padding: '10px 12px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.domain} style={{ borderTop: '1px solid var(--forge-outline)', cursor: 'pointer', transition: 'background 100ms' }}
                    onClick={() => onSelectDomain(d.domain)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--forge-surface-container-minimum)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500, fontSize: '0.8125rem', color: 'var(--forge-text-high)' }}>{d.clientName || d.domain}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)', ...mono }}>{d.domain}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {d.verticalGroup && <SegBadge label={d.verticalGroup} />}
                        {d.marketSegment && <SegBadge label={d.marketSegment} />}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', ...mono, fontSize: '0.8125rem', color: 'var(--forge-text-high)', textAlign: 'right' }}>{d.count}</td>
                    <td style={{ padding: '10px 12px', ...mono, fontSize: '0.8125rem', color: 'var(--forge-text-high)', textAlign: 'right' }}>{formatNumber(d.viewsMonth)}</td>
                    <td style={{ padding: '10px 12px' }}><TypeMiniBar types={d.types} /></td>
                    <td style={{ padding: '10px 12px', fontSize: '0.6875rem', color: 'var(--forge-text-medium)', maxWidth: 200 }}>
                      {d.topTags.slice(0, 3).join(', ')}
                    </td>
                    <td style={{ padding: '10px 12px' }}><FreshnessDot dateStr={d.latestUpdate} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={e => { e.stopPropagation(); onSelectDomain(d.domain); }}
                        style={{ display: 'flex', padding: 4, border: 'none', background: 'transparent', color: 'var(--forge-tertiary)', cursor: 'pointer' }}
                        title="View site intelligence"><ScanIcon /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--forge-text-low)', fontSize: '0.875rem' }}>No domains match your search. Try broader terms.</div>}
        </div>
      )}

      {/* Grid View */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
          {filtered.map(d => (
            <div key={d.domain} onClick={() => onSelectDomain(d.domain)}
              style={{ ...sCard, padding: 16, cursor: 'pointer', transition: 'all 200ms' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--forge-elevation-4)'; e.currentTarget.style.borderColor = 'var(--forge-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--forge-elevation-1)'; e.currentTarget.style.borderColor = 'var(--forge-outline)'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{d.clientName || d.domain}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)', ...mono }}>{d.domain}</div>
                </div>
                <FreshnessDot dateStr={d.latestUpdate} />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {d.verticalGroup && <SegBadge label={d.verticalGroup} />}
                {d.marketSegment && <SegBadge label={d.marketSegment} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--forge-text-medium)' }}>
                <span><strong style={{ color: 'var(--forge-text-high)', ...mono }}>{d.count}</strong> assets</span>
                <span><strong style={{ color: 'var(--forge-text-high)', ...mono }}>{formatNumber(d.viewsMonth)}</strong>/mo</span>
              </div>
              <div style={{ marginTop: 8 }}><TypeMiniBar types={d.types} /></div>
              {d.topTags.length > 0 && <div style={{ marginTop: 6, fontSize: '0.6125rem', color: 'var(--forge-text-low)', lineHeight: 1.4 }}>{d.topTags.slice(0, 4).join(' · ')}</div>}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'var(--forge-text-low)' }}>No domains match your search.</div>}
        </div>
      )}
    </div>
  );
}
