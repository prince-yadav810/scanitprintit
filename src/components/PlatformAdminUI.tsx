'use client';

import { useState, useEffect } from 'react';
import { Plus, X, QrCode, Download, AlertCircle, Store, TrendingUp, Cpu, Activity, Settings, ChevronRight, Calendar, Clock } from 'lucide-react';
import QRCode from 'qrcode';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function billingCycleInfo(billingStartDate: string) {
  const start = new Date(billingStartDate);
  const now = new Date();
  const msPerDay = 86400000;
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / msPerDay);
  const cycleDay = daysSinceStart % 30; // 0-29 = current position in 30-day cycle
  const daysLeft = 30 - cycleDay;
  const cycleStart = new Date(start.getTime() + Math.floor(daysSinceStart / 30) * 30 * msPerDay);
  const renewalDate = new Date(cycleStart.getTime() + 30 * msPerDay);
  return { daysLeft, cycleDay, renewalDate };
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE:    'ad-badge ad-badge-green',
    INACTIVE:  'ad-badge ad-badge-neutral',
    SUSPENDED: 'ad-badge ad-badge-red',
    DRAFT:     'ad-badge ad-badge-orange',
  };
  return <span className={styles[status] || 'ad-badge ad-badge-neutral'}>{status}</span>;
}

function AgentDot({ agents }: { agents: any[] }) {
  const online = agents?.some((a) => a.status === 'ONLINE');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: online ? '#15803D' : '#6B6860' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#22C55E' : '#D1D5DB', display: 'inline-block', flexShrink: 0 }} />
      {online ? 'Agent Online' : 'Agent Offline'}
    </span>
  );
}

function BillingPill({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 5;
  const warning = daysLeft <= 10;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: urgent ? '#FEE2E2' : warning ? '#FEF3C7' : '#DCFCE7',
      color: urgent ? '#DC2626' : warning ? '#92400E' : '#15803D',
    }}>
      <Clock size={9} />
      {daysLeft}d left
    </span>
  );
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E8E5DE', borderRadius: 12,
      padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14,
    }}>
      <div style={{ background: '#FEF3C7', borderRadius: 10, padding: 10, flexShrink: 0 }}>
        <Icon size={18} color="#D97706" />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1A1915', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#6B6860', marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Create Shop Modal ───────────────────────────────────────────────────────

function CreateShopModal({ onClose, onCreated }: { onClose: () => void; onCreated: (shop: any) => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password.trim()) return;
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), ownerUsername: username.trim(), ownerPassword: password.trim() }),
      });
      const data = await res.json();
      if (data.success) { onCreated(data.shop); onClose(); }
      else setError(data.error || 'Failed to create shop');
    } catch { setError('Network error. Please try again.'); }
    setCreating(false);
  };

  return (
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ad-modal-header">
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1A1915' }}>Onboard New Shop</h2>
            <p style={{ fontSize: 13, color: '#6B6860', marginTop: 2 }}>Creates login credentials and default pricing.</p>
          </div>
          <button className="ad-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ad-field">
            <label className="ad-label">Shop Name</label>
            <input className="ad-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Copy Centre" required />
          </div>
          <div className="ad-field">
            <label className="ad-label">Owner Username</label>
            <input className="ad-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. ramesh_copy" required />
          </div>
          <div className="ad-field">
            <label className="ad-label">Temporary Password</label>
            <input className="ad-input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="e.g. temp1234" required />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#DC2626', fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="ad-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="ad-btn-primary" disabled={creating} style={{ flex: 2 }}>
              {creating ? 'Creating...' : 'Create Shop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── QR Modal ───────────────────────────────────────────────────────────────

function QrModal({ shop, onClose }: { shop: any; onClose: () => void }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const shopUrl = `https://www.scanitprintit.in/s/${shop.slug}`;

  useEffect(() => {
    QRCode.toDataURL(shopUrl, { margin: 2, scale: 12, color: { dark: '#1a1915', light: '#ffffff' } })
      .then(setQrUrl).catch(() => {});
  }, [shopUrl]);

  return (
    <div className="ad-modal-overlay" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <div className="ad-modal-header">
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1A1915' }}>{shop.name}</h2>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>{shopUrl}</p>
          </div>
          <button className="ad-icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ background: '#F9F8F6', border: '1px solid #E8E5DE', borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16 }}>
          {qrUrl ? <img src={qrUrl} alt="QR" style={{ width: 200, height: 200, display: 'block', margin: '0 auto' }} /> : <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>Generating...</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {qrUrl && <a href={qrUrl} download={`${shop.name}-qr.png`} className="ad-btn-primary" style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6 }}><Download size={13} /> Download</a>}
          <button className="ad-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Shop Card ───────────────────────────────────────────────────────────────

function ShopCard({ shop, onQr }: { shop: any; onQr: (s: any) => void }) {
  const { daysLeft, renewalDate } = billingCycleInfo(shop.billingStartDate || shop.createdAt);
  const bwTier = shop.pricingTiers?.find((t: any) => t.mode === 'BW');
  const colorTier = shop.pricingTiers?.find((t: any) => t.mode === 'COLOR');

  return (
    <div className="ad-shop-card">
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/admin/shops/${shop.id}`} style={{ fontSize: 15, fontWeight: 700, color: '#1A1915', textDecoration: 'none' }} className="ad-shop-name">
              {shop.name}
            </a>
            <StatusBadge status={shop.status} />
            {shop.isTestShop && <span className="ad-badge ad-badge-orange">TEST</span>}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, fontFamily: 'monospace' }}>
            /s/{shop.slug}
          </div>
        </div>
        <a href={`/admin/shops/${shop.id}`} className="ad-icon-btn" title="View details">
          <ChevronRight size={16} />
        </a>
      </div>

      {/* Agent + billing row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <AgentDot agents={shop.agents} />
        <BillingPill daysLeft={daysLeft} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: '#F9F8F6', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Total Orders</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1915' }}>{shop.paidOrders}</div>
        </div>
        <div style={{ background: '#F9F8F6', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>Revenue</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#15803D' }}>{fmtCurrency(shop.revenue)}</div>
        </div>
      </div>

      {/* Info row */}
      <div style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span>Owner:</span>
          <span style={{ color: '#6B6860', fontWeight: 500 }}>{shop.user?.username || '—'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span>Onboarded:</span>
          <span style={{ color: '#6B6860' }}>{formatDate(shop.createdAt)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span>Renews:</span>
          <span style={{ color: '#6B6860' }}>{formatDate(renewalDate)}</span>
        </div>
        {bwTier && <div style={{ display: 'flex', gap: 6 }}>
          <span>Pricing:</span>
          <span style={{ color: '#6B6860' }}>BW ₹{bwTier.pricePerPage} · Color ₹{colorTier?.pricePerPage ?? '—'}</span>
        </div>}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #E8E5DE', paddingTop: 14 }}>
        <a href={`/admin/shops/${shop.id}`} className="ad-btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <TrendingUp size={12} /> Details
        </a>
        <button className="ad-btn-secondary" onClick={() => onQr(shop)} style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <QrCode size={12} /> QR Code
        </button>
        <a href={`/admin/shops/${shop.id}#settings`} className="ad-btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <Settings size={12} /> Settings
        </a>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PlatformAdminUI({
  initialShops,
  totals,
}: {
  initialShops: any[];
  totals: { totalShops: number; activeShops: number; agentsOnline: number; totalRevenue: number; totalOrders: number };
}) {
  const [shops, setShops] = useState(initialShops);
  const [showCreate, setShowCreate] = useState(false);
  const [qrShop, setQrShop] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');

  const filtered = shops.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.includes(search.toLowerCase());
    const matchFilter = filter === 'ALL' || s.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div className="ad-root">
      <style>{`
        .ad-root {
          min-height: 100vh;
          background: #FAFAF8;
          color: #1A1915;
          font-family: 'Inter', -apple-system, sans-serif;
        }
        .ad-topnav {
          background: #FFFFFF;
          border-bottom: 1px solid #E8E5DE;
          padding: 0 32px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .ad-topnav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          font-size: 15px;
          color: #1A1915;
          text-decoration: none;
        }
        .ad-topnav-brand img { height: 28px; }
        .ad-topnav-right { display: flex; align-items: center; gap: 10px; }
        .ad-container { max-width: 1280px; margin: 0 auto; padding: 32px 32px 80px; }
        .ad-page-header { margin-bottom: 28px; }
        .ad-page-title { font-size: 1.6rem; font-weight: 800; color: #1A1915; margin-bottom: 4px; }
        .ad-page-sub { font-size: 13px; color: #6B6860; }
        .ad-stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 32px; }
        .ad-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
        .ad-search { flex: 1; min-width: 200px; max-width: 340px; height: 38px; border: 1px solid #E8E5DE; border-radius: 8px; padding: 0 12px; font-size: 13px; background: #fff; color: #1A1915; outline: none; }
        .ad-search:focus { border-color: #D97706; box-shadow: 0 0 0 3px rgba(217,119,6,0.1); }
        .ad-filter-btn { height: 38px; padding: 0 14px; border-radius: 8px; border: 1px solid #E8E5DE; background: #fff; font-size: 13px; color: #6B6860; cursor: pointer; font-weight: 500; transition: all 0.15s; }
        .ad-filter-btn:hover { border-color: #D97706; color: #D97706; }
        .ad-filter-btn.active { background: #D97706; color: #fff; border-color: #D97706; }
        .ad-shops-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
        .ad-shop-card {
          background: #FFFFFF;
          border: 1px solid #E8E5DE;
          border-radius: 14px;
          padding: 20px;
          transition: box-shadow 0.2s, transform 0.2s;
        }
        .ad-shop-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .ad-shop-name:hover { color: #D97706 !important; }
        .ad-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .ad-badge-green { background: #DCFCE7; color: #15803D; }
        .ad-badge-red { background: #FEE2E2; color: #DC2626; }
        .ad-badge-neutral { background: #F3F4F6; color: #6B7280; }
        .ad-badge-orange { background: #FEF3C7; color: #92400E; }
        .ad-btn-primary {
          height: 38px; padding: 0 18px; border-radius: 8px; background: #D97706; color: #fff;
          border: none; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex;
          align-items: center; gap: 6px; text-decoration: none; transition: background 0.15s;
          white-space: nowrap;
        }
        .ad-btn-primary:hover { background: #B45309; }
        .ad-btn-secondary {
          height: 34px; padding: 0 14px; border-radius: 8px; background: #F9F8F6; color: #6B6860;
          border: 1px solid #E8E5DE; font-size: 13px; font-weight: 500; cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px; text-decoration: none; transition: all 0.15s;
          white-space: nowrap;
        }
        .ad-btn-secondary:hover { background: #F3F0E8; border-color: #D1CBC0; color: #1A1915; }
        .ad-icon-btn {
          width: 32px; height: 32px; border-radius: 8px; background: #F9F8F6; border: 1px solid #E8E5DE;
          display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
          color: #6B6860; transition: all 0.15s; text-decoration: none;
        }
        .ad-icon-btn:hover { background: #F3F0E8; color: #1A1915; }
        .ad-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
          backdrop-filter: blur(2px);
        }
        .ad-modal {
          background: #FFFFFF; border-radius: 16px; padding: 28px; width: 100%;
          max-width: 440px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
          animation: adModalIn 0.18s ease;
        }
        @keyframes adModalIn { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: none; } }
        .ad-modal-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 22px; }
        .ad-field { display: flex; flex-direction: column; gap: 5; }
        .ad-label { font-size: 12px; font-weight: 600; color: #6B6860; text-transform: uppercase; letter-spacing: 0.04em; }
        .ad-input {
          height: 40px; border: 1px solid #E8E5DE; border-radius: 8px; padding: 0 12px;
          font-size: 14px; background: #FAFAF8; color: #1A1915; outline: none; transition: all 0.15s;
        }
        .ad-input:focus { border-color: #D97706; box-shadow: 0 0 0 3px rgba(217,119,6,0.12); background: #fff; }
        .ad-empty { text-align: center; padding: 60px 20px; color: #6B6860; }
        .ad-empty svg { color: #D1D5DB; margin-bottom: 12px; }
        .ad-divider { height: 1px; background: #E8E5DE; margin: 6px 0; }
        @media (max-width: 640px) {
          .ad-container { padding: 20px 16px 60px; }
          .ad-topnav { padding: 0 16px; }
          .ad-shops-grid { grid-template-columns: 1fr; }
          .ad-stats-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      {/* Top Nav */}
      <nav className="ad-topnav">
        <a href="/admin" className="ad-topnav-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-full.png" alt="ScanItPrintIt" style={{ height: 36 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
          <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', background: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>Platform Admin</span>
        </a>
        <div className="ad-topnav-right">
          <a href="/api/auth/logout" className="ad-btn-secondary">Sign out</a>
        </div>
      </nav>

      <div className="ad-container">
        {/* Page header */}
        <div className="ad-page-header">
          <h1 className="ad-page-title">Platform Dashboard</h1>
          <p className="ad-page-sub">Manage all shops, monitor billing cycles, and view platform-wide analytics.</p>
        </div>

        {/* Stats bar */}
        <div className="ad-stats-grid">
          <StatCard label="Total Shops" value={String(totals.totalShops)} icon={Store} sub={`${totals.activeShops} active`} />
          <StatCard label="Agents Online" value={String(totals.agentsOnline)} icon={Cpu} sub="right now" />
          <StatCard label="Total Orders" value={String(totals.totalOrders)} icon={Activity} sub="all time, paid" />
          <StatCard label="Platform Revenue" value={fmtCurrency(totals.totalRevenue)} icon={TrendingUp} sub="all time" />
        </div>

        {/* Toolbar */}
        <div className="ad-toolbar">
          <input
            className="ad-search"
            placeholder="Search shops..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((f) => (
            <button key={f} className={`ad-filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button className="ad-btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={15} /> New Shop
            </button>
          </div>
        </div>

        {/* Shops grid */}
        {filtered.length === 0 ? (
          <div className="ad-empty">
            <Store size={40} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>No shops found</p>
            <p style={{ fontSize: 13 }}>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="ad-shops-grid">
            {filtered.map((shop) => (
              <ShopCard key={shop.id} shop={shop} onQr={setQrShop} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateShopModal
          onClose={() => setShowCreate(false)}
          onCreated={(shop) => setShops([{ ...shop, revenue: 0, paidOrders: 0, pricingTiers: shop.pricingTiers || [] }, ...shops])}
        />
      )}
      {qrShop && <QrModal shop={qrShop} onClose={() => setQrShop(null)} />}
    </div>
  );
}
