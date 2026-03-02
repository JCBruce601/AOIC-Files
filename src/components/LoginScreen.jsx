import { useState } from "react";

const mono = { fontFamily: "'Roboto Mono', monospace" };

export default function LoginScreen({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("login"); // login | signup
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    if (!email.toLowerCase().trim().endsWith("@tylertech.com")) {
      setError("Only @tylertech.com email addresses are permitted.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          email: email.toLowerCase().trim(),
          password,
          name: name.trim() || undefined,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Authentication failed");

      localStorage.setItem("ode-auth-token", data.token);
      localStorage.setItem("ode-auth-email", data.email);
      localStorage.setItem("ode-auth-name", data.name || data.email.split("@")[0]);
      onAuth({ token: data.token, email: data.email, name: data.name || data.email.split("@")[0] });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--forge-surface-dim)', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--forge-surface)', border: '1px solid var(--forge-outline)', borderRadius: 'var(--forge-shape-large)', boxShadow: 'var(--forge-elevation-8)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--forge-brand)', color: 'var(--forge-on-brand)', padding: '28px 24px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: 4 }}>Open Data Explorer</div>
          <div style={{ fontSize: '0.6875rem', opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Tyler Data & Insights · Internal Tools</div>
        </div>

        <div style={{ padding: '24px' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--forge-text-medium)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
            Sign in with your <strong style={{ color: 'var(--forge-text-high)' }}>@tylertech.com</strong> email to access internal modules including Site Directory and Site Intelligence.
          </p>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', marginBottom: 20, background: 'var(--forge-surface-container-minimum)', borderRadius: 'var(--forge-shape-medium)', padding: 2 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(null); }}
                style={{ flex: 1, padding: '8px 0', fontSize: '0.8125rem', fontWeight: mode === m ? 500 : 400, background: mode === m ? 'var(--forge-surface)' : 'transparent', color: mode === m ? 'var(--forge-text-high)' : 'var(--forge-text-low)', border: mode === m ? '1px solid var(--forge-outline)' : '1px solid transparent', borderRadius: 'var(--forge-shape-small)', cursor: 'pointer', fontFamily: 'var(--forge-font-family)' }}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--forge-text-medium)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="forge-input" style={{ width: '100%' }} />
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--forge-text-medium)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@tylertech.com"
                className="forge-input" style={{ width: '100%' }} autoFocus />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 500, color: 'var(--forge-text-medium)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
                className="forge-input" style={{ width: '100%' }} />
            </div>

            {error && <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--forge-shape-small)', background: 'rgba(176,0,32,0.08)', border: '1px solid rgba(176,0,32,0.2)', color: 'var(--forge-error)', fontSize: '0.75rem' }}>{error}</div>}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '10px 0', borderRadius: 'var(--forge-shape-medium)', background: 'var(--forge-tertiary)', color: 'var(--forge-on-tertiary)', border: 'none', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'var(--forge-font-family)' }}>
              {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p style={{ fontSize: '0.6875rem', color: 'var(--forge-text-low)', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
            For Tyler Data & Insights employees only. Access restricted to @tylertech.com email addresses.
          </p>
        </div>
      </div>
    </div>
  );
}
