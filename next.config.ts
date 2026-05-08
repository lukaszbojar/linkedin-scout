import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', '@playwright/browser-chromium'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't bundle playwright on client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      }
    }
    return config
  },
}

export default nextConfig
