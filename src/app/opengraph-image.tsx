import { ImageResponse } from 'next/og';
export const alt = 'ScanItPrintIt — print shop automation for India. Try free for 2 days. ₹299/month, no GST charged.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function OpenGraphImage() {
  return new ImageResponse(<div style={{display:'flex',flexDirection:'column',justifyContent:'space-between',width:'100%',height:'100%',background:'#fafaf8',padding:'54px 64px',color:'#1a1915',fontFamily:'sans-serif',borderBottom:'12px solid #a75107'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:32,fontWeight:700}}>scanitprintit.</div><div style={{fontSize:20,color:'#805019'}}>FOR INDIAN COPY SHOPS</div></div>
    <div style={{display:'flex',flexDirection:'column',gap:10}}><div style={{fontSize:76,fontWeight:700,letterSpacing:-3}}>Your printer.</div><div style={{fontSize:76,fontWeight:700,letterSpacing:-3,color:'#a75107'}}>Less busywork.</div><div style={{fontSize:28,marginTop:14}}>QR uploads · Online payments · Windows print queue</div></div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #d9d3c6',paddingTop:24}}><div style={{fontSize:25}}>2-day free trial · Unlimited trial jobs</div><div style={{fontSize:22}}>₹299/month · No GST charged</div></div>
  </div>,size);
}
