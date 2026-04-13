import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export default getRequestConfig(async () => {
  const locale = "en"; // Future: detect from user preference

  // Determine which message bundle to load based on the current route.
  // Try multiple header sources for pathname detection:
  // 1. x-pathname: set by our proxy.ts middleware (dashboard routes)
  // 2. x-next-url / referer: set by Next.js internally
  const headersList = await headers();
  const pathname =
    headersList.get("x-pathname") ||
    headersList.get("x-invoke-path") ||
    "";

  const isDashboard =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  // Load route-specific messages + shared base
  const shared = (await import(`@/messages/shared/${locale}.json`)).default;
  const routeMessages = isDashboard
    ? (await import(`@/messages/dashboard/${locale}.json`)).default
    : (await import(`@/messages/storefront/${locale}.json`)).default;

  return {
    locale,
    messages: { ...shared, ...routeMessages },
  };
});
