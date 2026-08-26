'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  X, Check, Printer, Smartphone, Cloud, ArrowRight, 
  ShieldCheck, Zap, BarChart2, Timer, Banknote, HelpCircle
} from 'lucide-react';

export default function WhyScanItPrintIt() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    
    // Animate the flow sequence repeatedly or just once? "subtle scroll-based storytelling"
    // We'll run a loop so it keeps showing the system in action.
    const runAnimation = () => {
      setActiveStep(0);
      setTimeout(() => setActiveStep(1), 500);   // Phone scan
      setTimeout(() => setActiveStep(2), 2000);  // Upload/Cloud
      setTimeout(() => setActiveStep(3), 3500);  // Pay
      setTimeout(() => setActiveStep(4), 5000);  // Printer
      setTimeout(() => setActiveStep(5), 7000);  // Dashboard update
    };

    runAnimation();
    const interval = setInterval(runAnimation, 9000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <section className="section" id="why" style={{ background: '#FFFFFF' }}>
      <style>{`
        .why-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ── Hero Visual Animation ── */
        .system-visual {
          background: var(--paper);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 60px 40px;
          margin: 60px 0;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.02);
        }

        .sys-node {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          z-index: 2;
          width: 140px;
        }

        .sys-icon-wrapper {
          width: 80px; height: 80px;
          border-radius: 20px;
          background: #fff;
          border: 1px solid var(--border2);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.04);
          transition: all 0.4s ease;
          position: relative;
        }

        .sys-node.active .sys-icon-wrapper {
          border-color: var(--amber);
          transform: translateY(-5px) scale(1.05);
          box-shadow: 0 12px 24px rgba(217,119,6,0.15);
        }
        
        .sys-node.active .sys-icon-wrapper svg {
          color: var(--amber);
        }

        .sys-label {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--ink);
          margin-bottom: 4px;
        }
        .sys-sub {
          font-size: 0.8rem;
          color: var(--muted);
          line-height: 1.3;
        }

        .sys-line {
          flex: 1;
          height: 2px;
          background: var(--border);
          position: relative;
          margin-top: -60px; /* offset to align with icons */
          min-width: 40px;
        }
        .sys-line-fill {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          background: var(--amber);
          width: 0;
          transition: width 0.5s ease;
        }
        .sys-line.active .sys-line-fill {
          width: 100%;
        }

        /* ── Specific Node Animations ── */
        .print-paper-anim {
          position: absolute;
          bottom: -10px; width: 30px; height: 40px;
          background: #fff; border: 1px solid var(--border);
          opacity: 0; transform: translateY(-20px);
          z-index: -1;
        }
        .sys-node.active .print-paper-anim {
          animation: ejectPaper 1.5s forwards;
        }
        @keyframes ejectPaper {
          0% { transform: translateY(-20px); opacity: 0; }
          30% { opacity: 1; }
          100% { transform: translateY(15px); opacity: 1; }
        }

        .dashboard-val {
          font-family: var(--serif);
          font-style: italic;
          font-size: 1.2rem;
          color: var(--ink);
          font-weight: 700;
          position: absolute;
        }
        .sys-node.active .dashboard-val {
          color: var(--amber);
          animation: popValue 0.5s forwards;
        }
        @keyframes popValue {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        /* ── Before & After ── */
        .comparison-grid {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 2px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
          margin-bottom: 80px;
        }
        .comp-col {
          padding: 48px;
          background: #fff;
        }
        .comp-col.before {
          background: #fafafa;
        }
        .comp-header {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 700;
          margin-bottom: 32px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .before .comp-header { color: var(--muted); }
        .after .comp-header { color: var(--amber); }
        
        .flow-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .flow-item {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 1.05rem;
          font-weight: 500;
        }
        .before .flow-item { color: var(--muted); }
        .after .flow-item { color: var(--ink); }
        
        .flow-arrow {
          color: var(--border2);
          margin-left: 4px;
        }

        /* ── Benefits List ── */
        .benefits-compact {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
          margin-bottom: 80px;
        }
        .benefit-item {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .benefit-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: var(--paper);
          display: flex; align-items: center; justify-content: center;
          color: var(--amber);
        }
        .benefit-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--ink);
        }
        .benefit-desc {
          font-size: 0.95rem;
          color: var(--muted);
          line-height: 1.5;
        }

        /* ── Closing Statement ── */
        .closing-box {
          text-align: center;
          padding: 80px 20px;
          background: var(--paper);
          border-radius: 24px;
        }
        .closing-box h3 {
          font-family: var(--serif);
          font-style: italic;
          font-size: 2.5rem;
          color: var(--ink);
          margin-bottom: 16px;
        }
        .closing-box p {
          font-size: 1.15rem;
          color: var(--muted);
          max-width: 600px;
          margin: 0 auto;
        }

        /* ── Mobile Responsive ── */
        @media (max-width: 900px) {
          .system-visual {
            flex-direction: column;
            padding: 40px 20px;
            gap: 0;
          }
          .sys-line {
            width: 2px;
            height: 40px;
            min-height: 40px;
            margin-top: 0;
            margin-bottom: 0;
          }
          .sys-line-fill {
            width: 100%;
            height: 0;
            transition: height 0.5s ease;
          }
          .sys-line.active .sys-line-fill { height: 100%; width: 100%; }
          .sys-node { width: 100%; flex-direction: row; text-align: left; gap: 16px; justify-content: center; }
          .sys-icon-wrapper { margin-bottom: 0; }
          .sys-text { flex: 1; max-width: 200px; }
          
          .comparison-grid { grid-template-columns: 1fr; }
          .benefits-compact { grid-template-columns: 1fr; gap: 32px; }
          .closing-box h3 { font-size: 2rem; }
        }
      `}</style>

      <div ref={sectionRef} className="why-inner">
        <div className="kicker reveal">Why ScanItPrintIt</div>
        <h2 className="section-h2 reveal" style={{ marginBottom: 16 }}>The print shop upgrade<br/>that pays for itself.</h2>
        <p className="section-lead reveal">Keep your printer. Keep your staff. Just let customers handle the busywork.</p>

        {/* ── Visual Storytelling System ── */}
        <div className="system-visual reveal">
          <div className={"sys-node " + (activeStep >= 1 ? "active" : "")}>
            <div className="sys-icon-wrapper">
              <Smartphone size={32} color={activeStep >= 1 ? "var(--amber)" : "var(--muted)"} />
            </div>
            <div className="sys-text">
              <div className="sys-label">1. Customer</div>
              <div className="sys-sub">Scans QR on counter</div>
            </div>
          </div>
          
          <div className={"sys-line " + (activeStep >= 2 ? "active" : "")}>
            <div className="sys-line-fill" />
          </div>

          <div className={"sys-node " + (activeStep >= 2 ? "active" : "")}>
            <div className="sys-icon-wrapper">
              <Cloud size={32} color={activeStep >= 2 ? "var(--amber)" : "var(--muted)"} />
            </div>
            <div className="sys-text">
              <div className="sys-label">2. ScanItPrintIt</div>
              <div className="sys-sub">Uploads & Payments</div>
            </div>
          </div>

          <div className={"sys-line " + (activeStep >= 4 ? "active" : "")}>
            <div className="sys-line-fill" />
          </div>

          <div className={"sys-node " + (activeStep >= 4 ? "active" : "")}>
            <div className="sys-icon-wrapper">
              <Printer size={32} color={activeStep >= 4 ? "var(--amber)" : "var(--muted)"} />
              <div className="print-paper-anim" />
            </div>
            <div className="sys-text">
              <div className="sys-label">3. Your Printer</div>
              <div className="sys-sub">Auto-prints directly</div>
            </div>
          </div>

          <div className={"sys-line " + (activeStep >= 5 ? "active" : "")}>
            <div className="sys-line-fill" />
          </div>

          <div className={"sys-node " + (activeStep >= 5 ? "active" : "")}>
            <div className="sys-icon-wrapper">
              <div className="dashboard-val">₹{activeStep >= 5 ? "85" : "0"}</div>
            </div>
            <div className="sys-text">
              <div className="sys-label">4. Your Dashboard</div>
              <div className="sys-sub">Revenue added instantly</div>
            </div>
          </div>
        </div>

        {/* ── Before / After Transformation ── */}
        <div className="comparison-grid reveal">
          <div className="comp-col before">
            <div className="comp-header">
              <X size={16} /> BEFORE
            </div>
            <div className="flow-list">
              <div className="flow-item">Customer asks for WhatsApp <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item">Staff opens WhatsApp Web <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item">Downloads file to PC <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item">Checks settings & prints <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item">Asks for UPI payment</div>
            </div>
          </div>
          <div className="comp-col after">
            <div className="comp-header">
              <Check size={16} /> WITH SCANTOPRINTIT
            </div>
            <div className="flow-list">
              <div className="flow-item">Customer scans QR <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item">Customer uploads file <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item">Customer pays online <ArrowRight size={16} className="flow-arrow"/></div>
              <div className="flow-item" style={{ color: 'var(--amber)', fontWeight: 700 }}>
                Printer automatically prints pages.
              </div>
            </div>
          </div>
        </div>

        {/* ── 6 Benefits Compact List ── */}
        <div className="benefits-compact reveal">
          <div className="benefit-item">
            <div className="benefit-icon"><Printer size={20} /></div>
            <div className="benefit-title">Keep your printer</div>
            <div className="benefit-desc">No new hardware. Works with your existing Windows printer seamlessly.</div>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon"><Banknote size={20} /></div>
            <div className="benefit-title">₹299/month flat</div>
            <div className="benefit-desc">No revenue share. No per-print percentage. You keep 100% of your earnings.</div>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon"><Zap size={20} /></div>
            <div className="benefit-title">Staff stays free</div>
            <div className="benefit-desc">Customers handle file selection and print settings themselves.</div>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon"><ShieldCheck size={20} /></div>
            <div className="benefit-title">Files disappear</div>
            <div className="benefit-desc">Documents are deleted immediately after printing for privacy.</div>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon"><BarChart2 size={20} /></div>
            <div className="benefit-title">See your revenue</div>
            <div className="benefit-desc">Track jobs, earnings, and order history in real-time from any device.</div>
          </div>
          <div className="benefit-item">
            <div className="benefit-icon"><Timer size={20} /></div>
            <div className="benefit-title">Ready in 2 minutes</div>
            <div className="benefit-desc">Install the agent, pair the printer, and put the QR code on your counter.</div>
          </div>
        </div>

        {/* ── Closing Statement ── */}
        <div className="closing-box reveal">
          <h3>Your printer stays. Your workflow gets smarter.</h3>
          <p>Turn the counter into a self-service print experience — without replacing the equipment you already own.</p>
        </div>

      </div>
    </section>
  );
}
