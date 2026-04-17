import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Upload source maps for better stack traces in production
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Disable Sentry telemetry
  telemetry: false,

  // Suppress noisy build logs
  silent: true,
});
