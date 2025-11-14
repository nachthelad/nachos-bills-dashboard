import path from "node:path"

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      "pdf-parse": "./lib/pdf-parse",
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "pdf-parse": path.resolve(process.cwd(), "lib/pdf-parse"),
    }
    return config
  },
}

export default nextConfig