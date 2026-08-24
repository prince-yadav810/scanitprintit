'use client';

import { ArrowRight, Printer, QrCode, Zap } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '24px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 600, fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>PrintDesk</div>
        <div>
          <Link href="/login" className="btn btn-secondary btn-sm" style={{ fontWeight: 500 }}>Shop Login</Link>
        </div>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 24px', textAlign: 'center' }}>
        <div className="fade-up" style={{ maxWidth: 800 }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '100px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 32 }}>
            The Modern Print Shop Experience
          </div>
          <h1 style={{ fontSize: 'clamp(3rem, 6vw, 4.5rem)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, color: 'var(--text-primary)', marginBottom: 24 }}>
            Scan. Upload. <br/><span style={{ color: 'var(--accent)' }}>Print Instantly.</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 48px', lineHeight: 1.6 }}>
            No more pen drives. No more WhatsApp web. Just scan the QR code at any PrintDesk partner shop and get your documents instantly.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link href="/login" className="btn btn-primary btn-xl" style={{ gap: 8, padding: '0 32px' }}>
              Partner With Us <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 120, maxWidth: 1000, width: '100%' }}>
          {[
            { icon: QrCode, title: 'Scan to Start', desc: 'Scan the unique QR code at your local print shop to open the secure portal instantly.' },
            { icon: Zap, title: 'Upload & Pay', desc: 'Select your files, choose your print settings, and pay directly from your phone.' },
            { icon: Printer, title: 'Auto Print', desc: 'Your document prints automatically. Grab it and go without waiting in line.' }
          ].map((feature, i) => (
            <div key={i} style={{ padding: 32, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', textAlign: 'left', transition: 'all 0.2s ease', cursor: 'default' }}
                 onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                 onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                <feature.icon size={24} color="var(--text-primary)" />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>{feature.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer style={{ padding: '40px 24px', textAlign: 'center', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <p>© {new Date().getFullYear()} PrintDesk. All rights reserved.</p>
      </footer>
    </div>
  );
}
