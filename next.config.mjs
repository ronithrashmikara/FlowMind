/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
