import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SubscriptionClient } from "@/components/dashboard/subscription";

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }
  return <SubscriptionClient />;
}
