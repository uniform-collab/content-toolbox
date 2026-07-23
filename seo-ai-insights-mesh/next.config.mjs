/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the Next.js dev indicator (the floating logo button in the corner).
  devIndicators: false,
  // @uniformdev/design-system ships ESM that must be transpiled by Next.
  transpilePackages: ['@uniformdev/design-system'],
  compiler: {
    // Enable Emotion's SWC transform for the @uniformdev/design-system styling.
    emotion: true,
  },
}

export default nextConfig
