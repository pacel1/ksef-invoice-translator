import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfmake"],
  outputFileTracingIncludes: {
    "/api/pdf": [
      "./node_modules/pdfmake/fonts/Roboto/*.ttf",
      "./vendor/ksef-pdf-generator/dist/*"
    ],
    "/api/pdf/route": [
      "./node_modules/pdfmake/fonts/Roboto/*.ttf",
      "./vendor/ksef-pdf-generator/dist/*"
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": path.resolve(__dirname, "vendor/ksef-pdf-generator/src/shared")
    };
    return config;
  }
};

export default nextConfig;
