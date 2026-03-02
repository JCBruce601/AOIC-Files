import { useState, useEffect, useRef, useCallback } from "react";
import { useDiscovery } from "./hooks/useDiscovery.js";
import { formatNumber, timeAgo, askAssistant, fetchMetadata, ASSET_TYPES, RANK_OPTIONS, SUGGESTED_SEARCHES } from "./utils/api.js";
import SiteIntelligence from "./components/SiteIntelligence.jsx";
import SiteDirectory from "./components/SiteDirectory.jsx";
import LoginScreen from "./components/LoginScreen.jsx";

/* ─── SVG Icons ─── */
const Icon = ({ d, size = 18, sw = 2 }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>);
const SearchIcon = () => <Icon d="M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M21 21l-4.35-4.35" />;
const ExternalIcon = () => <Icon d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={14} sw={1.5} />;
const CloseIcon = () => <Icon d="M18 6L6 18M6 6l12 12" size={20} />;
const ChevronDown = () => <Icon d="M6 9l6 6 6-6" size={14} />;
const EyeIcon = () => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" size={14} sw={1.5} />;
const DownloadIcon = () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" size={14} sw={1.5} />;
const ColumnsIcon = () => <Icon d="M3 3h18v18H3zM12 3v18" size={14} sw={1.5} />;
const SendIcon = () => <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7" />;
const SunIcon = () => <Icon d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" size={16} sw={1.5} />;
const MoonIcon = () => <Icon d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" size={16} sw={1.5} />;
const SparkleIcon = () => <Icon d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" size={16} sw={1.5} />;
const DatabaseIcon = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>);

/* ─── Theme Toggle ─── */
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('ode-theme', next ? 'dark' : 'light');
  };
  return (
    <button onClick={toggle} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ background: 'var(--forge-surface-container-minimum)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-full)', padding: '6px 10px', cursor: 'pointer', color: 'var(--forge-text-high)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontFamily: 'var(--forge-font-family)', fontWeight: 500, transition: 'all 200ms' }}>
      {dark ? <SunIcon /> : <MoonIcon />}
      {dark ? 'Light' : 'Dark'}
    </button>
  );
}

/* ─── Type Badge ─── */
function TypeBadge({ type }) {
  const cfg = ASSET_TYPES[type] || { label: type, icon: "•" };
  return <span className={`badge-${type} inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium`} style={{ fontFamily: 'var(--forge-font-family)' }}><span style={{ fontSize: 10 }}>{cfg.icon}</span>{cfg.label.replace(/s$/, "")}</span>;
}

/* ─── Stat Pill ─── */
function StatPill({ icon, value, label }) {
  return <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--forge-text-medium)' }} title={label}>{icon}<span style={{ fontFamily: "'Roboto Mono', monospace", color: 'var(--forge-text-high)' }}>{value}</span></span>;
}

/* ─── Result Card ─── */
function ResultCard({ item, onSelect }) {
  const r = item.resource, meta = item.metadata, cls = item.classification;
  return (
    <div onClick={() => onSelect(item)} style={{ background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', padding: 16, cursor: 'pointer', boxShadow: 'var(--forge-elevation-1)', transition: 'all 200ms' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--forge-elevation-4)'; e.currentTarget.style.borderColor = 'var(--forge-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--forge-elevation-1)'; e.currentTarget.style.borderColor = 'var(--forge-outline)'; }}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={r.type} />
          {cls?.domain_category && <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--forge-text-low)' }}>{cls.domain_category}</span>}
        </div>
        <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
          style={{ padding: 4, borderRadius: 'var(--forge-shape-medium)', color: 'var(--forge-text-low)', transition: 'color 200ms' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--forge-tertiary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--forge-text-low)'}>
          <ExternalIcon />
        </a>
      </div>
      <h3 style={{ fontFamily: 'var(--forge-font-family)', fontSize: '0.9375rem', fontWeight: 500, lineHeight: 1.3, marginBottom: 4, color: 'var(--forge-text-high)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.name}</h3>
      <p style={{ fontSize: '0.75rem', fontFamily: "'Roboto Mono', monospace", color: 'var(--forge-tertiary)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta?.domain}</p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.5, marginBottom: 12, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{r.description || "No description available."}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {r.page_views?.page_views_last_month != null && <StatPill icon={<EyeIcon />} value={formatNumber(r.page_views.page_views_last_month)} label="Views this month" />}
        {r.download_count > 0 && <StatPill icon={<DownloadIcon />} value={formatNumber(r.download_count)} label="Downloads" />}
        {r.columns_name?.length > 0 && r.type === "dataset" && <StatPill icon={<ColumnsIcon />} value={r.columns_name.length} label="Columns" />}
        <span style={{ fontSize: 10, color: 'var(--forge-text-low)', marginLeft: 'auto' }}>Updated {timeAgo(r.updatedAt)}</span>
      </div>
    </div>
  );
}

/* ─── Detail Panel ─── */
function DetailPanel({ item, onClose }) {
  const [metaData, setMetaData] = useState(null);
  const r = item.resource, meta = item.metadata, cls = item.classification;
  useEffect(() => {
    if (r.type === "dataset" && meta?.domain && r.id) fetchMetadata(meta.domain, r.id).then(setMetaData).catch(() => {});
  }, [r.id, r.type, meta?.domain]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div className="relative w-full max-w-2xl overflow-y-auto" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--forge-surface)', borderLeft: '1px solid var(--forge-outline)', boxShadow: 'var(--forge-elevation-8)', animation: 'slideIn 300ms cubic-bezier(0,0,0,1)' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        {/* Header */}
        <div className="sticky top-0 z-10 p-5" style={{ background: 'var(--forge-surface)', borderBottom: '1px solid var(--forge-outline)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-2"><TypeBadge type={r.type} />{cls?.domain_category && <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--forge-text-low)' }}>{cls.domain_category}</span>}</div>
              <h2 style={{ fontFamily: 'var(--forge-font-family)', fontSize: '1.25rem', fontWeight: 500, lineHeight: 1.3 }}>{r.name}</h2>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1" style={{ fontSize: '0.75rem', fontFamily: "'Roboto Mono', monospace", color: 'var(--forge-tertiary)' }}>{meta?.domain} <ExternalIcon /></a>
            </div>
            <button onClick={onClose} style={{ padding: 6, borderRadius: 'var(--forge-shape-large)', color: 'var(--forge-text-medium)', background: 'none', border: 'none', cursor: 'pointer' }}><CloseIcon /></button>
          </div>
        </div>
        {/* Body */}
        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[{ l: "Views (Month)", v: formatNumber(r.page_views?.page_views_last_month) }, { l: "Views (Week)", v: formatNumber(r.page_views?.page_views_last_week) }, { l: "Views (Total)", v: formatNumber(r.page_views?.page_views_total) }, { l: "Downloads", v: formatNumber(r.download_count) }].map(s => (
              <div key={s.l} style={{ background: 'var(--forge-surface-container-minimum)', borderRadius: 'var(--forge-shape-medium)', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: '1.125rem', fontFamily: "'Roboto Mono', monospace", fontWeight: 500, color: 'var(--forge-text-high)' }}>{s.v}</div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--forge-text-low)', marginTop: 2 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div>
            <h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 8, fontWeight: 500 }}>Description</h4>
            <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{r.description || "No description available."}</p>
          </div>
          {r.attribution && <div><h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 4, fontWeight: 500 }}>Attribution</h4><p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-high)' }}>{r.attribution}</p></div>}
          {cls?.domain_tags?.length > 0 && <div><h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 8, fontWeight: 500 }}>Tags</h4><div className="flex flex-wrap gap-1.5">{cls.domain_tags.map(t => <span key={t} style={{ padding: '2px 8px', fontSize: '0.75rem', borderRadius: 'var(--forge-shape-full)', background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-medium)', border: '1px solid var(--forge-outline)' }}>{t}</span>)}</div></div>}
          {r.columns_name?.length > 0 && <div>
            <h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 8, fontWeight: 500 }}>Schema ({r.columns_name.length} columns)</h4>
            <div style={{ background: 'var(--forge-surface-container-minimum)', borderRadius: 'var(--forge-shape-medium)', border: '1px solid var(--forge-outline)', overflow: 'hidden' }}>
              <div style={{ maxHeight: 256, overflowY: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: 'var(--forge-surface-container-low)', position: 'sticky', top: 0 }}><th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--forge-text-low)', fontWeight: 500 }}>Column</th><th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--forge-text-low)', fontWeight: 500 }}>Type</th></tr></thead>
                  <tbody>{r.columns_name.map((col, i) => <tr key={i} style={{ borderTop: '1px solid var(--forge-outline)' }}><td style={{ padding: '6px 12px', fontFamily: "'Roboto Mono', monospace", color: 'var(--forge-text-high)' }}>{col}</td><td style={{ padding: '6px 12px', color: 'var(--forge-text-medium)' }}>{r.columns_datatype?.[i] || "Unknown"}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>}
          {metaData?.sample?.length > 0 && <div>
            <h4 style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 8, fontWeight: 500 }}>Sample Data (5 rows)</h4>
            <pre style={{ fontSize: 10, fontFamily: "'Roboto Mono', monospace", color: 'var(--forge-text-medium)', padding: 12, background: 'var(--forge-surface-container-minimum)', borderRadius: 'var(--forge-shape-medium)', border: '1px solid var(--forge-outline)', maxHeight: 192, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(metaData.sample, null, 2)}</pre>
          </div>}
          <div className="grid grid-cols-2 gap-3" style={{ fontSize: '0.75rem' }}>
            <div><span style={{ color: 'var(--forge-text-low)' }}>Created: </span><span style={{ color: 'var(--forge-text-medium)' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "N/A"}</span></div>
            <div><span style={{ color: 'var(--forge-text-low)' }}>Updated: </span><span style={{ color: 'var(--forge-text-medium)' }}>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "N/A"}</span></div>
          </div>
          <a href={item.link} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', width: '100%', textAlign: 'center', padding: '10px 24px', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)', fontWeight: 500, fontSize: '0.875rem', textDecoration: 'none', letterSpacing: '0.03em', transition: 'filter 200ms' }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
            View on Portal →
          </a>
        </div>
      </div>
    </div>
  );
}

/* ─── AI Assistant ─── */
function AiAssistant({ results, isOpen, onToggle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim(); setInput(""); setMessages(m => [...m, { role: "user", text: q }]); setLoading(true);
    try { const { reply } = await askAssistant(q, results); setMessages(m => [...m, { role: "assistant", text: reply }]); }
    catch (err) { setMessages(m => [...m, { role: "assistant", text: `Error: ${err.message}` }]); }
    finally { setLoading(false); }
  };
  if (!isOpen) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 animate-fade-up" style={{ width: 400, maxWidth: 'calc(100vw - 2rem)', maxHeight: 'min(600px, calc(100vh - 6rem))', background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-extra-large)', boxShadow: 'var(--forge-elevation-8)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--forge-outline)', background: 'var(--forge-surface-container-minimum)' }}>
        <div className="flex items-center gap-2"><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--forge-success)', animation: 'pulse 2s infinite' }} /><span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Data Discovery Assistant</span></div>
        <button onClick={onToggle} style={{ padding: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forge-text-medium)' }}><CloseIcon /></button>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200 }}>
        {messages.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--forge-text-low)', fontSize: '0.8125rem' }}><p style={{ marginBottom: 8 }}>Ask me about open data use cases.</p><p style={{ fontSize: '0.75rem' }}>"Who publishes police data?" or "How do cities share budget info?"</p></div>}
        {messages.map((m, i) => <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}><div style={{ maxWidth: '85%', borderRadius: 'var(--forge-shape-large)', padding: '8px 12px', fontSize: '0.8125rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', ...(m.role === 'user' ? { background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)' } : { background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-high)', border: '1px solid var(--forge-outline)' }) }}>{m.text}</div></div>)}
        {loading && <div style={{ display: 'flex' }}><div style={{ background: 'var(--forge-surface-container-minimum)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-large)', padding: '10px 16px', display: 'flex', gap: 4 }}>{[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--forge-text-low)', animation: `bounce 1s ${i*150}ms infinite` }} />)}</div></div>}
        <style>{`@keyframes bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }`}</style>
        <div ref={endRef} />
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--forge-outline)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about open data..."
            className="forge-input" style={{ flex: 1, fontSize: '0.8125rem' }} />
          <button onClick={send} disabled={!input.trim() || loading}
            style={{ padding: '8px 12px', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)', border: 'none', cursor: 'pointer', opacity: (!input.trim() || loading) ? 0.38 : 1, transition: 'opacity 200ms' }}>
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Loading Skeleton ─── */
function ResultSkeleton() {
  return <div style={{ background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', padding: 16 }} className="space-y-3"><div className="flex gap-2"><div className="skeleton h-5 w-16" /><div className="skeleton h-5 w-20" /></div><div className="skeleton h-5 w-3/4" /><div className="skeleton h-3 w-32" /><div className="skeleton h-8 w-full" /><div className="flex gap-3"><div className="skeleton h-3 w-16" /><div className="skeleton h-3 w-16" /></div></div>;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  const { results, totalResults, loading, error, hasSearched, search, reset } = useDiscovery();
  const [query, setQuery] = useState("");
  const [assetType, setAssetType] = useState("");
  const [rankBy, setRankBy] = useState("page_views_last_month");
  const [limit, setLimit] = useState(25);
  const [domainFilter, setDomainFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [mode, setMode] = useState("explore"); // "explore" | "internal"
  const [activeView, setActiveView] = useState("explorer");
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("ode-auth-token");
    const email = localStorage.getItem("ode-auth-email");
    const name = localStorage.getItem("ode-auth-name");
    return token ? { token, email, name } : null;
  });
  const [intelDomain, setIntelDomain] = useState(null); // drillthrough from directory

  const handleLogout = () => {
    localStorage.removeItem("ode-auth-token");
    localStorage.removeItem("ode-auth-email");
    localStorage.removeItem("ode-auth-name");
    setAuth(null);
    setActiveView("explorer");
  };

  const handleTabChange = (tab) => {
    if ((tab === "directory" || tab === "indexer") && !auth) {
      setActiveView(tab); // Will show login
      return;
    }
    setActiveView(tab);
    if (tab !== "indexer") setIntelDomain(null);
  };

  const handleDrillToIntel = (domain) => {
    setIntelDomain(domain);
    setActiveView("indexer");
  };

  const executeSearch = useCallback((overrides = {}) => {
    const params = { q: overrides.q ?? query, only: overrides.only ?? (assetType || undefined), order: rankBy, limit, search_context: domainFilter || undefined, ...overrides };
    Object.keys(params).forEach(k => { if (params[k] === undefined || params[k] === "") delete params[k]; });
    search(params);
  }, [query, assetType, rankBy, limit, domainFilter, search]);

  const handleSubmit = e => { e.preventDefault(); executeSearch(); };
  const handleSuggestedSearch = term => { setQuery(term); executeSearch({ q: term }); };
  const handleTypeFilter = type => { const t = type === assetType ? "" : type; setAssetType(t); if (hasSearched) executeSearch({ only: t || undefined }); };

  const domainCounts = {};
  results.forEach(r => { const d = r.metadata?.domain; if (d) domainCounts[d] = (domainCounts[d] || 0) + 1; });
  const topDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── App Bar ── */}
      <header style={{ background: 'var(--forge-brand)', color: 'var(--forge-on-brand)', position: 'relative', zIndex: 20, boxShadow: 'var(--forge-elevation-4)' }}>
        <div style={{ padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="flex items-center gap-3">
            <DatabaseIcon />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.2 }}>Open Data Explorer</div>
              <div style={{ fontSize: '0.625rem', opacity: 0.7, letterSpacing: '0.03em' }}>Tyler Data & Insights</div>
            </div>
          </div>
          <ThemeToggle />
          {auth && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
            <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>{auth.name || auth.email?.split('@')[0]}</span>
            <button onClick={handleLogout} style={{ padding: '2px 8px', fontSize: '0.6125rem', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--forge-shape-full)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>Sign Out</button>
          </div>}
        </div>
        <nav style={{ display: 'flex', gap: 0, padding: '0 16px' }}>
          {[
            { id: "explorer", label: "Discovery", requiresAuth: false },
            { id: "directory", label: "Site Directory", requiresAuth: true },
            { id: "indexer", label: "Site Intelligence", requiresAuth: true },
          ].map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: activeView === tab.id ? 500 : 400, color: activeView === tab.id ? '#fff' : 'rgba(255,255,255,0.7)', background: 'none', border: 'none', borderBottom: activeView === tab.id ? '2px solid var(--forge-secondary)' : '2px solid transparent', cursor: 'pointer', fontFamily: 'var(--forge-font-family)', transition: 'all 200ms', display: 'flex', alignItems: 'center', gap: 4 }}>
              {tab.label}
              {tab.requiresAuth && !auth && <span style={{ fontSize: '0.5rem', padding: '1px 4px', borderRadius: 'var(--forge-shape-full)', background: 'rgba(255,255,255,0.15)', verticalAlign: 'middle' }}>🔒</span>}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Views ── */}
      {(activeView === "directory" || activeView === "indexer") && !auth ? (
        <LoginScreen onAuth={(a) => { setAuth(a); }} />
      ) : activeView === "directory" ? (
        <SiteDirectory onSelectDomain={handleDrillToIntel} />
      ) : activeView === "indexer" ? (
        <SiteIntelligence initialDomain={intelDomain} />
      ) : (
      <>
      {/* ── Search Section ── */}
      <div style={{ padding: '24px 16px 16px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
        <form onSubmit={handleSubmit} style={{ marginBottom: 12 }}>
          <div className="search-glow" style={{ display: 'flex', alignItems: 'center', background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-medium)', overflow: 'hidden', boxShadow: 'var(--forge-elevation-1)', transition: 'all 200ms' }}>
            <div style={{ paddingLeft: 16, color: 'var(--forge-text-low)' }}><SearchIcon /></div>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search datasets, stories, maps, measures, charts..."
              style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px', fontSize: '0.875rem', color: 'var(--forge-text-high)', fontFamily: 'var(--forge-font-family)', outline: 'none' }} />
            <button type="submit" style={{ margin: 4, padding: '8px 24px', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--forge-font-family)', transition: 'filter 200ms' }}>Explore</button>
          </div>
        </form>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(ASSET_TYPES).filter(([k]) => !["href", "calendar"].includes(k)).map(([key, cfg]) => (
            <button key={key} onClick={() => handleTypeFilter(key)}
              style={{ padding: '4px 12px', borderRadius: 'var(--forge-shape-full)', fontSize: '0.8125rem', fontWeight: assetType === key ? 500 : 400, border: `1px solid ${assetType === key ? 'var(--forge-tertiary)' : 'var(--forge-outline)'}`, background: assetType === key ? 'var(--forge-tertiary)' : 'transparent', color: assetType === key ? 'var(--forge-on-tertiary)' : 'var(--forge-text-medium)', cursor: 'pointer', fontFamily: 'var(--forge-font-family)', transition: 'all 200ms' }}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: 'var(--forge-outline)', margin: '0 4px' }} className="hidden sm:block" />
          <div className="relative">
            <select value={rankBy} onChange={e => { setRankBy(e.target.value); if (hasSearched) executeSearch({ order: e.target.value }); }} className="forge-select">{RANK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--forge-text-low)' }}><ChevronDown /></span>
          </div>
          <div className="relative">
            <select value={limit} onChange={e => { setLimit(Number(e.target.value)); if (hasSearched) executeSearch({ limit: Number(e.target.value) }); }} className="forge-select">{[10,25,50,75,100].map(n => <option key={n} value={n}>{n} results</option>)}</select>
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--forge-text-low)' }}><ChevronDown /></span>
          </div>
          <input type="text" value={domainFilter} onChange={e => setDomainFilter(e.target.value)} placeholder="Filter by domain..." className="forge-input" style={{ width: 144, fontSize: '0.8125rem', padding: '6px 12px' }}
            onBlur={() => { if (hasSearched) executeSearch(); }} onKeyDown={e => { if (e.key === 'Enter') executeSearch(); }} />
        </div>
      </div>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: '0 16px 80px', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
        {!hasSearched && <div className="animate-fade-up">
          <h2 style={{ fontFamily: 'var(--forge-font-family)', fontSize: '1.125rem', fontWeight: 500, marginBottom: 16, color: 'var(--forge-text-medium)' }}>Explore by Topic</h2>
          <div className="space-y-5">{SUGGESTED_SEARCHES.map(cat => <div key={cat.category}>
            <h3 style={{ fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--forge-text-low)', marginBottom: 8 }}>{cat.category}</h3>
            <div className="flex flex-wrap gap-1.5">{cat.terms.map(term => <button key={term} onClick={() => handleSuggestedSearch(term)}
              style={{ padding: '6px 12px', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', fontSize: '0.8125rem', color: 'var(--forge-text-medium)', cursor: 'pointer', fontFamily: 'var(--forge-font-family)', transition: 'all 200ms' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--forge-tertiary)'; e.currentTarget.style.color = 'var(--forge-tertiary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--forge-outline)'; e.currentTarget.style.color = 'var(--forge-text-medium)'; }}>
              {term}
            </button>)}</div>
          </div>)}</div>
        </div>}

        {hasSearched && !loading && <div className="flex items-center justify-between mb-4 animate-fade-in">
          <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)' }}><span style={{ fontFamily: "'Roboto Mono', monospace", color: 'var(--forge-text-high)', fontWeight: 500 }}>{totalResults.toLocaleString()}</span> results{query && <> for <span style={{ color: 'var(--forge-tertiary)', fontWeight: 500 }}>"{query}"</span></>}{assetType && <> in <TypeBadge type={assetType} /></>}</p>
          {topDomains.length > 1 && <div className="hidden sm:flex items-center gap-1" style={{ fontSize: 10, color: 'var(--forge-text-low)' }}>Top sites:{topDomains.slice(0,3).map(([d,c]) => <span key={d} style={{ padding: '2px 6px', borderRadius: 'var(--forge-shape-small)', background: 'var(--forge-surface-container-minimum)', color: 'var(--forge-text-medium)', cursor: 'pointer' }} onClick={() => { setDomainFilter(d); executeSearch({ search_context: d }); }}>{d} ({c})</span>)}</div>}
        </div>}

        {error && <div style={{ background: 'rgba(176,0,32,0.08)', border: '1px solid rgba(176,0,32,0.3)', borderRadius: 'var(--forge-shape-medium)', padding: 16, marginBottom: 16, fontSize: '0.8125rem', color: 'var(--forge-error)' }}>{error}</div>}
        {loading && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">{Array.from({ length: 6 }).map((_, i) => <ResultSkeleton key={i} />)}</div>}
        {!loading && results.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">{results.map((item, i) => <ResultCard key={`${item.resource?.id}-${i}`} item={item} onSelect={setSelectedItem} />)}</div>}
        {!loading && hasSearched && results.length === 0 && !error && <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--forge-text-low)' }}><p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>No results found</p><p style={{ fontSize: '0.8125rem' }}>Try broadening your search or changing the asset type filter.</p></div>}
      </main>
      </>
      )}

      {/* AI FAB */}
      <button onClick={() => setAiOpen(!aiOpen)}
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 30, width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)', boxShadow: 'var(--forge-elevation-4)', transition: 'all 200ms', opacity: aiOpen ? 0 : 1, pointerEvents: aiOpen ? 'none' : 'auto', transform: aiOpen ? 'scale(0.75)' : 'scale(1)' }}>
        <SparkleIcon />
      </button>

      <AiAssistant results={results} isOpen={aiOpen} onToggle={() => setAiOpen(false)} />
      {selectedItem && <DetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />}

      <footer style={{ textAlign: 'center', padding: '16px 0', fontSize: 10, color: 'var(--forge-text-low)', borderTop: '1px solid var(--forge-outline)' }}>
        Powered by the Socrata Discovery API · Tyler Data & Insights
      </footer>
    </div>
  );
}
