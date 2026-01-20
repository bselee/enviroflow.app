/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@enviroflow/types'],
  output: 'standalone',
}

module.exports = nextConfig
