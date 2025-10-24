/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  eslint: {
    // Lint in CI or pre-commit; skip during production builds to keep deployments unblocked.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // The project uses references and shared packages; disable blocking errors during Docker builds.
    ignoreBuildErrors: true,
  },
  async rewrites() {
    if (!isDev) {
      return [];
    }

    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3001/api/v1/:path*', // Dev server expects API on port 3001
      },
    ];
  },
};

module.exports = nextConfig;
