'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './marketing.module.css';

export default function MarketingNav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const links = [['/#how', 'How it works'], ['/compatibility', 'Compatibility'], ['/pricing', 'Pricing'], ['/setup', 'Setup'], ['/contact', 'Support']];
  return (
    <nav className={styles.nav} aria-label="Main navigation" onKeyDown={event => {
      if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
    }}>
      <div className={styles.navInner}>
        <Link href="/" aria-label="ScanItPrintIt home" onClick={() => setOpen(false)}>
          <Image src="/logo-full.png" alt="ScanItPrintIt" width={144} height={48} className={styles.logo} priority />
        </Link>
        <div className={styles.desktopLinks}>{links.map(([href, name]) => <Link key={href} href={href}>{name}</Link>)}</div>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.login}>Shop login</Link>
          <Link href="/#trial" className={styles.navCta} onClick={() => setOpen(false)}>Free trial <span aria-hidden="true">↗</span></Link>
          <button ref={toggle} className={styles.menuButton} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
        </div>
      </div>
      <div id="mobile-navigation" className={styles.mobileLinks} hidden={!open}>
        {links.map(([href, name]) => <Link key={href} href={href} onClick={() => setOpen(false)}>{name}</Link>)}
        <Link href="/login" onClick={() => setOpen(false)}>Shop login</Link>
      </div>
    </nav>
  );
}
