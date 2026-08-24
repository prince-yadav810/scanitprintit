'use client';

import { useState } from 'react';
import { ArrowLeft, Cpu, RefreshCw, CheckCircle2, XCircle, Clock, Printer, AlertTriangle, ChevronRight, Settings } from 'lucide-react';

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    AWAITING_PAYMENT:  { cls: 'badge badge-blue',    label: 'Awaiting Payment' },
    AWAITING_APPROVAL: { cls: 'badge badge-orange',  label: 'Needs Approval' },
    PAID_QUEUED:       { cls: 'badge badge-blue',    label: 'Queued' },
    PRINTING:          { cls: 'badge badge-orange',  label: 'Printing' },
    PRINTED:           { cls: 'badge badge-green',   label: 'Printed' },
    NEEDS_ATTENTION:   { cls: 'badge badge-red',     label: 'Needs Attention' },
    CANCELLED:         { cls: 'badge badge-neutral', label: 'Cancelled' },
    CANCELLED_REFUNDED:{ cls: 'badge badge-neutral', label: 'Refunded' },
  };
  const c = config[status] || { cls: 'badge badge-neutral', label: status };
  return <span className={c.cls}>{c.label}</span>;
}

function updateOrderStatus(orderId: string, status: string) {
  return fetch(`/api/owner/orders/${orderId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export default function AdminShopUI({ shop, userRole }: { shop: any; userRole?: string }) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [orders, setOrders] = useState(shop.orders);
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);

  const generatePairingCode = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/owner/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: shop.id }),
      });
      const data = await res.json();
      if (data.success) setPairingCode(data.code);
      else alert(data.error || 'Failed');
    } catch {
      alert('Network error');
    }
    setIsGenerating(false);
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    setLoadingOrder(orderId);
    try {
      await updateOrderStatus(orderId, status);
      // Refresh from server
      window.location.reload();
    } catch {
      alert('Failed to update order');
    }
    setLoadingOrder(null);
  };

  const agentOnline = shop.agents?.length > 0 && shop.agents[0].status === 'ONLINE';

  return (
    <div className="page">
      {/* Topbar */}
      <nav className="topbar">
        <div className="container">
          <div className="topbar-inner">
            {userRole === 'PLATFORM_ADMIN' && (
              <a href="/admin" className="btn-back">
                <ArrowLeft size={16} /> Back to Platform Admin
              </a>
            )}
            <div className="topbar-breadcrumb">
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{shop.name}</span>
            </div>
            <div className="topbar-actions">
              <a href={`/owner/${shop.id}/settings`} className="btn btn-secondary btn-sm">
                <Settings size={14} /> Shop Settings
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 36, paddingBottom: 60 }}>
        {/* Header */}
        <div className="fade-up" style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>{shop.name}</h1>
          <p className="text-muted text-sm">Manage orders and your print agent.</p>
        </div>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Agent Panel */}
          <div className="card fade-up delay-1" style={{ flex: '0 0 280px' }}>
            <div className="flex items-center gap-2 mb-4" style={{ marginBottom: 20 }}>
              <Cpu size={16} color="var(--text-secondary)" />
              <span className="font-semibold" style={{ fontSize: '0.95rem' }}>Print Agent</span>
            </div>

            <div className="card-flat" style={{ marginBottom: 16 }}>
              <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Status</div>
              {shop.agents?.length > 0 ? (
                <span className={`agent-pill ${agentOnline ? 'badge-green' : 'badge-neutral'}`}>
                  <span className="agent-pill-dot" style={{ background: agentOnline ? 'var(--success)' : 'var(--border-strong)' }} />
                  {shop.agents[0].status}
                </span>
              ) : (
                <span className="text-sm text-muted">No agent paired</span>
              )}
            </div>

            {!pairingCode ? (
              <button className="btn btn-secondary btn-full" onClick={generatePairingCode} disabled={isGenerating}>
                <RefreshCw size={14} className={isGenerating ? 'spin' : ''} />
                {isGenerating ? 'Generating...' : 'Generate Pairing Code'}
              </button>
            ) : (
              <div>
                <p className="text-xs text-muted" style={{ marginBottom: 8 }}>Enter in Print Agent app:</p>
                <div className="pairing-code">{pairingCode}</div>
                <p className="text-xs text-muted mt-2" style={{ textAlign: 'center' }}>Expires in 15 minutes</p>
              </div>
            )}
          </div>

          {/* Orders Table */}
          <div style={{ flex: '1 1 520px', minWidth: 0 }} className="fade-up delay-2">
            <div className="section-title">Recent Orders</div>

            {orders.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <Printer size={28} color="var(--border-strong)" />
                  <p>No orders yet. Share your shop QR code to get started.</p>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Status</th>
                      <th>Pages</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order: any) => (
                      <tr key={order.id}>
                        <td>
                          <div className="font-medium text-sm">{order.orderNumber}</div>
                          {order.settings?.mode && (
                            <div className="text-xs text-muted">{order.settings.mode === 'COLOR' ? 'Color' : 'B&W'} · {order.settings.sides || 'Single'}</div>
                          )}
                        </td>
                        <td><StatusBadge status={order.status} /></td>
                        <td className="text-sm">{order.pageCount}</td>
                        <td className="font-medium text-sm">₹{order.totalAmount}</td>
                        <td>
                          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                            {order.status === 'AWAITING_APPROVAL' && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleStatusChange(order.id, 'PAID_QUEUED')}
                                disabled={loadingOrder === order.id}
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                            )}
                            {order.status === 'PRINTING' && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleStatusChange(order.id, 'PRINTED')}
                                disabled={loadingOrder === order.id}
                              >
                                <CheckCircle2 size={12} /> Mark Printed
                              </button>
                            )}
                            {order.status === 'NEEDS_ATTENTION' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleStatusChange(order.id, 'PAID_QUEUED')}
                                disabled={loadingOrder === order.id}
                              >
                                <RefreshCw size={12} /> Retry
                              </button>
                            )}
                            {['AWAITING_APPROVAL', 'PRINTING', 'PAID_QUEUED'].includes(order.status) && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                                disabled={loadingOrder === order.id}
                              >
                                <XCircle size={12} /> Cancel
                              </button>
                            )}
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
    </div>
  );
}
