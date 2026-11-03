import type { Metadata } from 'next';

export const SITE_URL = 'https://www.scanitprintit.in';
export const SUPPORT_EMAIL = 'princeyadav810py@gmail.com';
export const SUPPORT_PHONE = '+91 85914 42334';
export const DOWNLOAD_URL = '/ScanItPrintIt-Agent-Setup.exe';
export const TRIAL_URL = `https://wa.me/918591442334?text=${encodeURIComponent('Hi, I would like a 2-day free trial of ScanItPrintIt. Please help me check my printer and set up my shop.')}`;
export const PUBLIC_PATHS = ['/', '/setup', '/compatibility', '/pricing', '/privacy', '/about', '/contact'];

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${path}` },
    openGraph: {
      title, description, url: `${SITE_URL}${path}`, siteName: 'ScanItPrintIt',
      locale: 'en_IN', type: 'website',
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: 'ScanItPrintIt — print shop automation for India. Scan, upload, pay, print.' }],
    },
    twitter: {
      card: 'summary_large_image', title, description,
      images: [`${SITE_URL}/opengraph-image`],
    },
  };
}

export const homeMetadata = pageMetadata(
  'Print Shop Automation Software in India | ScanItPrintIt',
  'Automate your print shop with QR uploads, online payments and Windows auto-printing. Try ScanItPrintIt free for 2 days. Plans from ₹299/month.',
  '/',
);

export const organization = {
  '@type': 'Organization', '@id': `${SITE_URL}/#organization`,
  name: 'Enclope Enterprises', url: SITE_URL,
  logo: `${SITE_URL}/logo-full.png`, email: SUPPORT_EMAIL, telephone: '+918591442334',
};

export const productSchema = {
  '@context': 'https://schema.org',
  '@graph': [organization, {
    '@type': 'SoftwareApplication', '@id': `${SITE_URL}/#software`,
    name: 'ScanItPrintIt', url: SITE_URL, applicationCategory: 'BusinessApplication',
    operatingSystem: 'Windows', description: 'QR document ordering and print queue automation for Indian copy shops and cyber cafes.',
    publisher: { '@id': `${SITE_URL}/#organization` },
    offers: [
      { '@type': 'Offer', name: 'Monthly software plan', price: '299', priceCurrency: 'INR', url: `${SITE_URL}/pricing`, description: '₹299 per month for one printer and one Windows PC.' },
      { '@type': 'Offer', name: 'Annual software plan', price: '2000', priceCurrency: 'INR', url: `${SITE_URL}/pricing`, description: '₹2,000 paid annually.' },
      { '@type': 'Offer', name: 'Lifetime software plan', price: '5000', priceCurrency: 'INR', url: `${SITE_URL}/pricing`, description: '₹5,000 one-time software payment.' },
    ],
  }],
};
