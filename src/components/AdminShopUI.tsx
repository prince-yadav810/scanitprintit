'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Cpu, RefreshCw, CheckCircle2, XCircle, Printer, Settings, TrendingUp, FileText, Activity, QrCode, Download, ToggleLeft, ToggleRight, AlertCircle, CheckCircle, Save, ChevronRight } from 'lucide-react';
import QRCode from 'qrcode';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  AWAITING_PAYMENT:   { label: 'Awaiting Payment', color: '#92400E', bg: '#FEF3C7' },
  AWAITING_APPROVAL:  { label: 'Needs Approval',   color: '#1D4ED8', bg: '#DBEAFE' },
  PAID_QUEUED:        { label: 'Queued',            color: '#1D4ED8', bg: '#DBEAFE' },
  PRINTING:           { label: 'Printing',          color: '#7C3AED', bg: '#EDE9FE' },
  PRINTED:            { label: 'Printed ✓',         color: '#15803D', bg: '#DCFCE7' },
  SIMULATED_PRINTED:  { label: 'Simulated',         color: '#6B7280', bg: '#F3F4F6' },
  NEEDS_ATTENTION:    { label: 'Needs Attention',   color: '#DC2626', bg: '#FEE2E2' },
  CANCELLED:          { label: 'Cancelled',         color: '#DC2626', bg: '#FEE2E2' },
  CANCELLED_REFUNDED: { label: 'Refunded',          color: '#6B7280', bg: '#F3F4F6' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #F3F0E8' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1915' }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: checked ? '#D97706' : '#D1D5DB', padding: 0, flexShrink: 0 }}>
        {checked ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
      </button>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#F9F8F6', border: '1px solid #E8E5DE', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1A1915' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── QR Section ───────────────────────────────────────────────────────────────

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
      <p style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', marginBottom: 12, wordBreak: 'break-all' }}>{shopUrl}</p>
      {qrUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#fff', border: '1px solid #E8E5DE', borderRadius: 10, padding: 16 }}>
            <img src={qrUrl} alt="QR" style={{ width: 160, height: 160, display: 'block' }} />
          </div>
          <a href={qrUrl} download={`${shop.name}-qr.png`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, background: '#D97706', color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
            <Download size={12} /> Download PNG
          </a>
        </div>
      ) : (
        <button onClick={generate} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', borderRadius: 8, background: '#F9F8F6', border: '1px solid #E8E5DE', color: '#6B6860', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          <QrCode size={13} /> {loading ? 'Generating...' : 'Show QR Code'}
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await fetch(`/api/owner/shops/${shop.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoPrintEnabled: autoPrint, ...(shop.isTestShop ? { simulationEnabled: simulation } : {}), pricing: { BW: parseFloat(bw), COLOR: parseFloat(color) } }),
      });
      const data = await res.json();
      if (data.success) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else setError(data.error || 'Failed to save');
    } catch { setError('Network error'); }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>BW / Page (₹)</label>
          <input type="number" step="0.5" value={bw} onChange={(e) => setBw(e.target.value)} style={{ width: '100%', height: 38, border: '1px solid #E8E5DE', borderRadius: 8, padding: '0 10px', fontSize: 14, background: '#FAFAF8', color: '#1A1915', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>Color / Page (₹)</label>
          <input type="number" step="0.5" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: '100%', height: 38, border: '1px solid #E8E5DE', borderRadius: 8, padding: '0 10px', fontSize: 14, background: '#FAFAF8', color: '#1A1915', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>
      <Toggle checked={autoPrint} onChange={setAutoPrint} label="Auto-Print" sub="Paid jobs go directly to print queue without manual approval" />
      {shop.isTestShop && <Toggle checked={simulation} onChange={setSimulation} label="Simulation Mode" sub="Save print jobs as PDFs instead of sending to physical printer" />}
      {error && <div style={{ color: '#DC2626', fontSize: 12, display: 'flex', gap: 5, alignItems: 'center', marginTop: 10 }}><AlertCircle size={12} />{error}</div>}
      <button onClick={save} disabled={saving} style={{ marginTop: 14, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 18px', borderRadius: 8, background: '#D97706', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving...' : saved ? <><CheckCircle size={13} /> Saved!</> : <><Save size={13} /> Save Settings</>}
      </button>
    </div>
  );
}

// ─── Inspect Modal ────────────────────────────────────────────────────────────

function InspectModal({ order, onClose }: { order: any; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', animation: 'modalIn 0.18s ease' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1915' }}>Order #{order.orderNumber}</h2>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{formatDateTime(order.createdAt)}</p>
          </div>
          <button onClick={onClose} style={{ background: '#F9F8F6', border: '1px solid #E8E5DE', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B6860', fontSize: 18 }}>×</button>
        </div>
        <div style={{ background: '#F9F8F6', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Files</div>
          {order.files?.length > 0 ? order.files.map((f: any) => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: '#1A1915' }}>{f.originalName}</span>
              <a href={f.convertedPdfUrl || f.cloudinaryUrl} target="_blank" rel="noreferrer" style={{ color: '#D97706', textDecoration: 'none', fontWeight: 500 }}>View PDF →</a>
            </div>
          )) : <span style={{ color: '#9CA3AF', fontSize: 13 }}>No files</span>}
        </div>
        <div style={{ background: '#F9F8F6', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Print Settings</div>
          <pre style={{ fontSize: 12, overflowX: 'auto', color: '#1A1915', margin: 0 }}>{JSON.stringify(order.settings || {}, null, 2)}</pre>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ height: 36, padding: '0 16px', borderRadius: 8, background: '#F9F8F6', border: '1px solid #E8E5DE', color: '#6B6860', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminShopUI({ shop, userRole }: { shop: any; userRole?: string }) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [orders, setOrders] = useState(shop.orders);
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<any | null>(null);

  // Compute quick stats
  const paidStatuses = ['PAID_QUEUED', 'PRINTING', 'PRINTED', 'SIMULATED_PRINTED'];
  const paidOrders = orders.filter((o: any) => paidStatuses.includes(o.status));
  const todayOrders = paidOrders.filter((o: any) => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((s: number, o: any) => s + o.totalAmount, 0);
  const totalRevenue = paidOrders.reduce((s: number, o: any) => s + o.totalAmount, 0);
  const agentOnline = shop.agents?.length > 0 && shop.agents[0].status === 'ONLINE';

  const generatePairingCode = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/owner/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shopId: shop.id }) });
      const data = await res.json();
      if (data.success) setPairingCode(data.code);
      else alert(data.error || 'Failed');
    } catch { alert('Network error'); }
    setIsGenerating(false);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    setLoadingOrder(orderId);
    try {
      await fetch(`/api/owner/orders/${orderId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      window.location.reload();
    } catch { alert('Failed to update order'); }
    setLoadingOrder(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', color: '#1A1915', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        @keyframes modalIn { from { opacity:0; transform: translateY(8px) scale(0.98); } to { opacity:1; transform: none; } }
        .ow-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .ow-table th { padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.04em; background: #F9F8F6; border-bottom: 1px solid #E8E5DE; white-space: nowrap; }
        .ow-table td { padding: 12px 14px; border-bottom: 1px solid #F3F0E8; vertical-align: middle; }
        .ow-table tr:last-child td { border-bottom: none; }
        .ow-table tr:hover td { background: #FAFAF8; }
        .ow-card { background: #FFFFFF; border: 1px solid #E8E5DE; border-radius: 14px; padding: 22px; }
        .ow-card-title { font-size: 13px; font-weight: 700; color: #1A1915; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .ow-action-btn { height: 30px; padding: 0 12px; border-radius: 6px; border: 1px solid #E8E5DE; background: #F9F8F6; color: #6B6860; font-size: 11px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s; }
        .ow-action-btn:hover { background: #F3F0E8; color: #1A1915; }
        .ow-action-btn.approve { background: #DCFCE7; border-color: #BBF7D0; color: #15803D; }
        .ow-action-btn.approve:hover { background: #BBF7D0; }
        .ow-action-btn.danger { background: #FEE2E2; border-color: #FECACA; color: #DC2626; }
        .ow-action-btn.danger:hover { background: #FECACA; }
      `}</style>

      {/* Top Nav */}
      <nav style={{ background: '#FFFFFF', borderBottom: '1px solid #E8E5DE', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-full.png" alt="ScanItPrintIt" style={{ height: 36 }} onError={(e) => (e.currentTarget.style.display = 'none')} />
          <span style={{ color: '#D1D5DB', marginLeft: 4 }}>·</span>
          <span style={{ fontSize: 14, color: '#6B6860', fontWeight: 500 }}>{shop.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {userRole === 'PLATFORM_ADMIN' && (
            <a href="/admin" style={{ height: 34, padding: '0 14px', borderRadius: 8, background: '#F9F8F6', border: '1px solid #E8E5DE', color: '#6B6860', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              <ArrowLeft size={13} /> Platform Admin
            </a>
          )}
          <a href="/api/auth/logout" style={{ height: 34, padding: '0 14px', borderRadius: 8, background: '#F9F8F6', border: '1px solid #E8E5DE', color: '#6B6860', fontSize: 13, fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Sign out</a>
        </div>
      </nav>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px 80px' }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1A1915', marginBottom: 2 }}>{shop.name}</h1>
          <p style={{ fontSize: 13, color: '#9CA3AF', fontFamily: 'monospace' }}>scanitprintit.in/s/{shop.slug}</p>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <MiniStat label="Today Orders" value={String(todayOrders.length)} sub={fmtCurrency(todayRevenue)} />
          <MiniStat label="Total Orders" value={String(paidOrders.length)} sub={fmtCurrency(totalRevenue)} />
          <MiniStat label="Agent" value={agentOnline ? 'Online' : 'Offline'} sub={agentOnline ? `Printer: ${shop.agents[0]?.selectedPrinter || 'Default'}` : 'Check agent app'} />
          <MiniStat label="Pricing" value={`₹${shop.pricingTiers?.find((t:any)=>t.mode==='BW')?.pricePerPage ?? 5}`} sub={`Color ₹${shop.pricingTiers?.find((t:any)=>t.mode==='COLOR')?.pricePerPage ?? 10}/pg`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Agent card */}
            <div className="ow-card">
              <div className="ow-card-title"><Cpu size={14} color="#D97706" /> Print Agent</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: agentOnline ? '#DCFCE7' : '#F3F4F6', borderRadius: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: agentOnline ? '#22C55E' : '#D1D5DB', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: agentOnline ? '#15803D' : '#6B7280' }}>
                  {shop.agents?.length > 0 ? (agentOnline ? 'Agent Online' : 'Agent Offline') : 'No agent paired'}
                </span>
              </div>
              {!pairingCode ? (
                <button onClick={generatePairingCode} disabled={isGenerating} style={{ width: '100%', height: 38, borderRadius: 8, background: '#D97706', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RefreshCw size={13} style={{ animation: isGenerating ? 'spin 1s linear infinite' : 'none' }} />
                  {isGenerating ? 'Generating...' : 'Generate Pairing Code'}
                </button>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Enter in Print Agent app:</p>
                  <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: 8, color: '#1A1915', fontFamily: 'monospace', background: '#F9F8F6', borderRadius: 10, padding: '12px 0', border: '1px dashed #E8E5DE' }}>{pairingCode}</div>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>Expires in 15 minutes</p>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="ow-card">
              <div className="ow-card-title"><QrCode size={14} color="#D97706" /> Shop QR Code</div>
              <QrSection shop={shop} />
            </div>

            {/* Settings */}
            <div className="ow-card">
              <div className="ow-card-title"><Settings size={14} color="#D97706" /> Settings</div>
              <SettingsPanel shop={shop} />
            </div>
          </div>

          {/* Right column — Orders */}
          <div className="ow-card">
            <div className="ow-card-title" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={14} color="#D97706" /> Recent Orders</div>
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>Last {orders.length} orders</span>
            </div>
            {orders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                <Printer size={32} style={{ margin: '0 auto 10px', color: '#E8E5DE' }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No orders yet</p>
                <p style={{ fontSize: 12 }}>Share your QR code to get started.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #E8E5DE' }}>
                <table className="ow-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Pages</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order: any) => (
                      <tr key={order.id}>
                        <td>
                          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#1A1915', fontWeight: 600 }}>{order.orderNumber}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{order.settings?.mode || 'BW'} · {order.settings?.sides || 'Single'}</div>
                        </td>
                        <td style={{ fontSize: 13, color: '#1A1915' }}>{order.customerName || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td style={{ fontSize: 13 }}>{order.pageCount}</td>
                        <td style={{ fontWeight: 600, fontSize: 13, color: '#15803D' }}>{fmtCurrency(order.totalAmount)}</td>
                        <td style={{ fontSize: 11, color: '#6B6860', whiteSpace: 'nowrap' }}>{formatDateTime(order.createdAt)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {order.status === 'AWAITING_APPROVAL' && (
                              <button className="ow-action-btn approve" onClick={() => handleStatusChange(order.id, 'PAID_QUEUED')} disabled={loadingOrder === order.id}>
                                <CheckCircle2 size={10} /> Approve
                              </button>
                            )}
                            {order.status === 'PRINTING' && (
                              <button className="ow-action-btn approve" onClick={() => handleStatusChange(order.id, 'PRINTED')} disabled={loadingOrder === order.id}>
                                <CheckCircle2 size={10} /> Mark Done
                              </button>
                            )}
                            {order.status === 'NEEDS_ATTENTION' && (
                              <button className="ow-action-btn" onClick={() => handleStatusChange(order.id, 'PAID_QUEUED')} disabled={loadingOrder === order.id}>
                                <RefreshCw size={10} /> Retry
                              </button>
                            )}
                            {['AWAITING_APPROVAL', 'PRINTING', 'PAID_QUEUED'].includes(order.status) && (
                              <button className="ow-action-btn danger" onClick={() => handleStatusChange(order.id, 'CANCELLED')} disabled={loadingOrder === order.id}>
                                <XCircle size={10} /> Cancel
                              </button>
                            )}
                            <button className="ow-action-btn" onClick={() => setInspectingOrder(order)}>Inspect</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {inspectingOrder && <InspectModal order={inspectingOrder} onClose={() => setInspectingOrder(null)} />}
    </div>
  );
}
