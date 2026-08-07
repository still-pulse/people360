/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    instrumentationHook: true,
  },
  images: {
    domains: [],
  },
}

module.exports = nextConfig
