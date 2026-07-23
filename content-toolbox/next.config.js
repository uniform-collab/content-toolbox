/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    emotion: true,
  },
  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;
