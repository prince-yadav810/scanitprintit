import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ScanItPrintIt — Smart Print Automation for Xerox & Copy Shops',
  description:
    'Run your print shop smarter. Customers scan your QR code, upload files from their phone, pay online — your printer does the rest automatically. No pen drives. No WhatsApp mess. ₹299/month.',
  keywords:
    'print shop automation, xerox shop software India, QR se print, print shop QR code, scan and print India, copy shop software, auto print agent',
  openGraph: {
    title: 'ScanItPrintIt — Smart Print Automation for Xerox & Copy Shops',
    description:
      'Customers scan QR → upload → pay → auto print. Built for Indian copy shops. ₹299/month, zero revenue cut.',
    url: 'https://www.scanitprintit.in',
    siteName: 'ScanItPrintIt',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        :root {
          --bg:        #FAFAF8;
          --paper:     #FFFFFF;
          --ink:       #1A1915;
          --ink2:      #3D3B35;
          --muted:     #6B6860;
          --muted2:    #9CA3AF;
          --amber:     #D97706;
          --amber-dk:  #B45309;
          --amber-lt:  #FEF3C7;
          --border:    #E8E5DE;
          --border2:   #F0EDE8;
          --serif:     'Instrument Serif', Georgia, serif;
          --sans:      'DM Sans', -apple-system, sans-serif;
        }

        body {
          font-family: var(--sans);
          background: var(--bg);
          color: var(--ink);
          line-height: 1.6;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* ── Grid background ── */
        .grid-bg {
          position: relative;
        }
        .grid-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          z-index: 0;
          background-image:
            linear-gradient(rgba(26,25,21,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(26,25,21,0.04) 1px, transparent 1px);
          background-size: 72px 72px;
          pointer-events: none;
        }

        /* ── Nav ── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 clamp(20px, 4vw, 48px); height: 64px;
          background: rgba(250,250,248,0.82);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid var(--border);
          transition: box-shadow 0.3s;
        }
        .nav-brand {
          display: flex; align-items: center; gap: 10px;
          text-decoration: none; color: var(--ink);
        }
        .nav-wordmark {
          font-family: var(--sans); font-size: 1.05rem; font-weight: 700;
          letter-spacing: -0.03em; color: var(--ink);
        }
        .nav-wordmark span { color: var(--amber); }
        .nav-right { display: flex; align-items: center; gap: 12px; }
        .nav-links { display: flex; align-items: center; gap: 24px; list-style: none; }
        .nav-links a {
          text-decoration: none; color: var(--muted);
          font-size: 0.9rem; font-weight: 500;
          transition: color 0.15s;
        }
        .nav-links a:hover { color: var(--ink); }
        .btn-nav {
          height: 36px; padding: 0 16px; border-radius: 8px;
          background: var(--ink); color: var(--bg);
          font-size: 0.875rem; font-weight: 600;
          text-decoration: none; display: inline-flex; align-items: center;
          transition: background 0.15s;
        }
        .btn-nav:hover { background: var(--amber-dk); }
        .btn-nav-ghost {
          height: 36px; padding: 0 14px; border-radius: 8px;
          border: 1px solid var(--border); color: var(--ink2);
          font-size: 0.875rem; font-weight: 500; text-decoration: none;
          display: inline-flex; align-items: center;
          transition: all 0.15s;
        }
        .btn-nav-ghost:hover { border-color: var(--ink); color: var(--ink); }

        /* ── Hero ── */
        .hero {
          min-height: 100svh;
          display: flex; flex-direction: column; justify-content: center;
          padding: 100px clamp(20px, 6vw, 80px) 80px;
          position: relative; overflow: hidden;
        }
        .hero-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 14px; border-radius: 100px;
          background: var(--amber-lt); border: 1px solid #FDE68A;
          font-size: 0.78rem; font-weight: 600; color: #92400E;
          margin-bottom: 32px; width: fit-content;
          animation: fadeUp 0.6s ease both;
        }
        .hero-pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #D97706; animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .hero-h1 {
          font-family: var(--serif);
          font-size: clamp(3.2rem, 7vw, 5.5rem);
          font-weight: 400; line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--ink); margin-bottom: 24px;
          max-width: 14ch;
          animation: fadeUp 0.7s 0.1s ease both;
        }
        .hero-h1 em {
          font-style: italic; color: var(--amber);
        }
        .hero-sub {
          font-size: clamp(1.05rem, 1.8vw, 1.2rem);
          color: var(--muted); line-height: 1.65;
          max-width: 42ch; margin-bottom: 40px;
          animation: fadeUp 0.7s 0.2s ease both;
        }
        .hero-actions {
          display: flex; gap: 12px; flex-wrap: wrap;
          animation: fadeUp 0.7s 0.3s ease both;
          margin-bottom: 72px;
        }
        .btn-primary {
          height: 50px; padding: 0 28px; border-radius: 12px;
          background: var(--ink); color: var(--bg);
          font-size: 1rem; font-weight: 600; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s; border: none; cursor: pointer;
        }
        .btn-primary:hover { background: var(--amber-dk); transform: translateY(-1px); }
        .btn-ghost {
          height: 50px; padding: 0 24px; border-radius: 12px;
          border: 1px solid var(--border); color: var(--ink2);
          font-size: 1rem; font-weight: 500; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s; background: var(--paper);
        }
        .btn-ghost:hover { border-color: var(--ink); color: var(--ink); transform: translateY(-1px); }

        .hero-proof {
          display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
          animation: fadeUp 0.7s 0.4s ease both;
        }
        .hero-proof-item {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.875rem; color: var(--muted);
        }
        .hero-proof-item svg { color: var(--amber); flex-shrink: 0; }
        .hero-divider { width: 1px; height: 16px; background: var(--border); }

        /* big decorative number */
        .hero-deco {
          position: absolute; right: clamp(20px, 8vw, 120px); top: 50%;
          transform: translateY(-50%);
          font-family: var(--serif);
          font-size: clamp(200px, 28vw, 380px);
          font-style: italic; font-weight: 400;
          color: transparent;
          -webkit-text-stroke: 1px rgba(26,25,21,0.06);
          line-height: 1; user-select: none; pointer-events: none;
          animation: fadeUp 1.2s 0.5s ease both;
        }

        /* ── How it works ── */
        .section {
          padding: clamp(80px, 12vw, 120px) clamp(20px, 6vw, 80px);
          position: relative;
        }
        .section-inner { max-width: 1200px; margin: 0 auto; }
        .kicker {
          font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--amber); margin-bottom: 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .kicker::before {
          content: '';
          display: inline-block; width: 24px; height: 1.5px;
          background: var(--amber);
        }
        .section-h2 {
          font-family: var(--serif);
          font-size: clamp(2rem, 4vw, 3.2rem);
          font-weight: 400; letter-spacing: -0.02em;
          line-height: 1.1; color: var(--ink);
          margin-bottom: 14px;
        }
        .section-lead {
          color: var(--muted); font-size: 1.05rem; max-width: 44ch; line-height: 1.7;
        }

        /* Steps — horizontal on desktop, vertical on mobile */
        .steps-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-top: 56px;
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          background: var(--paper);
        }
        .step-card {
          padding: 32px 28px;
          border-right: 1px solid var(--border);
          position: relative;
          transition: background 0.2s;
        }
        .step-card:last-child { border-right: none; }
        .step-card:hover { background: #FAFAF8; }
        .step-num {
          font-family: var(--serif);
          font-size: 2.8rem; font-style: italic; font-weight: 400;
          color: rgba(26,25,21,0.08); line-height: 1;
          margin-bottom: 16px;
        }
        .step-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: var(--amber-lt); border: 1px solid #FDE68A;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px; font-size: 18px;
        }
        .step-title { font-size: 1rem; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
        .step-desc { font-size: 0.9rem; color: var(--muted); line-height: 1.6; }
        .step-arrow {
          position: absolute; right: -14px; top: 50%;
          transform: translateY(-50%);
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--border); border: 2px solid var(--bg);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: var(--muted); z-index: 2;
        }
        .step-card:last-child .step-arrow { display: none; }

        /* ── Two sides: customer vs. shop ── */
        .two-col {
          display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
          margin-top: 56px;
        }
        .side-card {
          border: 1px solid var(--border); border-radius: 20px;
          padding: 40px 36px; background: var(--paper);
          transition: box-shadow 0.2s;
        }
        .side-card:hover { box-shadow: 0 8px 40px rgba(26,25,21,0.07); }
        .side-card-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; margin-bottom: 20px;
          display: inline-block; padding: 4px 10px; border-radius: 6px;
        }
        .side-card-label.customer { background: #DBEAFE; color: #1D4ED8; }
        .side-card-label.shop { background: var(--amber-lt); color: #92400E; }
        .side-card h3 {
          font-family: var(--serif); font-size: 1.7rem; font-weight: 400;
          line-height: 1.2; margin-bottom: 14px; color: var(--ink);
        }
        .side-card p { color: var(--muted); font-size: 0.95rem; line-height: 1.7; margin-bottom: 20px; }
        .checklist { list-style: none; display: grid; gap: 10px; }
        .checklist li {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 0.9rem; color: var(--ink2); line-height: 1.5;
        }
        .checklist li::before {
          content: '✓';
          flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%;
          background: #DCFCE7; color: #15803D;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; margin-top: 1px;
        }

        /* ── Why us — reasons strip ── */
        .reasons-grid {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px; background: var(--border);
          border: 1px solid var(--border); border-radius: 16px;
          overflow: hidden; margin-top: 56px;
        }
        .reason {
          background: var(--paper); padding: 36px 32px;
          transition: background 0.2s;
        }
        .reason:hover { background: var(--bg); }
        .reason-icon { font-size: 28px; margin-bottom: 16px; }
        .reason h3 {
          font-size: 1.05rem; font-weight: 700; color: var(--ink);
          margin-bottom: 8px;
        }
        .reason p { font-size: 0.9rem; color: var(--muted); line-height: 1.65; }

        /* ── Pricing ── */
        .pricing-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 20px; margin-top: 56px; max-width: 760px;
        }
        .price-card {
          border: 1px solid var(--border); border-radius: 20px;
          padding: 36px 32px; background: var(--paper);
          position: relative; transition: all 0.2s;
        }
        .price-card:hover { box-shadow: 0 8px 40px rgba(26,25,21,0.08); transform: translateY(-2px); }
        .price-card.featured {
          background: var(--ink); border-color: var(--ink); color: var(--bg);
        }
        .price-badge {
          position: absolute; top: -12px; left: 24px;
          background: var(--amber); color: #fff;
          font-size: 0.72rem; font-weight: 700;
          padding: 3px 10px; border-radius: 20px;
        }
        .price-label { font-size: 0.8rem; font-weight: 600; color: var(--muted2); margin-bottom: 8px; }
        .price-card.featured .price-label { color: rgba(250,250,248,0.6); }
        .price-amount {
          font-family: var(--serif);
          font-size: 3rem; font-style: italic;
          color: var(--ink); line-height: 1; margin-bottom: 4px;
        }
        .price-card.featured .price-amount { color: var(--bg); }
        .price-period {
          font-size: 0.85rem; color: var(--muted);
          margin-bottom: 24px;
        }
        .price-card.featured .price-period { color: rgba(250,250,248,0.6); }
        .price-features { list-style: none; display: grid; gap: 10px; margin-bottom: 28px; }
        .price-features li {
          font-size: 0.9rem; color: var(--ink2);
          display: flex; align-items: center; gap: 8px;
        }
        .price-card.featured .price-features li { color: rgba(250,250,248,0.85); }
        .price-features li::before {
          content: '✓'; font-size: 10px; font-weight: 700;
          width: 18px; height: 18px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          background: #DCFCE7; color: #15803D;
        }
        .price-card.featured .price-features li::before {
          background: rgba(255,255,255,0.15); color: #fff;
        }
        .btn-price {
          width: 100%; height: 44px; border-radius: 10px;
          font-size: 0.9rem; font-weight: 600; border: none; cursor: pointer;
          text-decoration: none; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .btn-price-dark {
          background: var(--ink); color: var(--bg);
        }
        .btn-price-dark:hover { background: var(--amber-dk); }
        .btn-price-light {
          background: var(--bg); color: var(--ink);
          border: 1px solid rgba(250,250,248,0.25);
        }
        .btn-price-light:hover { background: rgba(250,250,248,0.12); }

        /* ── FAQ ── */
        .faq-list { margin-top: 48px; max-width: 780px; }
        .faq-item { border-bottom: 1px solid var(--border); }
        .faq-item summary {
          cursor: pointer; list-style: none;
          padding: 20px 0; font-size: 1rem; font-weight: 600;
          color: var(--ink); display: flex; justify-content: space-between;
          align-items: center; gap: 16px;
        }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after {
          content: '+'; font-size: 1.4rem; font-weight: 300;
          color: var(--muted); flex-shrink: 0; transition: transform 0.2s;
        }
        .faq-item[open] summary::after { transform: rotate(45deg); }
        .faq-body {
          padding: 0 0 20px; color: var(--muted);
          font-size: 0.95rem; line-height: 1.7; max-width: 56ch;
        }

        /* ── CTA band ── */
        .cta-band {
          background: var(--ink);
          padding: clamp(72px, 10vw, 100px) clamp(20px, 6vw, 80px);
          position: relative; overflow: hidden;
        }
        .cta-band::before {
          content: '';
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .cta-inner { max-width: 1200px; margin: 0 auto; position: relative; z-index: 1; }
        .cta-h2 {
          font-family: var(--serif);
          font-size: clamp(2.4rem, 5vw, 4rem);
          font-weight: 400; line-height: 1.1;
          color: var(--bg); margin-bottom: 14px;
        }
        .cta-h2 em { font-style: italic; color: #FDE68A; }
        .cta-sub { color: rgba(250,250,248,0.65); font-size: 1.05rem; margin-bottom: 36px; max-width: 42ch; }
        .btn-cta {
          height: 52px; padding: 0 32px; border-radius: 12px;
          background: var(--amber); color: var(--ink);
          font-size: 1rem; font-weight: 700;
          text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s;
        }
        .btn-cta:hover { background: #F59E0B; transform: translateY(-1px); }
        .btn-cta-ghost {
          height: 52px; padding: 0 28px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.2); color: rgba(250,250,248,0.85);
          font-size: 1rem; font-weight: 500;
          text-decoration: none; display: inline-flex; align-items: center; gap: 8px;
          transition: all 0.2s;
        }
        .btn-cta-ghost:hover { border-color: rgba(255,255,255,0.5); color: #fff; }
        .cta-actions { display: flex; gap: 12px; flex-wrap: wrap; }

        /* ── Footer ── */
        footer {
          background: var(--paper);
          border-top: 1px solid var(--border);
          padding: 40px clamp(20px, 6vw, 80px);
        }
        .footer-inner {
          max-width: 1200px; margin: 0 auto;
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 16px;
        }
        .footer-brand {
          font-weight: 700; font-size: 1rem;
          color: var(--ink); text-decoration: none;
        }
        .footer-brand span { color: var(--amber); }
        .footer-copy { font-size: 0.85rem; color: var(--muted2); }
        .footer-links { display: flex; gap: 20px; }
        .footer-links a {
          font-size: 0.85rem; color: var(--muted);
          text-decoration: none; font-weight: 500;
          transition: color 0.15s;
        }
        .footer-links a:hover { color: var(--ink); }

        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: none; }
        }
        .reveal {
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .reveal.visible { opacity: 1; transform: none; }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .nav-links { display: none; }
          .steps-grid { grid-template-columns: 1fr 1fr; }
          .step-card { border-right: none; border-bottom: 1px solid var(--border); }
          .step-card:nth-child(odd) { border-right: 1px solid var(--border); }
          .step-card:nth-last-child(-n+2) { border-bottom: none; }
          .step-arrow { display: none; }
          .two-col { grid-template-columns: 1fr; }
          .reasons-grid { grid-template-columns: 1fr 1fr; }
          .pricing-grid { grid-template-columns: 1fr; max-width: 440px; }
          .hero-deco { display: none; }
        }
        @media (max-width: 600px) {
          .steps-grid { grid-template-columns: 1fr; }
          .step-card { border-right: none; border-bottom: 1px solid var(--border); }
          .step-card:nth-child(odd) { border-right: none; }
          .reasons-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Nav ── */}
      <nav className="nav">
        <a href="/" className="nav-brand">
          <img src="/icon.png" alt="" style={{ height: 28 }} onError={(e: any) => (e.currentTarget.style.display = 'none')} />
          <span className="nav-wordmark">ScanIt<span>PrintIt</span></span>
        </a>
        <ul className="nav-links">
          <li><a href="#how">How it works</a></li>
          <li><a href="#why">Why us</a></li>
          <li><a href="#pricing">Pricing</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
        <div className="nav-right">
          <a href="/login" className="btn-nav-ghost">Shop Login</a>
          <a href="#pricing" className="btn-nav">Get Started →</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="hero grid-bg">
        <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
          <div className="hero-pill">
            <span className="hero-pill-dot" />
            Built for Indian copy shops & cyber cafes
          </div>

          <h1 className="hero-h1">
            Your printer.<br />
            <em>Smarter</em> queue.<br />
            Zero pen drives.
          </h1>

          <p className="hero-sub">
            Customers scan your QR code, upload files from their phone, and pay online.
            Your Windows PC prints automatically — no WhatsApp, no USB, no staff needed at the keyboard.
          </p>

          <div className="hero-actions">
            <a href="#pricing" className="btn-primary">
              Start Free Trial →
            </a>
            <a href="#how" className="btn-ghost">
              See how it works
            </a>
          </div>

          <div className="hero-proof">
            <div className="hero-proof-item">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm10.293 4.293a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L6.5 8.586l4.293-4.293a1 1 0 0 1 1.414 0z"/></svg>
              No app install for customers
            </div>
            <div className="hero-divider" />
            <div className="hero-proof-item">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm10.293 4.293a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L6.5 8.586l4.293-4.293a1 1 0 0 1 1.414 0z"/></svg>
              Works with your existing printer
            </div>
            <div className="hero-divider" />
            <div className="hero-proof-item">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm10.293 4.293a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L6.5 8.586l4.293-4.293a1 1 0 0 1 1.414 0z"/></svg>
              100% revenue stays with you
            </div>
            <div className="hero-divider" />
            <div className="hero-proof-item">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2zm10.293 4.293a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L6.5 8.586l4.293-4.293a1 1 0 0 1 1.414 0z"/></svg>
              ₹299 / month
            </div>
          </div>
        </div>

        {/* Decorative large italic number */}
        <div className="hero-deco" aria-hidden="true">∞</div>
      </header>

      {/* ── How it works ── */}
      <section className="section" id="how" style={{ background: '#FFFFFF' }}>
        <div className="section-inner">
          <div className="kicker reveal">How it works</div>
          <h2 className="section-h2 reveal">From phone to paper in 60 seconds.</h2>
          <p className="section-lead reveal">No app. No USB. No shouting file names across the counter.</p>

          <div className="steps-grid reveal">
            {[
              { n: '01', icon: '📱', title: 'Customer scans the QR', desc: "Your shop's QR code is on the counter. Customer scans it with any phone camera — opens instantly in the browser." },
              { n: '02', icon: '📄', title: 'Upload & pick options', desc: 'Choose B&W or colour, number of copies, single or double-sided. Files go securely over the internet.' },
              { n: '03', icon: '💳', title: 'Pay online', desc: 'UPI, card, or cash at counter — your choice. Payment goes straight to your account. We take zero cut.' },
              { n: '04', icon: '🖨️', title: 'Printer goes brr', desc: 'Your Windows PC gets the job automatically and prints. Files are deleted right after. Staff just hands it over.' },
            ].map((s, i) => (
              <div className="step-card" key={i}>
                <div className="step-num">{s.n}</div>
                <div className="step-icon">{s.icon}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
                {i < 3 && <div className="step-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two perspectives ── */}
      <section className="section grid-bg" id="for-who">
        <div className="section-inner">
          <div className="kicker reveal">Who benefits</div>
          <h2 className="section-h2 reveal">Better for customers. <br />Way better for you.</h2>
          <div className="two-col">
            <div className="side-card reveal">
              <span className="side-card-label customer">For your customers</span>
              <h3>No more "send on WhatsApp"</h3>
              <p>
                Customers walk in, scan the QR on your counter, and upload directly from their own phone.
                No waiting. No sharing their private number with a stranger. No USB drama.
              </p>
              <ul className="checklist">
                <li>No app download, no sign-up required</li>
                <li>Upload PDFs, Word docs, photos from phone</li>
                <li>Choose B&W or colour, copies, sides</li>
                <li>Pay via UPI online or cash at counter</li>
                <li>File auto-deleted after printing for privacy</li>
              </ul>
            </div>
            <div className="side-card reveal">
              <span className="side-card-label shop">For shop owners</span>
              <h3>Run more jobs, less chaos</h3>
              <p>
                Your staff stays free to cut, bind, and handle walk-ins.
                The print queue handles itself. No more transferring files manually on your PC.
              </p>
              <ul className="checklist">
                <li>Works with any printer on your existing Windows PC</li>
                <li>Agent dashboard — see live queue, revenue, history</li>
                <li>Auto-print or approve manually — your choice</li>
                <li>Customers pay directly into your account</li>
                <li>Set your own per-page price (B&W / colour)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="section" id="why" style={{ background: '#FFFFFF' }}>
        <div className="section-inner">
          <div className="kicker reveal">Why ScanItPrintIt</div>
          <h2 className="section-h2 reveal">The print shop upgrade<br />that pays for itself.</h2>
          <p className="section-lead reveal">
            Compare us to buying a kiosk (₹3–5 lakh) or doing it all on WhatsApp (slow, messy, no records).
          </p>
          <div className="reasons-grid reveal">
            {[
              { icon: '🖨️', title: 'Use your existing printer', desc: "No new hardware. If your printer is connected to Windows, it works with ScanItPrintIt. We install a small background agent — nothing more." },
              { icon: '💰', title: 'Zero revenue share', desc: "₹299/month flat. Not per-print, not a percentage. Customer payment lands in your Cashfree account — we never touch it." },
              { icon: '⚡', title: 'Staff off the computer', desc: "Customers set all options themselves on their phone. Your team stays free for finishing, cutting, and actual customer service." },
              { icon: '🔒', title: 'Files deleted after print', desc: "Documents are stored only long enough to print, then wiped. We don't keep customer files. Privacy by design." },
              { icon: '📊', title: 'Real-time revenue tracking', desc: "See today's jobs, earnings, and order history from your owner dashboard — or from the agent window on your counter PC." },
              { icon: '⏱️', title: 'Setup in under 2 minutes', desc: "Register your shop online, install the Windows agent, paste the pairing code. Done. Your QR is ready to stick on the counter." },
            ].map((r, i) => (
              <div className="reason reveal" key={i}>
                <div className="reason-icon">{r.icon}</div>
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="section grid-bg" id="pricing">
        <div className="section-inner">
          <div className="kicker reveal">Pricing</div>
          <h2 className="section-h2 reveal">Simple, honest pricing.</h2>
          <p className="section-lead reveal">
            No per-print fees. No setup charges. No revenue share. Pick the plan that fits your shop.
          </p>
          <div className="pricing-grid">
            <div className="price-card reveal">
              <p className="price-label">Monthly</p>
              <div className="price-amount">₹299</div>
              <p className="price-period">per month, billed monthly</p>
              <ul className="price-features">
                <li>Unlimited print jobs</li>
                <li>1 printer / 1 Windows PC</li>
                <li>QR upload + online payment</li>
                <li>Owner & agent dashboard</li>
                <li>Revenue analytics</li>
                <li>Email support</li>
              </ul>
              <a href="/login" className="btn-price btn-price-dark">Get started →</a>
            </div>
            <div className="price-card featured reveal" style={{ position: 'relative' }}>
              <div className="price-badge">Best value</div>
              <p className="price-label">Annual</p>
              <div className="price-amount">₹2,000</div>
              <p className="price-period">per year · saves ₹1,588</p>
              <ul className="price-features">
                <li>Everything in Monthly</li>
                <li>Priority support</li>
                <li>Early access to new features</li>
                <li>Dedicated setup call</li>
                <li>₹167/month effective rate</li>
              </ul>
              <a href="/login" className="btn-price btn-price-light">Get started →</a>
            </div>
          </div>
          <p style={{ marginTop: 20, fontSize: '0.85rem', color: 'var(--muted2)' }}>
            🎁 Free trial available · No credit card needed to start
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="section" id="faq" style={{ background: '#FFFFFF' }}>
        <div className="section-inner">
          <div className="kicker reveal">FAQ</div>
          <h2 className="section-h2 reveal">Common questions.</h2>
          <div className="faq-list reveal">
            {[
              ['Do I need to buy a new printer or kiosk?', 'No. ScanItPrintIt runs a small agent on the Windows PC that\'s already connected to your copier or printer. No new hardware required.'],
              ['Does the customer need to download an app?', 'Absolutely not. Customers open your shop\'s upload page directly in any phone browser — just like opening a website. No Play Store, no sign-up.'],
              ['Who receives the payment?', 'You do — directly. Online payments go to your Cashfree account. We never handle or route customer money and take zero cut per print.'],
              ['Can customers still pay cash?', 'Yes. You choose the payment mode: online only, cash at counter, or both. It\'s per-shop configurable from your settings.'],
              ['What happens to the customer\'s file after printing?', 'Files are transferred securely over HTTPS, printed, and then deleted automatically. We do not store documents.'],
              ['How long does setup take?', 'About 2 minutes: register your shop, install the Windows agent, enter the pairing code shown on screen. Your QR is immediately ready.'],
              ['What if my internet goes down mid-job?', 'Jobs already in the queue stay there safely. When the connection returns, the agent picks them up and prints automatically.'],
              ['Can I set my own per-page price?', 'Yes — separately for B&W and colour. You can update it anytime from the owner settings panel.'],
              ['Is there a per-print commission or revenue share?', 'No. You pay ₹299/month (or ₹2,000/year) for the software. Your print revenue is entirely yours.'],
            ].map(([q, a], i) => (
              <details className="faq-item" key={i}>
                <summary>{q}</summary>
                <p className="faq-body">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="cta-band">
        <div className="cta-inner">
          <h2 className="cta-h2">
            Ready to run your shop<br />
            <em>without the chaos?</em>
          </h2>
          <p className="cta-sub">
            Join print shops across India already using ScanItPrintIt.
            Start your free trial — no card needed.
          </p>
          <div className="cta-actions">
            <a href="/login" className="btn-cta">Start Free Trial →</a>
            <a href="#how" className="btn-cta-ghost">See how it works</a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer>
        <div className="footer-inner">
          <a href="/" className="footer-brand">ScanIt<span>PrintIt</span><span style={{ color: 'var(--muted2)', fontWeight: 400 }}>.in</span></a>
          <p className="footer-copy">© {new Date().getFullYear()} ScanItPrintIt. Built for Indian print shops.</p>
          <div className="footer-links">
            <a href="/login">Shop Login</a>
            <a href="mailto:support@scanitprintit.in">Contact</a>
          </div>
        </div>
      </footer>

      {/* Scroll reveal script */}
      <script dangerouslySetInnerHTML={{ __html: `
        const els = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
        }, { threshold: 0.12 });
        els.forEach(el => io.observe(el));
      `}} />
    </>
  );
}
