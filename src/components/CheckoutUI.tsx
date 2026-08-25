'use client';

import { useState, useEffect } from 'react';
import { FileText, Copy, CheckCircle2, Clock, Printer, Loader2, AlertCircle, CreditCard } from 'lucide-react';

/* ─── Cashfree JS SDK types ─────────────────────────────────────────── */
declare global {
  interface Window {
    Cashfree?: (config: { mode: string }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget?: string }) => Promise<{ error?: any; paymentDetails?: any }>;
    };
  }
}

function loadCashfreeSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('cashfree-sdk')) { resolve(); return; }
    const script = document.createElement('script');
    script.id  = 'cashfree-sdk';
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload  = () => resolve();
    script.onerror = () => reject(new Error('Cashfree SDK failed to load'));
    document.head.appendChild(script);
  });
}

/* ─── Status display ────────────────────────────────────────────────── */
function StatusBlock({ status }: { status: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; sublabel: string; color: string; bg: string }> = {
    AWAITING_PAYMENT:  { icon: <CreditCard size={20} />,    label: 'Payment Required',   sublabel: 'Complete your payment below to proceed.',        color: 'var(--accent)',   bg: 'rgba(217,119,87,0.08)' },
    AWAITING_APPROVAL: { icon: <Clock size={20} />,         label: 'Awaiting Approval',  sublabel: 'The shop owner will review your order shortly.', color: 'var(--warning)',  bg: 'var(--warning-bg)' },
    PAID_QUEUED:       { icon: <Printer size={20} />,       label: 'Queued for Print',   sublabel: 'Your files are in the print queue.',             color: 'var(--info)',     bg: 'var(--info-bg)' },
    PRINTING:          { icon: <Printer size={20} />,       label: 'Printing Now',       sublabel: 'Your document is being printed right now.',      color: 'var(--warning)',  bg: 'var(--warning-bg)' },
    PRINTED:           { icon: <CheckCircle2 size={20} />,  label: 'Ready to Collect',   sublabel: 'Your prints are ready. Please visit the counter.',color: 'var(--success)', bg: 'var(--success-bg)' },
    NEEDS_ATTENTION:   { icon: <AlertCircle size={20} />,   label: 'Needs Attention',    sublabel: 'Please visit the counter for assistance.',       color: 'var(--warning)',  bg: 'var(--warning-bg)' },
    CANCELLED:         { icon: <AlertCircle size={20} />,   label: 'Cancelled',          sublabel: 'This order has been cancelled.',                 color: 'var(--danger)',   bg: 'var(--danger-bg)' },
    CANCELLED_REFUNDED:{ icon: <AlertCircle size={20} />,   label: 'Cancelled & Refunded',sublabel: 'This order has been cancelled and refunded.',   color: 'var(--danger)',   bg: 'var(--danger-bg)' },
  };
  const c = config[status] ?? config['AWAITING_PAYMENT'];
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '16px 18px', background: c.bg, borderRadius: 'var(--radius-md)', color: c.color }}>
      <div style={{ marginTop: 1 }}>{c.icon}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{c.label}</div>
        <div style={{ fontSize: '0.84rem', marginTop: 3, opacity: 0.8 }}>{c.sublabel}</div>
      </div>
    </div>
  );
}

/* ─── Main component ────────────────────────────────────────────────── */
export default function CheckoutUI({ order }: { order: any }) {
  const [status,      setStatus]      = useState(order.status);
  const [copied,      setCopied]      = useState(false);
  const [paying,      setPaying]      = useState(false);
  const [payError,    setPayError]    = useState('');
  const [customerName, setCustomerName] = useState(order.customerName ?? '');
  const [nameSaved,   setNameSaved]   = useState(!!order.customerName);

  // Poll status from server every 5s while order is not terminal
  const isTerminal = ['PRINTED', 'SIMULATED_PRINTED', 'CANCELLED', 'CANCELLED_REFUNDED', 'EXPIRED'].includes(status);
  
  const checkStatus = async () => {
    const res  = await fetch(`/api/orders/${order.id}/status`);
    if (res.ok) {
      const data = await res.json();
      if (data.status) setStatus(data.status);
    }
  };

  useEffect(() => {
    if (isTerminal) return;
    // Check immediately on mount (catches the payment redirect instantly)
    checkStatus();
    const id = setInterval(checkStatus, 5000);
    return () => clearInterval(id);
  }, [order.id, isTerminal]);

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePay = async () => {
    if (!customerName.trim()) {
      setPayError('Please enter your name before paying.');
      return;
    }
    setPaying(true);
    setPayError('');
    try {
      // 1. Load Cashfree JS
      await loadCashfreeSDK();

      // 2. Create payment session (also saves the customer name)
      const res  = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, customerName: customerName.trim() }),
      });
      const data = await res.json();

      // 409 = order already paid (fallback updated it before this click)
      if (res.status === 409 && data.error?.includes('already been paid')) {
        // Refresh status from server — the order moved to PAID_QUEUED/AWAITING_APPROVAL
        const statusRes = await fetch(`/api/orders/${order.id}/status`);
        if (statusRes.ok) {
          const sd = await statusRes.json();
          if (sd.status) setStatus(sd.status);
        }
        setPaying(false);
        return;
      }

      if (!res.ok || !data.payment_session_id) {
        setPayError(data.error || 'Could not initiate payment. Please try again.');
        setPaying(false);
        return;
      }

      // 3. Open Cashfree checkout (redirect-based)
      const mode     = process.env.NEXT_PUBLIC_CASHFREE_ENV === 'PRODUCTION' ? 'production' : 'sandbox';
      const cashfree = window.Cashfree!({ mode });
      const result   = await cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: '_self' });

      if (result.error) {
        setPayError(result.error.message || 'Payment failed. Please try again.');
      }
    } catch (err: any) {
      setPayError(err.message || 'Unexpected error. Please try again.');
    }
    setPaying(false);
  };

  const showPayButton = status === 'AWAITING_PAYMENT';

  return (
    <div className="page">
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
        <div className="container-sm">
          <div className="font-semibold" style={{ fontSize: '0.95rem' }}>{order.shop.name}</div>
          <div className="text-xs text-muted">Order summary</div>
        </div>
      </div>

      <div className="container-sm" style={{ paddingTop: 28, paddingBottom: showPayButton ? 104 : 60 }}>

        {/* Order number */}
        <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)', background: 'var(--bg-muted)', padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
            #{order.orderNumber}
          </div>
          <button className="btn btn-ghost" style={{ padding: 6, color: 'var(--text-placeholder)' }} onClick={copyOrderNumber}>
            {copied ? <CheckCircle2 size={14} color="var(--success)" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Status */}
        <div className="fade-up delay-1" style={{ marginBottom: 24 }}>
          <StatusBlock status={status} />
        </div>

        {/* Summary */}
        <div className="card fade-up delay-2">
          <div className="section-title">Order Details</div>
          <div className="summary-row">
            <span className="summary-label">Shop</span>
            <span className="summary-value">{order.shop.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Files</span>
            <span className="summary-value">{order.files.length} {order.files.length === 1 ? 'file' : 'files'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Print Mode</span>
            <span className="summary-value">{order.settings?.mode === 'COLOR' ? 'Color' : 'Black & White'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Layout</span>
            <span className="summary-value">{order.settings?.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Copies</span>
            <span className="summary-value">{order.settings?.copies ?? 1}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Pages</span>
            <span className="summary-value">{order.pageCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Total</span>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em' }}>₹{Number(order.totalAmount).toFixed(2)}</span>
          </div>
        </div>

        {/* File list */}
        {order.files.length > 0 && (
          <div className="fade-up delay-3" style={{ marginTop: 24 }}>
            <div className="section-title">Files</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.files.map((f: any, i: number) => (
                <div key={i} className="file-item">
                  <FileText size={15} color="var(--text-secondary)" />
                  <span className="file-item-name">{f.originalName}</span>
                  <span className="file-item-meta">{f.pages ?? '?'} pg</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky payment bar */}
      {showPayButton && (
        <div className="price-bar">
          <div className="price-bar-inner" style={{ flexDirection: 'column', gap: 10 }}>
            {/* Name input */}
            <div style={{ width: '100%' }}>
              <input
                type="text"
                placeholder="Your name (for pickup verification)"
                value={customerName}
                onChange={e => { setCustomerName(e.target.value); setNameSaved(false); }}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)', background: 'var(--bg-muted)',
                  color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                }}
              />
            </div>
            {payError && (
              <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: '0.84rem', width: '100%' }}>
                <AlertCircle size={14} /> {payError}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
              <div>
                <div className="price-amount">₹{Number(order.totalAmount).toFixed(2)}</div>
                <div className="price-label">Total due</div>
              </div>
              <button
                className="btn btn-primary btn-xl flex-1"
                style={{ flex: 1 }}
                onClick={handlePay}
                disabled={paying}
              >
                {paying
                  ? <><Loader2 size={15} className="spin" /> Processing…</>
                  : <><CreditCard size={15} /> Pay via UPI / Card</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
