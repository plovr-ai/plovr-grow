import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { subscriptionService } from "@/services/subscription";
import { SubscriptionClient } from "@/components/dashboard/subscription";

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const subscription = await subscriptionService.getSubscription(
    session.user.tenantId
  );

  return <SubscriptionClient subscription={subscription} />;
}
