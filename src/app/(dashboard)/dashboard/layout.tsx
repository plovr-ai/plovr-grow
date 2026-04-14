import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  title: "Dashboard | Plovr",
  description: "Manage your restaurant business",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();

  // Import dashboard + shared messages directly, bypassing the
  // header-based detection in getRequestConfig which can be unreliable
  // for dashboard routes (x-pathname header may be lost in edge cases).
  const dashboardMessages = (
    await import(`@/messages/dashboard/${locale}.json`)
  ).default;
  const sharedMessages = (await import(`@/messages/shared/${locale}.json`))
    .default;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ ...sharedMessages, ...dashboardMessages }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
