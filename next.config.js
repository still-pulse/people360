/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs'],
  images: {
    domains: [],
  },
}

module.exports = nextConfig
