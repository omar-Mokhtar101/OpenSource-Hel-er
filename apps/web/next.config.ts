import path from 'node:path';
import type { NextConfig } from 'next';

// `standalone` exists for the Docker image (apps/web/Dockerfile). On Vercel the
// platform builds and traces the app itself, so let it use its defaults.
const onVercel = Boolean(process.env.VERCEL);

const nextConfig: NextConfig = {
  output: onVercel ? undefined : 'standalone',
  outputFileTracingRoot: onVercel ? undefined : path.join(__dirname, '../..'),
  transpilePackages: ['@osh/contracts'],
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
