import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

export default getRequestConfig(async () => {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";

  const locale = "en"; // Future: detect from user preference

  // Load appropriate messages based on route
  const isDashboard = pathname.startsWith("/dashboard");
  const isAdmin = pathname.startsWith("/admin");

  let messages;
  if (isDashboard || isAdmin) {
    messages = (await import(`@/messages/dashboard/${locale}.json`)).default;
  } else {
    messages = (await import(`@/messages/storefront/${locale}.json`)).default;
  }

  // Merge with shared messages
  const shared = (await import(`@/messages/shared/${locale}.json`)).default;

  return {
    locale,
    messages: { ...shared, ...messages },
  };
});
