import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfmake"],
  outputFileTracingIncludes: {
    "/api/pdf": ["./node_modules/pdfmake/fonts/Roboto/*.ttf"],
    "/api/pdf/route": ["./node_modules/pdfmake/fonts/Roboto/*.ttf"]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*"
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*"
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*"
      }
    ];
  },
  skipTrailingSlashRedirect: true
};

export default nextConfig;
