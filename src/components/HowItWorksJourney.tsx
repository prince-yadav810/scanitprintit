'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FileUp, Check } from 'lucide-react';

export default function HowItWorksJourney() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 } // Trigger when 20% visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    
    // Play the journey animation sequence
    const t1 = setTimeout(() => setActiveStep(1), 400); // 01 Scan
    const t2 = setTimeout(() => setActiveStep(2), 2000); // 02 Upload
    const t3 = setTimeout(() => setActiveStep(3), 4000); // 03 Pay
    const t4 = setTimeout(() => setActiveStep(4), 6000); // 04 Print
    const t5 = setTimeout(() => setActiveStep(5), 8000); // Done payoff

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5);
    };
  }, [isVisible]);

  // Calculate progress for the connecting line (0 to 100%)
  const progressPercent = activeStep === 0 ? 0 :
                          activeStep === 1 ? 12 :
                          activeStep === 2 ? 37 :
                          activeStep === 3 ? 62 :
                          activeStep === 4 ? 87 : 100;

  return (
    <div ref={sectionRef} className="journey-wrapper">
      <style>{`
        .journey-wrapper {
          position: relative;
          max-width: 1200px;
          margin: 40px auto 0;
          padding: 0 20px;
        }
        .journey-track-container {
          display: flex;
          justify-content: space-between;
          position: relative;
          z-index: 1;
        }
        
        /* The connecting background line */
        .journey-line-bg {
          position: absolute;
          top: 80px; /* Align with the center of the mockups (160px/2) */
          left: 10%; right: 10%;
          height: 2px;
          background: var(--border);
          z-index: 0;
        }
        /* The active animated line */
        .journey-line-active {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          background: var(--amber);
          transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .journey-step {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          z-index: 2;
          padding: 0 16px;
        }

        /* ── CSS Mockups Container ── */
        .mockup-container {
          width: 160px; height: 160px;
          border-radius: 50%;
          background: var(--paper);
          border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 24px;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          transform: translateY(20px);
          opacity: 0.5;
        }
        
        /* Active Step Styles */
        .step-active .mockup-container {
          border-color: var(--amber);
          box-shadow: 0 12px 40px rgba(217, 119, 6, 0.15);
          transform: translateY(0) scale(1.05);
          opacity: 1;
        }
        .step-passed .mockup-container {
          transform: translateY(0);
          opacity: 1;
          border-color: var(--border2);
        }

        /* ── Step Text Content ── */
        .step-num {
          font-family: var(--serif);
          font-style: italic;
          font-size: 1.1rem;
          color: var(--muted2);
          margin-bottom: 8px;
          transition: color 0.3s;
        }
        .step-active .step-num { color: var(--amber); }
        .step-passed .step-num { color: var(--ink); }
        
        .step-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--ink);
          margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .step-desc {
          font-size: 0.9rem;
          color: var(--muted);
          line-height: 1.5;
          max-width: 220px;
        }

        /* ── CSS MOCKUP DESIGNS ── */
        
        /* 1. Phone & QR */
        .mockup-phone {
          width: 50px; height: 100px;
          border: 3px solid var(--ink);
          border-radius: 12px;
          background: var(--bg);
          position: relative;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .mockup-qr {
          width: 24px; height: 24px;
          background: repeating-linear-gradient(45deg, var(--ink), var(--ink) 2px, transparent 2px, transparent 4px);
        }
        .mockup-scan-line {
          position: absolute; top: -10px; left: 0; right: 0; height: 2px;
          background: var(--amber);
          box-shadow: 0 0 8px var(--amber);
          opacity: 0;
        }
        .step-active .mockup-scan-line {
          animation: scanDown 1.5s ease-in-out infinite;
        }
        @keyframes scanDown {
          0% { top: -10px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 110px; opacity: 0; }
        }

        /* 2. Upload Document */
        .mockup-doc {
          width: 44px; height: 56px;
          background: var(--paper);
          border: 2px solid var(--ink);
          border-radius: 6px;
          position: relative;
          display: flex; flex-direction: column; gap: 4px; padding: 8px 6px;
          transform: translateY(15px);
          opacity: 0;
        }
        .doc-line { height: 3px; background: var(--border); border-radius: 2px; width: 100%; }
        .doc-line.short { width: 60%; }
        .upload-arrow {
          position: absolute; top: -20px; color: var(--amber);
          opacity: 0; transform: translateY(10px);
        }
        .step-active .mockup-doc {
          animation: slideUpDoc 2s forwards;
        }
        .step-active .upload-arrow {
          animation: fadeArrow 2s forwards;
        }
        .step-passed .mockup-doc { transform: translateY(-10px); opacity: 1; }
        
        @keyframes slideUpDoc {
          0% { transform: translateY(15px); opacity: 0; }
          30% { transform: translateY(0); opacity: 1; }
          70% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-10px); opacity: 1; }
        }
        @keyframes fadeArrow {
          30% { opacity: 0; transform: translateY(10px); }
          50% { opacity: 1; transform: translateY(0); }
          70% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }

        /* 3. Payment UI */
        .mockup-card {
          width: 70px; height: 44px;
          background: var(--ink);
          border-radius: 8px;
          position: relative;
          padding: 8px;
          display: flex; flex-direction: column; justify-content: space-between;
          transform: scale(0.9);
        }
        .card-chip { width: 12px; height: 8px; background: var(--border); border-radius: 2px; }
        .card-dots { display: flex; gap: 2px; align-self: flex-end; }
        .card-dot { width: 4px; height: 4px; border-radius: 50%; background: rgba(255,255,255,0.4); }
        .payment-check {
          position: absolute; top: -12px; right: -12px;
          background: var(--amber); color: white;
          border-radius: 50%; padding: 4px;
          opacity: 0; transform: scale(0.5);
        }
        .step-active .mockup-card, .step-passed .mockup-card {
          animation: popCard 0.5s forwards;
        }
        .step-active .payment-check, .step-passed .payment-check {
          animation: popCheck 0.5s 0.8s forwards;
        }
        @keyframes popCard {
          to { transform: scale(1); }
        }
        @keyframes popCheck {
          to { opacity: 1; transform: scale(1); }
        }

        /* 4. Printer Output */
        .mockup-printer {
          width: 80px; height: 40px;
          background: var(--ink);
          border-radius: 8px 8px 4px 4px;
          position: relative;
          display: flex; justify-content: center;
          margin-top: -20px;
        }
        .printer-tray {
          position: absolute; bottom: -6px; width: 60px; height: 6px;
          background: var(--ink2); border-radius: 2px;
        }
        .printer-paper {
          position: absolute; top: 10px; width: 50px; height: 60px;
          background: var(--paper); border: 2px solid var(--border);
          border-top: none; z-index: -1;
          display: flex; flex-direction: column; gap: 4px; padding: 12px 6px 4px;
          transform: translateY(-40px);
          opacity: 0;
        }
        .step-active .printer-paper, .step-passed .printer-paper {
          animation: printPaper 2s 0.5s forwards;
        }
        @keyframes printPaper {
          0% { transform: translateY(-40px); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }

        /* Payoff */
        .payoff-message {
          text-align: center;
          margin-top: 60px;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.8s ease;
        }
        .payoff-message.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .payoff-message h3 {
          font-family: var(--serif);
          font-size: 2.5rem;
          font-style: italic;
          color: var(--amber);
          margin-bottom: 8px;
        }
        .payoff-message p {
          color: var(--muted);
          font-size: 1.1rem;
        }

        /* Mobile Layout */
        @media (max-width: 900px) {
          .journey-track-container {
            flex-direction: column;
            gap: 40px;
          }
          .journey-line-bg {
            top: 40px; bottom: 40px; left: 86px; /* center of 120px + 26px padding approx */
            width: 2px; height: auto;
          }
          .journey-step {
            flex-direction: row;
            text-align: left;
            align-items: center;
            gap: 24px;
          }
          .mockup-container {
            width: 120px; height: 120px; margin-bottom: 0; flex-shrink: 0;
            z-index: 2; background: var(--paper);
          }
          .step-desc { max-width: 100%; }
        }
      `}</style>

      <div className="journey-track-container">
        {/* Background Line */}
        <div className="journey-line-bg">
          <div 
            className="journey-line-active" 
            style={{ 
              width: !isMobile ? `${progressPercent}%` : '100%',
              height: isMobile ? `${progressPercent}%` : '100%'
            }} 
          />
        </div>

        {/* STEP 1: SCAN */}
        <div className={`journey-step ${activeStep === 1 ? 'step-active' : activeStep > 1 ? 'step-passed' : ''}`}>
          <div className="mockup-container">
            <div className="mockup-phone">
              <div className="mockup-scan-line" />
              <div className="mockup-qr" />
            </div>
          </div>
          <div>
            <div className="step-num">01</div>
            <div className="step-title">Scan the QR</div>
            <div className="step-desc">Scan the QR code with any phone. No app needed.</div>
          </div>
        </div>

        {/* STEP 2: UPLOAD */}
        <div className={`journey-step ${activeStep === 2 ? 'step-active' : activeStep > 2 ? 'step-passed' : ''}`}>
          <div className="mockup-container">
            <FileUp size={24} className="upload-arrow" />
            <div className="mockup-doc">
              <div className="doc-line" />
              <div className="doc-line short" />
              <div className="doc-line" />
            </div>
          </div>
          <div>
            <div className="step-num">02</div>
            <div className="step-title">Upload your file</div>
            <div className="step-desc">Pick your file, then choose colour, copies, and more.</div>
          </div>
        </div>

        {/* STEP 3: PAY */}
        <div className={`journey-step ${activeStep === 3 ? 'step-active' : activeStep > 3 ? 'step-passed' : ''}`}>
          <div className="mockup-container">
            <div className="mockup-card">
              <div className="card-chip" />
              <div className="card-dots">
                <div className="card-dot" /><div className="card-dot" /><div className="card-dot" />
              </div>
            </div>
            <div className="payment-check"><Check size={16} strokeWidth={3} /></div>
          </div>
          <div>
            <div className="step-num">03</div>
            <div className="step-title">Pay your way</div>
            <div className="step-desc">Pay online or at the counter. Your order goes straight to the printer.</div>
          </div>
        </div>

        {/* STEP 4: PRINT */}
        <div className={`journey-step ${activeStep === 4 ? 'step-active' : activeStep > 4 ? 'step-passed' : ''}`}>
          <div className="mockup-container">
            <div className="mockup-printer">
              <div className="printer-tray" />
              <div className="printer-paper">
                <div className="doc-line" />
                <div className="doc-line short" />
                <div className="doc-line" />
                <div className="doc-line" style={{ marginTop: 4 }}/>
              </div>
            </div>
          </div>
          <div>
            <div className="step-num">04</div>
            <div className="step-title">Pick up your print</div>
            <div className="step-desc">Your file reaches the printer automatically. Just collect your pages.</div>
          </div>
        </div>
      </div>

      {/* FINAL PAYOFF */}
      <div className={`payoff-message ${activeStep >= 5 ? 'visible' : ''}`}>
        <h3>Your document is ready.</h3>
        <p>Zero hassle. Zero pen drives.</p>
      </div>
    </div>
  );
}
