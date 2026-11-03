import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ['/login', '/owner/:path*', '/admin/:path*', '/s/:path*', '/o/:path*', '/api/:path*'].map(source => ({
      source,
      headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, nosnippet' }],
    }));
  },
};

export default nextConfig;
