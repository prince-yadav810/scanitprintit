"use client";

import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Player } from "@remotion/player";
import { Smartphone, QrCode, FileUp, CreditCard, Printer, CheckCircle } from "lucide-react";

export default function HowItWorksVideo() {
  return (
    <div style={{ width: '100%', maxWidth: 1000, margin: '56px auto 0', borderRadius: 24, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(26,25,21,0.05)' }}>
      <Player
        component={HowItWorksComposition}
        durationInFrames={300} // 30fps * 10s (2.5s per scene * 4 scenes)
        fps={30}
        compositionWidth={1000}
        compositionHeight={500}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        autoPlay
        loop
      />
    </div>
  );
}

export const HowItWorksComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  const sceneDuration = fps * 2.5; // 2.5 seconds per scene

  return (
    <AbsoluteFill style={{ 
      backgroundColor: "var(--bg-subtle)", 
      borderRadius: 24, 
      overflow: "hidden", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      border: "1px solid var(--border)",
      color: "var(--ink)"
    }}>
      {/* Grid background matching landing page */}
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(26,25,21,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(26,25,21,0.04) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />
      
      <Sequence from={0} durationInFrames={sceneDuration}>
        <Scene1 />
      </Sequence>
      <Sequence from={sceneDuration} durationInFrames={sceneDuration}>
        <Scene2 />
      </Sequence>
      <Sequence from={sceneDuration * 2} durationInFrames={sceneDuration}>
        <Scene3 />
      </Sequence>
      <Sequence from={sceneDuration * 3} durationInFrames={sceneDuration}>
        <Scene4 />
      </Sequence>
    </AbsoluteFill>
  );
};

const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const qrScale = spring({ frame, fps, config: { damping: 12 } });
  const phoneY = interpolate(spring({ frame: frame - 15, fps, config: { damping: 14 } }), [0, 1], [400, 100]);
  
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 80, fontSize: 24, fontWeight: 600 }}>01. Scan QR Code</div>
      
      <div style={{ transform: `scale(${qrScale})`, marginBottom: 60, padding: 24, background: "white", borderRadius: 16, border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <QrCode size={120} strokeWidth={1.5} color="var(--ink)" />
      </div>
      
      <div style={{
        position: "absolute",
        bottom: 0,
        transform: `translateY(${phoneY}px)`,
        width: 160,
        height: 280,
        background: "#111",
        borderRadius: "24px 24px 0 0",
        border: "8px solid #333",
        borderBottom: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ width: 100, height: 100, border: "2px dashed rgba(255,255,255,0.5)", borderRadius: 12 }} />
      </div>
    </AbsoluteFill>
  );
};

const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const phoneY = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [400, 0]);
  const docScale = spring({ frame: frame - 20, fps, config: { damping: 12 } });
  
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 80, fontSize: 24, fontWeight: 600 }}>02. Upload & Settings</div>
      
      <div style={{
        position: "absolute",
        transform: `translateY(${phoneY}px)`,
        width: 220,
        height: 400,
        background: "white",
        borderRadius: 24,
        border: "8px solid #333",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 20
      }}>
        <div style={{ width: 80, height: 4, background: "#ddd", borderRadius: 4, marginBottom: 40 }} />
        
        <div style={{ transform: `scale(${docScale})`, width: 120, height: 140, background: "var(--amber-lt)", border: "2px solid #FDE68A", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--amber-dk)", marginBottom: 30 }}>
          <FileUp size={48} strokeWidth={1.5} />
          <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600 }}>resume.pdf</div>
        </div>
        
        <div style={{ transform: `scale(${docScale})`, width: "100%", padding: 12, background: "var(--bg-subtle)", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--muted)", display: "flex", justifyContent: "space-between" }}>
          <span>Copies: 2</span>
          <span>B&W</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const phoneScale = interpolate(spring({ frame, fps, config: { damping: 14 } }), [0, 1], [0.8, 1]);
  const checkScale = spring({ frame: frame - 20, fps, config: { damping: 12, mass: 0.8 } });
  
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 80, fontSize: 24, fontWeight: 600 }}>03. Pay Online</div>
      
      <div style={{
        transform: `scale(${phoneScale})`,
        width: 220,
        height: 400,
        background: "white",
        borderRadius: 24,
        border: "8px solid #333",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }}>
        
        <CreditCard size={48} color="var(--ink)" style={{ marginBottom: 20, opacity: interpolate(frame, [0, 15], [0, 1]) }} />
        
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 40, opacity: interpolate(frame, [5, 20], [0, 1]) }}>₹4.00</div>
        
        <div style={{ transform: `scale(${checkScale})`, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <CheckCircle size={64} color="#15803D" strokeWidth={2} />
          <div style={{ marginTop: 12, color: "#15803D", fontWeight: 600 }}>Paid successfully</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const printerScale = spring({ frame, fps, config: { damping: 12 } });
  const paperY = interpolate(spring({ frame: frame - 25, fps, config: { damping: 20 } }), [0, 1], [0, 120]);
  
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", top: 80, fontSize: 24, fontWeight: 600 }}>04. Auto Print</div>
      
      <div style={{ position: "relative", transform: `scale(${printerScale})`, marginTop: -60 }}>
        {/* Paper coming out */}
        <div style={{
          position: "absolute",
          top: 40,
          left: 40,
          right: 40,
          height: 140,
          background: "white",
          border: "2px solid var(--border)",
          borderRadius: 8,
          zIndex: 1,
          transform: `translateY(${paperY}px)`,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12
        }}>
          <div style={{ width: "40%", height: 12, background: "var(--amber)", borderRadius: 4 }} />
          <div style={{ width: "100%", height: 8, background: "var(--bg-subtle)", borderRadius: 4 }} />
          <div style={{ width: "80%", height: 8, background: "var(--bg-subtle)", borderRadius: 4 }} />
          <div style={{ width: "90%", height: 8, background: "var(--bg-subtle)", borderRadius: 4 }} />
        </div>
        
        {/* Printer body */}
        <div style={{
          position: "relative",
          zIndex: 2,
          width: 240,
          height: 120,
          background: "var(--ink)",
          borderRadius: "24px 24px 12px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 24
        }}>
          <div style={{ width: 140, height: 8, background: "#333", borderRadius: 4, marginBottom: 20 }} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#15803D" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#333" }} />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
