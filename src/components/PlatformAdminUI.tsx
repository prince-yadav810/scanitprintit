'use client';

import { useState } from 'react';
import { Store, QrCode, Settings, Plus, X, Download, Cpu, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'badge badge-green',
    INACTIVE: 'badge badge-neutral',
    SUSPENDED: 'badge badge-red',
  };
  return <span className={map[status] || 'badge badge-neutral'}>{status}</span>;
}

function AgentStatus({ agents }: { agents: any[] }) {
  if (!agents || agents.length === 0) {
    return <span className="text-muted text-xs">No agent</span>;
  }
  const online = agents[0].status === 'ONLINE';
  return (
    <span className={`agent-pill ${online ? 'badge-green' : 'badge-neutral'}`}>
      <span className={`agent-pill-dot`} style={{ background: online ? 'var(--success)' : 'var(--border-strong)' }} />
      {agents[0].status}
    </span>
  );
}

export default function PlatformAdminUI({ initialShops }: { initialShops: any[] }) {
  const [shops, setShops] = useState(initialShops);
  const [newShopName, setNewShopName] = useState('');
  const [newShopUsername, setNewShopUsername] = useState('');
  const [newShopPassword, setNewShopPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [qrModal, setQrModal] = useState<{ open: boolean; url: string; name: string; shopUrl: string } | null>(null);

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim() || !newShopUsername.trim() || !newShopPassword.trim()) return;
    setIsCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newShopName.trim(),
          ownerUsername: newShopUsername.trim(),
          ownerPassword: newShopPassword.trim()
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShops([data.shop, ...shops]);
        setNewShopName('');
        setNewShopUsername('');
        setNewShopPassword('');
      } else {
        setError(data.error || 'Failed to create shop');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setIsCreating(false);
  };

  const showQRCode = async (shop: any) => {
    const baseUrl = typeof window !== 'undefined' && window.location.origin.includes('localhost') 
      ? 'https://scanitprintit.vercel.app' 
      : window.location.origin;
    const shopUrl = `${baseUrl}/s/${shop.slug}`;
    try {
      const dataUrl = await QRCode.toDataURL(shopUrl, { margin: 2, scale: 10, color: { dark: '#1a1915', light: '#ffffff' } });
      setQrModal({ open: true, url: dataUrl, name: shop.name, shopUrl });
    } catch {
      alert('Failed to generate QR code');
    }
  };

  return (
    <div className="page">
      {/* Topbar */}
      <nav className="topbar">
        <div className="container">
          <div className="topbar-inner">
            <span className="topbar-brand">PrintDesk</span>
            <span className="topbar-breadcrumb">
              <span>/</span> Platform Admin
            </span>
            <div className="topbar-actions">
              <a href="/api/auth/logout" className="btn btn-ghost btn-sm">Sign out</a>
            </div>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 36, paddingBottom: 60 }}>
        {/* Header */}
        <div className="fade-up" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>All Shops</h1>
          <p className="text-muted text-sm">Manage and onboard shops on the PrintDesk platform.</p>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Create Shop Form */}
          <div className="card fade-up delay-1" style={{ flex: '0 0 300px' }}>
            <div className="flex items-center gap-2 mb-4">
              <Plus size={16} color="var(--accent)" />
              <span className="font-semibold" style={{ fontSize: '0.95rem' }}>Onboard New Shop</span>
            </div>
            <form onSubmit={handleCreateShop} className="flex-col gap-4" style={{ display: 'flex' }}>
              <div className="field">
                <label className="label">Shop Name</label>
                <input
                  type="text"
                  className="input"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder="e.g. Ramesh Copy Centre"
                  required
                />
              </div>
              <div className="field">
                <label className="label">Owner Username</label>
                <input
                  type="text"
                  className="input"
                  value={newShopUsername}
                  onChange={(e) => setNewShopUsername(e.target.value)}
                  placeholder="e.g. ramesh_copy"
                  required
                />
              </div>
              <div className="field">
                <label className="label">Owner Password</label>
                <input
                  type="text"
                  className="input"
                  value={newShopPassword}
                  onChange={(e) => setNewShopPassword(e.target.value)}
                  placeholder="e.g. temp123"
                  required
                />
              </div>
              {error && (
                <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: '0.84rem' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <button className="btn btn-primary btn-full" type="submit" disabled={isCreating}>
                <Plus size={15} />
                {isCreating ? 'Creating...' : 'Create Shop'}
              </button>
            </form>
          </div>

          {/* Shops Table */}
          <div className="fade-up delay-2" style={{ flex: '1 1 500px', minWidth: 0 }}>
            {shops.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <Store size={32} color="var(--border-strong)" />
                  <p>No shops yet. Create your first shop.</p>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th>Owner Username</th>
                      <th>Status</th>
                      <th>Orders</th>
                      <th>Agent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shops.map((shop: any) => (
                      <tr key={shop.id}>
                        <td>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <a href={`/owner/${shop.id}`} className="font-medium" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{shop.name}</a>
                              {shop.isTestShop && <span className="badge badge-orange">TEST SHOP</span>}
                            </div>
                            <div className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                              <a href={`https://scanitprintit.vercel.app/s/${shop.slug}`} target="_blank" rel="noreferrer" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                                https://scanitprintit.vercel.app/s/{shop.slug}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td><span className="text-sm text-muted">{shop.user?.username || 'None'}</span></td>
                        <td><StatusBadge status={shop.status} /></td>
                        <td><span className="text-sm">{shop._count?.orders ?? 0}</span></td>
                        <td><AgentStatus agents={shop.agents} /></td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => showQRCode(shop)} title="View QR Code">
                              <QrCode size={14} />
                            </button>
                            <a href={`/owner/${shop.id}/settings`} className="btn btn-ghost btn-sm" title="Settings">
                              <Settings size={14} />
                            </a>
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

      {/* QR Modal */}
      {qrModal?.open && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 style={{ fontSize: '1.1rem' }}>{qrModal.name}</h2>
                <p className="text-xs text-muted mt-2" style={{ fontFamily: 'var(--font-mono)' }}>{qrModal.shopUrl}</p>
              </div>
              <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setQrModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center', marginBottom: 20 }}>
              <img src={qrModal.url} alt="QR Code" style={{ width: '100%', maxWidth: 240, display: 'block', margin: '0 auto' }} />
            </div>
            <div className="flex gap-3">
              <a href={qrModal.url} download={`${qrModal.name}_QR.png`} className="btn btn-primary flex-1" style={{ justifyContent: 'center' }}>
                <Download size={14} /> Download
              </a>
              <button className="btn btn-secondary flex-1" onClick={() => setQrModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
