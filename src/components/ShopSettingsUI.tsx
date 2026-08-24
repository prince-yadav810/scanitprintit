'use client';

import { useState } from 'react';
import { ArrowLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ShopSettingsUI({ shop }: { shop: any }) {
  const bwTier  = shop.pricingTiers?.find((t: any) => t.mode === 'BW')    || { pricePerPage: 5.0 };
  const colorTier = shop.pricingTiers?.find((t: any) => t.mode === 'COLOR') || { pricePerPage: 10.0 };

  const [autoPrint, setAutoPrint]   = useState(shop.autoPrintEnabled);
  const [simulation, setSimulation] = useState(shop.simulationEnabled || false);
  const [bwPrice, setBwPrice]       = useState(String(bwTier.pricePerPage));
  const [colorPrice, setColorPrice] = useState(String(colorTier.pricePerPage));
  const [isSaving, setIsSaving]     = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch(`/api/owner/shops/${shop.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoPrintEnabled: autoPrint,
          ...(shop.isTestShop ? { simulationEnabled: simulation } : {}),
          pricing: {
            BW: parseFloat(bwPrice),
            COLOR: parseFloat(colorPrice),
          },
        }),
      });
      const data = await res.json();
      if (data.success) setSaved(true);
      else setError(data.error || 'Failed to save');
    } catch {
      setError('Network error. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="page">
      {/* Topbar */}
      <nav className="topbar">
        <div className="container-sm" style={{ maxWidth: '100%', padding: '0 24px' }}>
          <div className="topbar-inner">
            <a href={`/owner/${shop.id}`} className="btn-back">
              <ArrowLeft size={14} /> {shop.name}
            </a>
            <div className="topbar-breadcrumb">
              <span>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Settings</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="container-sm" style={{ paddingTop: 36, paddingBottom: 60 }}>
        <div className="fade-up" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Shop Settings</h1>
          <p className="text-muted text-sm">Configure pricing and print preferences for {shop.name}.</p>
        </div>

        <form onSubmit={handleSave} className="fade-up delay-1" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Auto-Print Toggle */}
          <div className="card">
            <div className="section-title">Print Preferences</div>
            <label className="toggle-row" style={{ cursor: 'pointer' }} onClick={() => setAutoPrint(!autoPrint)}>
              <div>
                <div className="font-medium" style={{ fontSize: '0.95rem' }}>Auto-Print</div>
                <p className="text-sm text-muted mt-2">When enabled, paid jobs go directly to the print queue without manual approval.</p>
              </div>
              <label className="toggle" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={autoPrint} onChange={() => setAutoPrint(!autoPrint)} />
                <div className="toggle-track"></div>
                <div className="toggle-thumb"></div>
              </label>
            </label>

            {shop.isTestShop && (
              <label className="toggle-row" style={{ cursor: 'pointer', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }} onClick={() => setSimulation(!simulation)}>
                <div>
                  <div className="font-medium" style={{ fontSize: '0.95rem' }}>Simulated Printer Mode <span className="badge badge-orange" style={{ marginLeft: 8 }}>TEST ONLY</span></div>
                  <p className="text-sm text-muted mt-2">When enabled, the Windows Agent will intercept print jobs, save them as PDFs on the Desktop, and report them as SIMULATED_PRINTED without touching the physical printer spooler.</p>
                </div>
                <label className="toggle" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={simulation} onChange={() => setSimulation(!simulation)} />
                  <div className="toggle-track"></div>
                  <div className="toggle-thumb"></div>
                </label>
              </label>
            )}
          </div>

          {/* Pricing */}
          <div className="card">
            <div className="section-title">Pricing (₹ per page)</div>
            <div className="flex gap-4">
              <div className="field" style={{ flex: 1 }}>
                <label className="label">Black & White</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix">₹</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    value={bwPrice}
                    onChange={(e) => setBwPrice(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="label">Color</label>
                <div className="input-prefix-wrap">
                  <span className="input-prefix">₹</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    value={colorPrice}
                    onChange={(e) => setColorPrice(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2" style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2" style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={15} /> Settings saved successfully.
            </div>
          )}

          <button className="btn btn-primary btn-xl btn-full" type="submit" disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
