import type { ReactNode } from 'react';
import { DM_Sans, Instrument_Serif } from 'next/font/google';
import Link from 'next/link';
import MarketingNav from './MarketingNav';
import { SUPPORT_EMAIL, SUPPORT_PHONE } from '@/lib/marketing';
import styles from './marketing.module.css';

const sans = DM_Sans({ subsets: ['latin'], variable: '--marketing-sans', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--marketing-serif', display: 'swap' });

export default function MarketingShell({ children }: { children: ReactNode }) {
  return <div className={`${styles.site} ${sans.variable} ${serif.variable}`}>
    <a className={styles.skipLink} href="#main-content">Skip to content</a>
    <MarketingNav />
    <main id="main-content" tabIndex={-1}>{children}</main>
    <footer className={styles.footer}>
      <div className={styles.footerTop}>
        <div><Link href="/" className={styles.wordmark}>scan<span>it</span>print<span>it</span>.</Link><p>Print shop software by Enclope Enterprises.</p><p>Built for Indian copy shops and cyber cafes.</p></div>
        <nav aria-label="Resources"><Link href="/setup">Windows setup guide</Link><Link href="/compatibility">Printer compatibility</Link><Link href="/pricing">Plans & trial details</Link></nav>
        <nav aria-label="Company"><Link href="/about">About ScanItPrintIt</Link><Link href="/privacy">Privacy & file handling</Link><Link href="/contact">Contact & support</Link></nav>
        <div><a href="https://wa.me/918591442334" target="_blank" rel="noreferrer">{SUPPORT_PHONE}</a><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><Link href="/login">Shop login</Link></div>
      </div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Enclope Enterprises</span><span>Your printer. Your prices. A clearer queue.</span></div>
    </footer>
  </div>;
}
