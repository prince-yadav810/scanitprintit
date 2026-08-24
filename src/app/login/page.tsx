'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success) window.location.href = data.redirectUrl;
      else setError(data.error || 'Invalid credentials');
    } catch {
      setError('Network error. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-subtle)' }}>

      {/* Top wordmark */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>PrintDesk</span>
      </div>

      {/* Centered card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="card fade-up" style={{ width: '100%', maxWidth: 380 }}>

          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: '1.35rem', marginBottom: 6 }}>Sign in</h1>
            <p className="text-sm text-muted">Enter your credentials to access the dashboard.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2" style={{ marginBottom: 20, padding: '10px 14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="field">
              <label className="label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            <button className="btn btn-primary btn-xl btn-full" type="submit" disabled={isLoading} style={{ marginTop: 8 }}>
              {isLoading ? <><Loader2 size={16} className="spin" /> Signing in…</> : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
