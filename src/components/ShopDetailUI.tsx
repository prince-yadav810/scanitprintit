'use client';

import { useState } from 'react';
import { ArrowLeft, Store, Cpu, Calendar, Clock, TrendingUp, Activity, FileText, QrCode, Download, Settings, X, AlertCircle, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function billingCycleInfo(billingStartDate: string) {
  const start = new Date(billingStartDate);
  const now = new Date();
  const msPerDay = 86400000;
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / msPerDay);
  const cycleDay = daysSinceStart % 30;
  const daysLeft = 30 - cycleDay;
  const cycleStart = new Date(start.getTime() + Math.floor(daysSinceStart / 30) * 30 * msPerDay);
  const renewalDate = new Date(cycleStart.getTime() + 30 * msPerDay);
  return { daysLeft, cycleDay, renewalDate, cycleStart };
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:             { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  AWAITING_PAYMENT:  { label: 'Awaiting Payment', color: '#92400E', bg: '#FEF3C7' },
  PAID_QUEUED:       { label: 'Queued', color: '#1D4ED8', bg: '#DBEAFE' },
  PRINTING:          { label: 'Printing', color: '#7C3AED', bg: '#EDE9FE' },
  PRINTED:           { label: 'Printed', color: '#15803D', bg: '#DCFCE7' },
  SIMULATED_PRINTED: { label: 'Simulated', color: '#6B7280', bg: '#F3F4F6' },
  NEEDS_ATTENTION:   { label: 'Needs Attention', color: '#DC2626', bg: '#FEE2E2' },
  CANCELLED:         { label: 'Cancelled', color: '#DC2626', bg: '#FEE2E2' },
  EXPIRED:           { label: 'Expired', color: '#6B7280', bg: '#F3F4F6' },
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F3F0E8' }}>
      <span style={{ fontSize: 13, color: '#6B6860' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1915' }}>{value}</span>
    </div>
  );
}

function MiniStatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E5DE', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent || '#1A1915', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const s = STATUS_LABELS[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <span style={{ fontSize: 14, color: '#1A1915' }}>{label}</span>
      <button
        onClick={() => onChange(!checked)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: checked ? '#D97706' : '#D1D5DB', padding: 0 }}
      >
        {checked ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>
  );
}

// ─── QR Code Section ─────────────────────────────────────────────────────────

function QrSection({ shop }: { shop: any }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shopUrl = `https://www.scanitprintit.in/s/${shop.slug}`;

  const generate = async () => {
    setLoading(true);
    try {
      const url = await QRCode.toDataURL(shopUrl, { margin: 2, scale: 12, color: { dark: '#1a1915', light: '#ffffff' } });
      setQrUrl(url);
    } catch {}
    setLoading(false);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 16, wordBreak: 'break-all' }}>{shopUrl}</p>
      {qrUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#F9F8F6', border: '1px solid #E8E5DE', borderRadius: 12, padding: 20 }}>
            <img src={qrUrl} alt="QR" style={{ width: 180, height: 180, display: 'block' }} />
          </div>
          <a href={qrUrl} download={`${shop.name}-qr.png`} className="ad-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download size={13} /> Download PNG
          </a>
        </div>
      ) : (
        <button className="ad-btn-secondary" onClick={generate} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <QrCode size={13} /> {loading ? 'Generating...' : 'Generate QR Code'}
        </button>
      )}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ shop }: { shop: any }) {
  const bwTier = shop.pricingTiers?.find((t: any) => t.mode === 'BW');
  const colorTier = shop.pricingTiers?.find((t: any) => t.mode === 'COLOR');
  const [bw, setBw] = useState(String(bwTier?.pricePerPage ?? 5));
  const [color, setColor] = useState(String(colorTier?.pricePerPage ?? 10));
  const [autoPrint, setAutoPrint] = useState(shop.autoPrintEnabled);
  const [simulation, setSimulation] = useState(shop.simulationEnabled);
  const [isTest, setIsTest] = useState(shop.isTestShop);
  const [status, setStatus] = useState(shop.status);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch(`/api/admin/shops/${shop.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bwPricePerPage: bw, colorPricePerPage: color, autoPrintEnabled: autoPrint, simulationEnabled: simulation, isTestShop: isTest, status }),
      });
      const data = await res.json();
      if (data.success) setSaved(true);
      else setError(data.error || 'Failed to save');
    } catch { setError('Network error'); }
    setSaving(false);
    if (saved) setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div className="ad-field-inline">
          <label className="ad-label">BW Price / Page (₹)</label>
          <input className="ad-input" type="number" step="0.5" value={bw} onChange={(e) => setBw(e.target.value)} />
        </div>
        <div className="ad-field-inline">
          <label className="ad-label">Color Price / Page (₹)</label>
          <input className="ad-input" type="number" step="0.5" value={color} onChange={(e) => setColor(e.target.value)} />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label className="ad-label" style={{ display: 'block', marginBottom: 6 }}>Shop Status</label>
        <select className="ad-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="DRAFT">DRAFT</option>
        </select>
      </div>
      <div style={{ borderTop: '1px solid #F3F0E8', marginTop: 8 }}>
        <Toggle checked={autoPrint} onChange={setAutoPrint} label="Auto-Print Enabled" />
        <Toggle checked={simulation} onChange={setSimulation} label="Simulation Mode" />
        <Toggle checked={isTest} onChange={setIsTest} label="Test Shop" />
      </div>
      {error && <div style={{ color: '#DC2626', fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', marginTop: 8 }}><AlertCircle size={12} />{error}</div>}
      <button className="ad-btn-primary" onClick={save} disabled={saving} style={{ marginTop: 14, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}>
        {saving ? 'Saving...' : saved ? <><CheckCircle size={13} /> Saved!</> : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ShopDetailUI({ shop, stats, recentOrders }: { shop: any; stats: any; recentOrders: any[] }) {
  const { daysLeft, renewalDate, cycleStart } = billingCycleInfo(shop.billingStartDate || shop.createdAt);
  const urgentBilling = daysLeft <= 5;
  const warningBilling = daysLeft <= 10;
  const agent = shop.agents?.[0];
  const isOnline = agent?.status === 'ONLINE';

  return (
    <div className="ad-root">
      <style>{`
        .ad-root { min-height: 100vh; background: #FAFAF8; color: #1A1915; font-family: 'Inter', -apple-system, sans-serif; }
        .ad-topnav { background: #FFFFFF; border-bottom: 1px solid #E8E5DE; padding: 0 32px; height: 60px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 10; }
        .ad-topnav-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; color: #1A1915; text-decoration: none; }
        .ad-topnav-brand img { height: 28px; }
        .ad-container { max-width: 1200px; margin: 0 auto; padding: 32px 32px 80px; }
        .ad-btn-primary { height: 38px; padding: 0 18px; border-radius: 8px; background: #D97706; color: #fff; border: none; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; transition: background 0.15s; white-space: nowrap; }
        .ad-btn-primary:hover { background: #B45309; }
        .ad-btn-secondary { height: 34px; padding: 0 14px; border-radius: 8px; background: #F9F8F6; color: #6B6860; border: 1px solid #E8E5DE; font-size: 13px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; transition: all 0.15s; white-space: nowrap; }
        .ad-btn-secondary:hover { background: #F3F0E8; color: #1A1915; }
        .ad-card { background: #FFFFFF; border: 1px solid #E8E5DE; border-radius: 14px; padding: 24px; }
        .ad-card-title { font-size: 14px; font-weight: 700; color: #1A1915; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .ad-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .ad-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
        .ad-field { display: flex; flex-direction: column; gap: 5; }
        .ad-field-inline { display: flex; flex-direction: column; gap: 5; }
        .ad-label { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em; }
        .ad-input { height: 40px; border: 1px solid #E8E5DE; border-radius: 8px; padding: 0 12px; font-size: 14px; background: #FAFAF8; color: #1A1915; outline: none; transition: all 0.15s; width: 100%; box-sizing: border-box; }
        .ad-input:focus { border-color: #D97706; box-shadow: 0 0 0 3px rgba(217,119,6,0.12); background: #fff; }
        .ad-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .ad-badge-green { background: #DCFCE7; color: #15803D; }
        .ad-badge-red { background: #FEE2E2; color: #DC2626; }
        .ad-badge-neutral { background: #F3F4F6; color: #6B7280; }
        .ad-badge-orange { background: #FEF3C7; color: #92400E; }
        .ad-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #E8E5DE; }
        .ad-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ad-table th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em; background: #F9F8F6; border-bottom: 1px solid #E8E5DE; white-space: nowrap; }
        .ad-table td { padding: 12px 14px; border-bottom: 1px solid #F3F0E8; vertical-align: middle; color: #1A1915; }
        .ad-table tr:last-child td { border-bottom: none; }
        .ad-table tr:hover td { background: #FAFAF8; }
        .ad-progress { height: 6px; background: #E8E5DE; border-radius: 3px; overflow: hidden; margin-top: 6px; }
        .ad-progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }
        @media (max-width: 768px) {
          .ad-grid-2 { grid-template-columns: 1fr; }
          .ad-grid-3 { grid-template-columns: 1fr 1fr; }
          .ad-container { padding: 20px 16px 60px; }
          .ad-topnav { padding: 0 16px; }
        }
      `}</style>

      {/* Top Nav */}
      <nav className="ad-topnav">
        <a href="/admin" className="ad-topnav-brand">
          <img src="/icon.png" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
          ScanItPrintIt
          <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', background: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>Platform Admin</span>
        </a>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/admin" className="ad-btn-secondary"><ArrowLeft size={13} /> All Shops</a>
          <a href="/api/auth/logout" className="ad-btn-secondary">Sign out</a>
        </div>
      </nav>

      <div className="ad-container">
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1A1915' }}>{shop.name}</h1>
            <span className={`ad-badge ad-badge-${shop.status === 'ACTIVE' ? 'green' : shop.status === 'SUSPENDED' ? 'red' : 'neutral'}`}>{shop.status}</span>
            {shop.isTestShop && <span className="ad-badge ad-badge-orange">TEST</span>}
          </div>
          <p style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 4 }}>
            https://www.scanitprintit.in/s/{shop.slug}
          </p>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
          <MiniStatCard label="Today Orders" value={String(stats.today.orders)} sub={fmtCurrency(stats.today.revenue)} />
          <MiniStatCard label="This Month" value={String(stats.month.orders)} sub={fmtCurrency(stats.month.revenue)} />
          <MiniStatCard label="All-Time Orders" value={String(stats.allTime.orders)} sub={fmtCurrency(stats.allTime.revenue)} accent="#15803D" />
          <MiniStatCard label="Total Pages" value={String(stats.allTime.pages)} sub={`BW: ${stats.bwOrders} · Color: ${stats.colorOrders}`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          {/* Overview */}
          <div className="ad-card">
            <div className="ad-card-title"><Store size={15} color="#D97706" /> Shop Overview</div>
            <InfoRow label="Owner" value={shop.user?.username || '—'} />
            <InfoRow label="Onboarded" value={formatDate(shop.createdAt)} />
            <InfoRow label="Total Orders" value={shop._count?.orders ?? 0} />
            <InfoRow label="Auto-Print" value={shop.autoPrintEnabled ? '✅ Enabled' : '❌ Disabled'} />
            <InfoRow label="Simulation" value={shop.simulationEnabled ? '🔬 On' : 'Off'} />
          </div>

          {/* Billing Cycle */}
          <div className="ad-card">
            <div className="ad-card-title"><Calendar size={15} color="#D97706" /> Billing Cycle</div>
            <InfoRow label="Cycle Start" value={formatDate(cycleStart)} />
            <InfoRow label="Renews On" value={formatDate(renewalDate)} />
            <InfoRow
              label="Days Left"
              value={
                <span style={{ color: urgentBilling ? '#DC2626' : warningBilling ? '#92400E' : '#15803D', fontWeight: 700 }}>
                  {daysLeft} days
                </span>
              }
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>
                <span>Cycle Progress</span>
                <span>{30 - daysLeft}/30 days</span>
              </div>
              <div className="ad-progress">
                <div
                  className="ad-progress-fill"
                  style={{
                    width: `${((30 - daysLeft) / 30) * 100}%`,
                    background: urgentBilling ? '#DC2626' : warningBilling ? '#F59E0B' : '#22C55E',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
          {/* Agent */}
          <div className="ad-card">
            <div className="ad-card-title"><Cpu size={15} color="#D97706" /> Agent Status</div>
            {agent ? (
              <>
                <InfoRow
                  label="Status"
                  value={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: isOnline ? '#15803D' : '#6B7280', fontWeight: 700 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOnline ? '#22C55E' : '#D1D5DB', display: 'inline-block' }} />
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  }
                />
                <InfoRow label="Printer" value={agent.selectedPrinter || 'Default'} />
                <InfoRow label="Last Seen" value={formatDateTime(agent.lastSeenAt)} />
              </>
            ) : (
              <div style={{ color: '#9CA3AF', fontSize: 13, padding: '12px 0' }}>No agent paired yet.</div>
            )}
          </div>

          {/* QR Code */}
          <div className="ad-card">
            <div className="ad-card-title"><QrCode size={15} color="#D97706" /> Shop QR Code</div>
            <QrSection shop={shop} />
          </div>
        </div>

        {/* Settings */}
        <div className="ad-card" id="settings" style={{ marginBottom: 18 }}>
          <div className="ad-card-title"><Settings size={15} color="#D97706" /> Shop Settings</div>
          <SettingsPanel shop={shop} />
        </div>

        {/* Recent Orders */}
        <div className="ad-card">
          <div className="ad-card-title"><FileText size={15} color="#D97706" /> Recent Orders</div>
          {recentOrders.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No orders yet.</div>
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Pages</th>
                    <th>Mode</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const settings = o.settings as any;
                    return (
                      <tr key={o.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{o.orderNumber}</td>
                        <td>{o.customerName || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                        <td>{o.pageCount}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: settings?.mode === 'COLOR' ? '#DBEAFE' : '#F3F4F6', color: settings?.mode === 'COLOR' ? '#1D4ED8' : '#6B7280' }}>
                            {settings?.mode || 'BW'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmtCurrency(o.totalAmount)}</td>
                        <td><OrderStatusBadge status={o.status} /></td>
                        <td style={{ fontSize: 12, color: '#6B6860' }}>{formatDateTime(o.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
