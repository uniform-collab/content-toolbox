/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compiler: {
    emotion: true,
  },
  // Webpack-only option (see --webpack in the dev/build scripts): forces CJS
  // resolution of ESM externals — the design system's ESM build uses
  // extensionless imports that Node's ESM loader rejects when externalized.
  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;
