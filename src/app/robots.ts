import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/marketing';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/updates/'] }, sitemap: `${SITE_URL}/sitemap.xml` };
}
