import { useState, useRef, useEffect } from "react";
import { formatNumber, timeAgo, ASSET_TYPES, fetchReportCard, classifyUseCases } from "../utils/api.js";

/* ─── Icons ─── */
const Icon = ({ d, size = 16, sw = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const ScanIcon = () => <Icon d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" size={20} />;
const ChevronRight = () => <Icon d="M9 18l6-6-6-6" size={14} />;
const CopyIcon = () => <Icon d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M8 2h8v4H8z" size={14} />;
const ExternalIcon = () => <Icon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={14} />;
const SearchIcon = () => <Icon d="M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.35-4.35" size={18} sw={2} />;
const CheckIcon = () => <Icon d="M20 6L9 17l-5-5" size={14} sw={2} />;
const TrendUpIcon = () => <Icon d="M23 6l-9.5 9.5-5-5L1 18" size={14} />;
const AlertIcon = () => <Icon d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" size={14} />;

const mono = { fontFamily: "'Roboto Mono', monospace" };
const sLabel = { fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 6 };
const sCard = { background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', padding: 20, boxShadow: 'var(--forge-elevation-1)' };

/* ─── Score Badge ─── */
function ScoreBadge({ score }) {
  const colors = { A: "#2e7d32", B: "#66bb6a", C: "#f57f17", D: "#e65100", F: "#b71c1c" };
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "var(--forge-shape-large)", background: colors[score] || colors.C, color: "#fff", fontWeight: 700, fontSize: "1rem", ...mono }}>{score}</span>;
}

/* ─── Strength Badge ─── */
function StrengthBadge({ level }) {
  const m = { strong: { bg: '#e8f5e9', c: '#2e7d32' }, moderate: { bg: '#fff8e1', c: '#f57f17' }, emerging: { bg: '#e8eaf6', c: '#3f51b5' } };
  const v = m[level] || m.moderate;
  return <span style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 500, background: v.bg, color: v.c, border: `1px solid ${v.c}33` }}>{level}</span>;
}

/* ─── Priority Badge ─── */
function PriorityBadge({ priority }) {
  const m = { high: { bg: '#fce4ec', c: '#b71c1c' }, medium: { bg: '#fff8e1', c: '#f57f17' }, low: { bg: '#f5f5f5', c: '#757575' } };
  const v = m[priority] || m.medium;
  return <span style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 500, background: v.bg, color: v.c }}>{priority}</span>;
}

/* ─── Engagement Dot ─── */
function EngagementDot({ level }) {
  const m = { high: '#2e7d32', medium: '#f57f17', low: '#b00020' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--forge-text-medium)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: m[level] || '#757575' }} />{level}</span>;
}

/* ─── Freshness Bar ─── */
function FreshnessBar({ freshness }) {
  if (!freshness) return null;
  const total = (freshness.recent || 0) + (freshness.stale30 || 0) + (freshness.stale90 || 0) + (freshness.dormant || 0);
  if (!total) return null;
  const pct = v => ((v / total) * 100).toFixed(1);
  const segments = [
    { key: 'recent', label: '< 7d', count: freshness.recent, color: '#2e7d32' },
    { key: 'stale30', label: '< 30d', count: freshness.stale30, color: '#66bb6a' },
    { key: 'stale90', label: '< 90d', count: freshness.stale90, color: '#ffc107' },
    { key: 'dormant', label: '> 90d', count: freshness.dormant, color: '#ef5350' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 8, borderRadius: 'var(--forge-shape-full)', overflow: 'hidden', marginBottom: 8 }}>
        {segments.map(s => <div key={s.key} style={{ width: `${pct(s.count)}%`, background: s.color }} title={`${s.label}: ${s.count}`} />)}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.6875rem', color: 'var(--forge-text-medium)' }}>
        {segments.map(s => <span key={s.key}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 4 }} />{s.label}: {s.count}</span>)}
      </div>
    </div>
  );
}

/* ─── Copy Button ─── */
function CopyButton({ getText }) {
  const [copied, setCopied] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(getText()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.6875rem', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', background: 'transparent', color: copied ? 'var(--forge-success)' : 'var(--forge-text-low)', cursor: 'pointer' }}>
    {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Export</>}
  </button>;
}

/* ─── Analysis Progress Stepper ─── */
function AnalysisProgress({ step }) {
  const steps = [
    { key: "crawl", label: "Crawling domain assets", detail: "Fetching up to 500 assets via Discovery API" },
    { key: "analyze", label: "Building analytics", detail: "Aggregating categories, tags, freshness metrics" },
    { key: "ai", label: "Generating intelligence", detail: "AI is synthesizing use cases, risks, and recommendations" },
  ];
  const idx = steps.findIndex(s => s.key === step);
  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', gap: 12, padding: '12px 0', opacity: i <= idx ? 1 : 0.3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${i < idx ? 'var(--forge-success)' : i === idx ? 'var(--forge-tertiary)' : 'var(--forge-outline)'}`,
              background: i < idx ? 'var(--forge-success)' : 'transparent',
              color: i < idx ? '#fff' : i === idx ? 'var(--forge-tertiary)' : 'var(--forge-text-low)',
              fontSize: '0.75rem', fontWeight: 700,
              animation: i === idx ? 'pulse 2s infinite' : 'none' }}>
              {i < idx ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 16, background: i < idx ? 'var(--forge-success)' : 'var(--forge-outline)' }} />}
          </div>
          <div style={{ paddingTop: 4 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: i <= idx ? 'var(--forge-text-high)' : 'var(--forge-text-low)' }}>{s.label}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{s.detail}</div>
          </div>
        </div>
      ))}
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  );
}

/* ─── Asset Row ─── */
function AssetRow({ asset }) {
  const cfg = ASSET_TYPES[asset.type] || { icon: '•' };
  return (
    <tr style={{ borderTop: '1px solid var(--forge-outline)' }}>
      <td style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge-${asset.type}`} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--forge-text-high)', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{asset.category || 'Uncategorized'}</div>
          </div>
        </div>
      </td>
      <td style={{ padding: '8px 12px', ...mono, fontSize: '0.75rem', color: 'var(--forge-text-high)' }}>{formatNumber(asset.viewsMonth)}</td>
      <td style={{ padding: '8px 12px', ...mono, fontSize: '0.75rem', color: 'var(--forge-text-medium)' }}>{formatNumber(asset.downloads)}</td>
      <td style={{ padding: '8px 12px', fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{asset.columns} cols</td>
      <td style={{ padding: '8px 12px', fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{timeAgo(asset.updated)}</td>
      <td style={{ padding: '8px 12px' }}><a href={asset.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--forge-tertiary)' }}><ExternalIcon /></a></td>
    </tr>
  );
}

/* ─── Grade Ring (SVG) ─── */
function GradeRing({ score, grade, size = 80 }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const gradeColors = { A: '#2e7d32', B: '#66bb6a', C: '#f57f17', D: '#e65100', F: '#b71c1c' };
  const color = gradeColors[grade] || gradeColors.C;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--forge-outline)" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 700, color, ...mono }}>{grade}</span>
        <span style={{ fontSize: size * 0.14, color: 'var(--forge-text-low)', ...mono }}>{score}</span>
      </div>
    </div>
  );
}

/* ─── Dimension Bar ─── */
function DimensionBar({ dim }) {
  const gradeColors = { A: '#2e7d32', B: '#66bb6a', C: '#f57f17', D: '#e65100', F: '#b71c1c' };
  const color = gradeColors[dim.grade] || gradeColors.C;
  return (
    <div style={{ ...sCard, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{dim.label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...mono, fontSize: '0.8125rem', color }}>{dim.score}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 'var(--forge-shape-medium)', background: color, color: '#fff', fontSize: '0.6875rem', fontWeight: 700, ...mono }}>{dim.grade}</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'var(--forge-surface-container-minimum)', borderRadius: 'var(--forge-shape-full)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${dim.score}%`, height: '100%', background: color, borderRadius: 'var(--forge-shape-full)', transition: 'width 0.8s ease' }} />
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '0.75rem', color: 'var(--forge-text-medium)', lineHeight: 1.8 }}>
        {dim.details.slice(0, 4).map((d, i) => <li key={i}>{d}</li>)}
      </ul>
    </div>
  );
}

/* ─── Strength Tag ─── */
function StrengthTag({ strength }) {
  const colors = {
    dominant: { bg: '#1b5e20', c: '#fff' },
    strong: { bg: '#e8f5e9', c: '#2e7d32' },
    moderate: { bg: '#fff8e1', c: '#f57f17' },
    emerging: { bg: '#e8eaf6', c: '#3f51b5' },
    minimal: { bg: '#f5f5f5', c: '#757575' },
  };
  const v = colors[strength] || colors.moderate;
  return <span style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 600, background: v.bg, color: v.c }}>{strength}</span>;
}

/* ─── Report Card View ─── */
function ReportCardView({ domain }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    fetchReportCard(domain)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [domain]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--forge-text-low)' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--forge-outline)', borderTopColor: 'var(--forge-tertiary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
      <div style={{ fontSize: '0.8125rem' }}>Generating report card for {domain}...</div>
      <div style={{ fontSize: '0.6875rem', marginTop: 4 }}>Analyzing metadata, freshness, engagement, and organization</div>
    </div>
  );

  if (error) return <div style={{ padding: 16, borderRadius: 'var(--forge-shape-medium)', background: 'rgba(176,0,32,0.08)', border: '1px solid rgba(176,0,32,0.3)', color: 'var(--forge-error)', fontSize: '0.8125rem' }}>{error}</div>;
  if (!data) return null;

  const dims = data.dimensions;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Overall Grade */}
      <div style={{ ...sCard, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <GradeRing score={data.overallScore} grade={data.overallGrade} size={96} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 4 }}>Overall Health: {data.overallGrade}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6 }}>
            Score {data.overallScore}/100 across {data.totalAssets.toLocaleString()} total assets ({data.assetsFetched} analyzed).
            Generated {new Date(data.generatedAt).toLocaleString()}.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{data.trends.activelyMaintainedPct}% actively maintained</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>Avg update age: {data.trends.avgAssetAge}d</span>
            {data.trends.weekOverWeekViewChange != null && (
              <span style={{ fontSize: '0.6875rem', color: data.trends.weekOverWeekViewChange >= 0 ? 'var(--forge-success)' : 'var(--forge-error)' }}>
                WoW views: {data.trends.weekOverWeekViewChange > 0 ? '+' : ''}{data.trends.weekOverWeekViewChange.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dimension Scores */}
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Scoring Dimensions</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.values(dims).map(d => <DimensionBar key={d.label} dim={d} />)}
        </div>
      </div>

      {/* Top Performers */}
      {data.topPerformers?.length > 0 && (
        <div style={sCard}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Top Performing Assets</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--forge-surface-container-minimum)' }}>
                {['Asset', 'Type', 'Views/Mo', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>{data.topPerformers.map((a, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--forge-outline)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--forge-text-high)', maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</td>
                  <td style={{ padding: '8px 12px' }}><span className={`badge-${a.type}`} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3 }}>{(ASSET_TYPES[a.type] || {}).icon || '•'}</span></td>
                  <td style={{ padding: '8px 12px', ...mono, color: 'var(--forge-text-high)' }}>{formatNumber(a.viewsMonth)}</td>
                  <td style={{ padding: '8px 12px' }}><a href={a.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--forge-tertiary)' }}><ExternalIcon /></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stale Assets */}
      {data.staleAssets?.length > 0 && (
        <div style={sCard}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><AlertIcon /> Stale Assets (180+ days)</div>
          <p style={{ fontSize: '0.75rem', color: 'var(--forge-text-low)', marginBottom: 12 }}>These assets haven't been updated in over 6 months. Consider refreshing or archiving.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'var(--forge-surface-container-minimum)' }}>
                {['Asset', 'Type', 'Last Updated', 'Days Stale', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>{data.staleAssets.map((a, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--forge-outline)' }}>
                  <td style={{ padding: '8px 12px', maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--forge-text-high)' }}>{a.name}</td>
                  <td style={{ padding: '8px 12px' }}><span className={`badge-${a.type}`} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3 }}>{(ASSET_TYPES[a.type] || {}).icon || '•'}</span></td>
                  <td style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--forge-text-low)' }}>{a.lastUpdated !== "Unknown" ? new Date(a.lastUpdated).toLocaleDateString() : "Unknown"}</td>
                  <td style={{ padding: '8px 12px', ...mono, color: a.daysSinceUpdate > 365 ? 'var(--forge-error)' : 'var(--forge-text-medium)' }}>{a.daysSinceUpdate === 9999 ? '?' : a.daysSinceUpdate}</td>
                  <td style={{ padding: '8px 12px' }}><a href={a.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--forge-tertiary)' }}><ExternalIcon /></a></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <div style={{ ...sCard, borderLeft: '3px solid var(--forge-tertiary)' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 10 }}>Recommendations</div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.8 }}>
            {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── Use Case Classification View ─── */
function UseCaseView({ domain }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);

  useEffect(() => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    classifyUseCases(domain)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [domain]);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--forge-text-low)' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--forge-outline)', borderTopColor: 'var(--forge-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
      </div>
      <div style={{ fontSize: '0.8125rem' }}>Classifying use cases for {domain}...</div>
      <div style={{ fontSize: '0.6875rem', marginTop: 4 }}>Detecting signals, then using AI to synthesize patterns</div>
    </div>
  );

  if (error) return <div style={{ padding: 16, borderRadius: 'var(--forge-shape-medium)', background: 'rgba(176,0,32,0.08)', border: '1px solid rgba(176,0,32,0.3)', color: 'var(--forge-error)', fontSize: '0.8125rem' }}>{error}</div>;
  if (!data) return null;

  const cls = data.classification;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Mission Summary */}
      {cls && (
        <div style={{ ...sCard, borderLeft: '3px solid var(--forge-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Site Purpose</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ padding: '2px 10px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 600, background: 'var(--forge-primary)', color: '#fff', textTransform: 'capitalize' }}>{cls.primaryMission?.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>({cls.missionConfidence} confidence)</span>
            </div>
          </div>
          <p style={{ fontSize: '0.9375rem', color: 'var(--forge-text-high)', lineHeight: 1.6, margin: 0 }}>{cls.sitePurpose}</p>
          {cls.missionRationale && <p style={{ fontSize: '0.75rem', color: 'var(--forge-text-low)', marginTop: 6, lineHeight: 1.5 }}>{cls.missionRationale}</p>}
        </div>
      )}

      {/* General Use Cases */}
      {cls?.generalUseCases?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 10 }}>General Use Cases</div>
          <div className="space-y-2">
            {cls.generalUseCases.filter(uc => uc.strength !== 'minimal').map((uc, i) => (
              <div key={i} style={{ ...sCard, cursor: 'pointer', padding: 16 }} onClick={() => setExpandedItem(expandedItem === `g-${i}` ? null : `g-${i}`)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StrengthTag strength={uc.strength} />
                    <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{uc.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {uc.assetCount > 0 && <span style={{ ...mono, fontSize: '0.75rem', color: 'var(--forge-text-low)' }}>{uc.assetCount} assets</span>}
                    <span style={{ color: 'var(--forge-text-low)', transform: expandedItem === `g-${i}` ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}><ChevronRight /></span>
                  </div>
                </div>
                {expandedItem === `g-${i}` && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--forge-outline)' }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6, marginBottom: 8 }}>{uc.evidence}</p>
                    {uc.exampleAssets?.length > 0 && (
                      <div>
                        <div style={sLabel}>Example Assets</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {uc.exampleAssets.map((a, j) => <span key={j} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-medium)', border: '1px solid var(--forge-outline)' }}>{a}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specific / Policy Area Use Cases */}
      {cls?.specificUseCases?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 10 }}>Topic & Policy Area Use Cases</div>
          <div className="space-y-2">
            {cls.specificUseCases.filter(uc => uc.strength !== 'minimal').map((uc, i) => (
              <div key={i} style={{ ...sCard, cursor: 'pointer', padding: 16 }} onClick={() => setExpandedItem(expandedItem === `s-${i}` ? null : `s-${i}`)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StrengthTag strength={uc.strength} />
                    <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{uc.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {uc.viewsMonth > 0 && <span style={{ ...mono, fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{formatNumber(uc.viewsMonth)} views/mo</span>}
                    {uc.assetCount > 0 && <span style={{ ...mono, fontSize: '0.75rem', color: 'var(--forge-text-low)' }}>{uc.assetCount} assets</span>}
                    <span style={{ color: 'var(--forge-text-low)', transform: expandedItem === `s-${i}` ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}><ChevronRight /></span>
                  </div>
                </div>
                {expandedItem === `s-${i}` && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--forge-outline)' }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6, marginBottom: 8 }}>{uc.evidence}</p>
                    {uc.policyAreas?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={sLabel}>Policy Areas</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {uc.policyAreas.map((p, j) => <span key={j} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', background: 'var(--forge-primary-container-low)', color: 'var(--forge-on-primary-container)', border: '1px solid var(--forge-primary-container)', fontWeight: 500 }}>{p}</span>)}
                        </div>
                      </div>
                    )}
                    {uc.topAssets?.length > 0 && (
                      <div>
                        <div style={sLabel}>Top Assets</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {uc.topAssets.map((a, j) => <span key={j} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-medium)', border: '1px solid var(--forge-outline)' }}>{a}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Narrative Themes (from Stories) */}
      {cls?.narrativeThemes?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 10 }}>Narrative Themes</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cls.narrativeThemes.map((t, i) => (
              <div key={i} style={sCard}>
                <div style={{ fontWeight: 500, fontSize: '0.9375rem', marginBottom: 4 }}>{t.theme}</div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.5, marginBottom: 8 }}>{t.description}</p>
                {t.supportingStories?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {t.supportingStories.map((s, j) => <span key={j} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-medium)', border: '1px solid var(--forge-outline)' }}>{s}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Concentration */}
      {cls?.dataConcentration && (
        <div style={sCard}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Data Concentration</div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6, marginBottom: 10 }}>{cls.dataConcentration.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cls.dataConcentration.dominantAreas?.length > 0 && (
              <div>
                <div style={{ ...sLabel, color: 'var(--forge-success)' }}>Dominant Areas ({cls.dataConcentration.dominantAreaPct || '?'}%)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {cls.dataConcentration.dominantAreas.map((a, i) => <span key={i} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', background: '#e8f5e9', color: '#2e7d32', fontWeight: 500 }}>{a}</span>)}
                </div>
              </div>
            )}
            {cls.dataConcentration.gaps?.length > 0 && (
              <div>
                <div style={{ ...sLabel, color: 'var(--forge-error)' }}>Identified Gaps</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {cls.dataConcentration.gaps.map((g, i) => <span key={i} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', background: '#fce4ec', color: '#b71c1c', fontWeight: 500 }}>{g}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maturity Assessment */}
      {cls?.maturityAssessment && (
        <div style={{ ...sCard, borderLeft: `3px solid ${{ advanced: '#2e7d32', intermediate: '#f57f17', basic: '#e65100', nascent: '#b71c1c' }[cls.maturityAssessment.level] || '#757575'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Portal Maturity:</span>
            <span style={{ padding: '2px 10px', fontSize: '0.75rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 600, textTransform: 'capitalize',
              background: { advanced: '#e8f5e9', intermediate: '#fff8e1', basic: '#fff3e0', nascent: '#fce4ec' }[cls.maturityAssessment.level] || '#f5f5f5',
              color: { advanced: '#2e7d32', intermediate: '#f57f17', basic: '#e65100', nascent: '#b71c1c' }[cls.maturityAssessment.level] || '#757575'
            }}>{cls.maturityAssessment.level}</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6, marginBottom: 8 }}>{cls.maturityAssessment.rationale}</p>
          {cls.maturityAssessment.indicators?.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--forge-text-medium)', lineHeight: 1.8 }}>
              {cls.maturityAssessment.indicators.map((ind, i) => <li key={i}>{ind}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Rule-based Signals (fallback / supplemental) */}
      {data.signals?.length > 0 && !cls && (
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 10 }}>Detected Signals (Rule-Based)</div>
          <div className="space-y-2">
            {data.signals.map((s, i) => (
              <div key={i} style={{ ...sCard, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '2px 6px', fontSize: '0.6rem', borderRadius: 3, background: s.category === 'general' ? '#e8eaf6' : '#e3f2fd', color: s.category === 'general' ? '#3f51b5' : '#1565c0', fontWeight: 600, textTransform: 'uppercase' }}>{s.category}</span>
                  <span style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{s.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: 'var(--forge-text-low)' }}>
                  <span>{s.matchCount} matches</span>
                  <span>{formatNumber(s.totalViews)} views</span>
                  <span style={{ color: s.confidence === 'high' ? '#2e7d32' : s.confidence === 'medium' ? '#f57f17' : '#757575' }}>{s.confidence}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.rawAnalysis && !cls && (
        <div style={sCard}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Raw Analysis</div>
          <pre style={{ fontSize: '0.75rem', ...mono, color: 'var(--forge-text-medium)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{data.rawAnalysis}</pre>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RESULTS VIEW
   ═══════════════════════════════════════════════════════════════════ */
function ResultsView({ data, onBack }) {
  const { domain, analytics, profile, assets, rawAnalysis } = data;
  const [tab, setTab] = useState('overview');
  const [expandedUC, setExpandedUC] = useState(null);

  const exportText = () => {
    if (!profile) return rawAnalysis || 'No analysis available';
    let t = `SITE INTELLIGENCE: ${domain}\nGenerated: ${new Date().toLocaleDateString()}\n${'='.repeat(50)}\n\n`;
    t += `${profile.summary}\n\nGrade: ${profile.platformHealth?.overallScore || 'N/A'}\n\n`;
    t += `USE CASES:\n`;
    for (const uc of profile.primaryUseCases || []) t += `  [${uc.strength}] ${uc.name}: ${uc.description}\n`;
    t += `\nDEPARTMENTS:\n`;
    for (const d of profile.departmentsServed || []) t += `  ${d.name} (${d.engagement}): ${(d.dataAreas || []).join(', ')}\n`;
    t += `\nEXPANSION:\n`;
    for (const o of profile.expansionOpportunities || []) t += `  ${o.opportunity}: ${o.rationale}\n`;
    t += `\nACTIONS:\n`;
    for (const a of profile.recommendedActions || []) t += `  [${a.priority}] ${a.action}\n`;
    t += `\nRISKS: ${(profile.platformHealth?.risks || []).join('; ')}\n`;
    t += `STRENGTHS: ${(profile.platformHealth?.strengths || []).join('; ')}\n`;
    return t;
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'reportcard', label: 'Report Card' },
    { id: 'usecaseclassifier', label: 'Use Cases' },
    { id: 'usecases', label: 'AI Use Cases' },
    { id: 'departments', label: 'Departments' },
    { id: 'assets', label: 'Top Assets' },
    { id: 'actions', label: 'Actions' },
  ];

  return (
    <div className="animate-fade-up">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ padding: '6px 12px', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', background: 'transparent', color: 'var(--forge-text-medium)', cursor: 'pointer', fontSize: '0.8125rem' }}>← Back</button>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>{domain}</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--forge-text-low)', margin: 0 }}>{analytics?.totalAssets?.toLocaleString()} total assets · {analytics?.assetsFetched} indexed</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {profile?.platformHealth?.overallScore && <ScoreBadge score={profile.platformHealth.overallScore} />}
          <CopyButton getText={exportText} />
        </div>
      </div>

      {profile?.summary && <div style={{ ...sCard, marginBottom: 16, borderLeft: '3px solid var(--forge-primary)' }}>
        <p style={{ fontSize: '0.9375rem', color: 'var(--forge-text-high)', lineHeight: 1.6, margin: 0 }}>{profile.summary}</p>
      </div>}

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--forge-outline)', marginBottom: 20 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)}
          style={{ padding: '10px 20px', fontSize: '0.8125rem', fontWeight: tab === t.id ? 500 : 400, color: tab === t.id ? 'var(--forge-tertiary)' : 'var(--forge-text-medium)', background: 'transparent', border: 'none', borderBottom: tab === t.id ? '2px solid var(--forge-tertiary)' : '2px solid transparent', cursor: 'pointer', transition: 'all 200ms' }}>{t.label}</button>)}
      </div>

      {tab === 'overview' && <div className="space-y-5 animate-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{ v: analytics?.totalAssets?.toLocaleString(), l: 'Total Assets' }, { v: formatNumber(analytics?.engagement?.monthlyViews), l: 'Monthly Views' }, { v: formatNumber(analytics?.engagement?.downloads), l: 'Downloads' }, { v: profile?.keyMetrics?.engagementTier || 'N/A', l: 'Tier' }].map(m =>
            <div key={m.l} style={{ ...sCard, textAlign: 'center' }}><div style={{ fontSize: '1.5rem', fontWeight: 500, ...mono, color: 'var(--forge-text-high)' }}>{m.v}</div><div style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.l}</div></div>)}
        </div>
        <div style={sCard}><div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Data Freshness</div><FreshnessBar freshness={analytics?.freshness} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div style={sCard}><div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Asset Types</div>
            <div className="space-y-2">{Object.entries(analytics?.assetTypes || {}).sort((a,b) => b[1] - a[1]).map(([type, count]) => {
              const cfg = ASSET_TYPES[type] || { icon: '•', label: type };
              return <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem' }}>
                <span style={{ width: 60, color: 'var(--forge-text-medium)' }}>{cfg.icon} {(cfg.label || type).replace(/s$/, '')}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--forge-surface-container-minimum)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${((count / (analytics?.assetsFetched || 1)) * 100).toFixed(0)}%`, height: '100%', background: 'var(--forge-primary)', borderRadius: 3 }} /></div>
                <span style={{ ...mono, fontSize: '0.75rem', color: 'var(--forge-text-high)', width: 36, textAlign: 'right' }}>{count}</span>
              </div>; })}</div>
          </div>
          <div style={sCard}><div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Top Categories</div>
            <div className="space-y-1">{(analytics?.categories || []).slice(0, 10).map(([cat, count]) => <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: '4px 0', borderBottom: '1px solid var(--forge-outline)' }}><span style={{ color: 'var(--forge-text-high)' }}>{cat}</span><span style={{ ...mono, color: 'var(--forge-text-low)' }}>{count}</span></div>)}</div>
          </div>
        </div>
        {profile?.platformHealth && <div style={sCard}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Health Assessment</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profile.platformHealth.strengths?.length > 0 && <div><div style={{ ...sLabel, color: 'var(--forge-success)' }}>Strengths</div><ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.8 }}>{profile.platformHealth.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
            {profile.platformHealth.risks?.length > 0 && <div><div style={{ ...sLabel, color: 'var(--forge-error)' }}>Risk Signals</div><ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.8 }}>{profile.platformHealth.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
          </div>
        </div>}
      </div>}

      {tab === 'reportcard' && <ReportCardView domain={domain} />}

      {tab === 'usecaseclassifier' && <UseCaseView domain={domain} />}

      {tab === 'usecases' && <div className="space-y-3 animate-fade-in">
        {(profile?.primaryUseCases || []).map((uc, i) => (
          <div key={i} style={{ ...sCard, cursor: 'pointer' }} onClick={() => setExpandedUC(expandedUC === i ? null : i)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><StrengthBadge level={uc.strength} /><span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{uc.name}</span></div>
              <span style={{ color: 'var(--forge-text-low)', transform: expandedUC === i ? 'rotate(90deg)' : 'none', transition: 'transform 200ms' }}><ChevronRight /></span>
            </div>
            {expandedUC === i && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--forge-outline)' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6, marginBottom: 8 }}>{uc.description}</p>
              {uc.assets?.length > 0 && <div><div style={sLabel}>Supporting Assets</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{uc.assets.map((a, j) => <span key={j} style={{ padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-medium)', border: '1px solid var(--forge-outline)' }}>{a}</span>)}</div></div>}
            </div>}
          </div>))}
      </div>}

      {tab === 'departments' && <div className="space-y-3 animate-fade-in">
        {(profile?.departmentsServed || []).map((dept, i) => <div key={i} style={sCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{dept.name}</span><EngagementDot level={dept.engagement} /></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{(dept.dataAreas || []).map((a, j) => <span key={j} style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 500, background: 'var(--forge-primary-container-low)', color: 'var(--forge-on-primary-container)', border: '1px solid var(--forge-primary-container)' }}>{a}</span>)}</div>
        </div>)}
      </div>}

      {tab === 'assets' && <div className="animate-fade-in" style={{ ...sCard, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: 'var(--forge-surface-container-minimum)' }}>
              {['Asset', 'Views/Mo', 'Downloads', 'Schema', 'Updated', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: 'var(--forge-text-low)', fontWeight: 500, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>)}
            </tr></thead>
            <tbody>{(assets || []).map((a, i) => <AssetRow key={i} asset={a} />)}</tbody>
          </table>
        </div>
      </div>}

      {tab === 'actions' && <div className="space-y-5 animate-fade-in">
        {profile?.expansionOpportunities?.length > 0 && <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><TrendUpIcon /> Expansion Opportunities</div>
          <div className="space-y-3">{profile.expansionOpportunities.map((opp, i) => <div key={i} style={sCard}>
            <div style={{ fontWeight: 500, fontSize: '0.9375rem', marginBottom: 4 }}>{opp.opportunity}</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.5, marginBottom: 8 }}>{opp.rationale}</p>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(opp.products || []).map((p, j) => <span key={j} style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.6875rem', borderRadius: 'var(--forge-shape-full)', fontWeight: 500, background: 'var(--forge-tertiary-container-low)', color: 'var(--forge-on-tertiary-container)', border: '1px solid var(--forge-tertiary)33' }}>{p}</span>)}</div>
          </div>)}</div>
        </div>}
        {profile?.recommendedActions?.length > 0 && <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><AlertIcon /> Recommended Actions</div>
          <div className="space-y-2">{profile.recommendedActions.map((a, i) => <div key={i} style={{ ...sCard, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <PriorityBadge priority={a.priority} />
            <div><div style={{ fontWeight: 500, fontSize: '0.8125rem', marginBottom: 2 }}>{a.action}</div><div style={{ fontSize: '0.75rem', color: 'var(--forge-text-medium)', lineHeight: 1.5 }}>{a.rationale}</div></div>
          </div>)}</div>
        </div>}
        {profile?.keyMetrics && <div style={sCard}>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 12 }}>Key Metrics</div>
          <div className="grid grid-cols-2 gap-4">{Object.entries(profile.keyMetrics).map(([k, v]) => <div key={k}><div style={sLabel}>{k.replace(/([A-Z])/g, ' $1').trim()}</div><div style={{ fontSize: '0.875rem', color: 'var(--forge-text-high)' }}>{String(v)}</div></div>)}</div>
        </div>}
      </div>}

      {rawAnalysis && !profile && <div style={{ ...sCard, marginTop: 20 }}><div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}>Raw Analysis</div><pre style={{ fontSize: '0.75rem', ...mono, color: 'var(--forge-text-medium)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{rawAnalysis}</pre></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function SiteIntelligence({ initialDomain }) {
  const [domain, setDomain] = useState(initialDomain || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(null);
  const [savedSites, setSavedSites] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ode-saved-sites') || '[]'); } catch { return []; }
  });
  const inputRef = useRef(null);
  const [autoIndexed, setAutoIndexed] = useState(false);
  useEffect(() => { if (!initialDomain) inputRef.current?.focus(); }, []);

  // Auto-index if initialDomain is provided
  useEffect(() => {
    if (initialDomain && !autoIndexed) {
      setAutoIndexed(true);
      setDomain(initialDomain);
      doIndex(initialDomain);
    }
  }, [initialDomain]);

  const saveSites = (sites) => { setSavedSites(sites); localStorage.setItem('ode-saved-sites', JSON.stringify(sites)); };

  const doIndex = async (domainToIndex) => {
    const d = domainToIndex.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!d) return;
    setError(null); setLoading(true); setStep("crawl");
    try {
      setStep("analyze");
      const resp = await fetch("/api/site-intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      setStep("ai");
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `HTTP ${resp.status}`); }
      const data = await resp.json();
      setResult(data);
      const updated = [{ ...data, indexedAt: new Date().toISOString() }, ...savedSites.filter(s => s.domain !== d)].slice(0, 20);
      saveSites(updated);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setStep(null); }
  };

  const handleIndex = async (e) => {
    e?.preventDefault();
    doIndex(domain);
  };

  if (result && !loading) {
    return <div style={{ padding: '24px 16px', maxWidth: 1120, margin: '0 auto' }}><ResultsView data={result} onBack={() => setResult(null)} /></div>;
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 800, margin: '0 auto' }}>
      <div className="animate-fade-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}><ScanIcon /><h2 style={{ fontSize: '1.25rem', fontWeight: 500, margin: 0 }}>Site Intelligence</h2></div>
        <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', marginBottom: 24 }}>Enter a Socrata domain to generate an AI-powered site profile with use cases, health assessment, department coverage, and expansion opportunities.</p>

        <form onSubmit={handleIndex} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input ref={inputRef} type="text" value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. data.cityofnewyork.us"
                className="forge-input" style={{ width: '100%', paddingLeft: 36 }} />
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--forge-text-low)' }}><SearchIcon /></span>
            </div>
            <button type="submit" disabled={!domain.trim() || loading}
              style={{ padding: '8px 24px', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', opacity: (!domain.trim() || loading) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
              {loading ? 'Indexing...' : 'Index Site'}
            </button>
          </div>
        </form>

        {loading && <div style={{ ...sCard, padding: 40 }}><AnalysisProgress step={step} /></div>}
        {error && <div style={{ padding: 16, borderRadius: 'var(--forge-shape-medium)', background: 'rgba(176,0,32,0.08)', border: '1px solid rgba(176,0,32,0.3)', color: 'var(--forge-error)', fontSize: '0.8125rem', marginBottom: 16 }}>{error}</div>}

        {savedSites.length > 0 && !loading && <div>
          <div style={sLabel}>Previously Indexed Sites</div>
          <div className="space-y-2" style={{ marginTop: 8 }}>{savedSites.map(site => (
            <div key={site.domain} style={{ ...sCard, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setResult(site)}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{site.domain}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)' }}>{site.analytics?.totalAssets?.toLocaleString()} assets · {new Date(site.indexedAt).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {site.profile?.platformHealth?.overallScore && <ScoreBadge score={site.profile.platformHealth.overallScore} />}
                <button onClick={e => { e.stopPropagation(); saveSites(savedSites.filter(s => s.domain !== site.domain)); }}
                  style={{ padding: '4px 8px', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', background: 'transparent', color: 'var(--forge-text-low)', cursor: 'pointer', fontSize: '0.75rem' }}>×</button>
              </div>
            </div>))}</div>
        </div>}

        {savedSites.length === 0 && !loading && <div>
          <div style={sLabel}>Try These</div>
          <div className="flex flex-wrap gap-2" style={{ marginTop: 8 }}>
            {['data.cityofnewyork.us', 'data.seattle.gov', 'data.sfgov.org', 'data.austintexas.gov', 'data.cityofchicago.org', 'data.lacity.org', 'data.illinois.gov', 'data.wa.gov'].map(d => (
              <button key={d} onClick={() => setDomain(d)}
                style={{ padding: '6px 12px', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', background: 'transparent', color: 'var(--forge-text-medium)', cursor: 'pointer', fontSize: '0.8125rem', ...mono }}>{d}</button>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
