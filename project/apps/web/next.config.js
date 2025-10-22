/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The following is recommended for pnpm monorepos
  // It helps Next.js correctly resolve packages from the workspace
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/linux-x64',
      ],
    },
  },
};

module.exports = nextConfig;