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

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
