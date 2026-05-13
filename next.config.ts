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
  }
};

export default nextConfig;
