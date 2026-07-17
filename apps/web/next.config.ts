import type { NextConfig } from "next";
import path from "node:path";
import stylexPlugin from "@stylexswc/nextjs-plugin/turbopack";
import { env } from "./src/env";

const rootDir = process.cwd();

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@stylexjs/open-props"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default stylexPlugin({
  rsOptions: {
    dev: process.env.NODE_ENV !== "production",
    aliases: {
      "@/*": [path.join(rootDir, "src/*")],
    },
    unstable_moduleResolution: { type: "commonJS" },
  },
  stylexImports: [
    "@stylexjs/stylex",
    { from: "@stylexjs/open-props/lib/colors.stylex", as: "colors" },
    { from: "@stylexjs/open-props/lib/sizes.stylex", as: "sizes" },
    { from: "@stylexjs/open-props/lib/borders.stylex", as: "borders" },
    { from: "@stylexjs/open-props/lib/fonts.stylex", as: "fonts" },
    { from: "@stylexjs/open-props/lib/shadows.stylex", as: "shadows" },
  ],
})(nextConfig);
