import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { merchantService } from "@/services/merchant";
import { LocationConfigForm } from "@/components/dashboard/locations/LocationConfigForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface LocationConfigPageProps {
  params: Promise<{ merchantId: string }>;
}

export default async function LocationConfigPage({
  params,
}: LocationConfigPageProps) {
  const session = await auth();

  if (!session?.user?.tenantId) {
    redirect("/dashboard/login");
  }

  const { tenantId } = session.user;
  const { merchantId } = await params;

  const merchantData = await merchantService.getMerchant(tenantId, merchantId);

  if (!merchantData) {
    redirect("/dashboard/company");
  }

  // Serialize to plain object (converts Decimal to number, Date to string)
  const merchant = JSON.parse(JSON.stringify(merchantData));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/company"
          className="flex items-center text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-5 w-5" />
          <span>Back to Company</span>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Location Settings</h2>
      </div>

      <LocationConfigForm merchant={merchant} />
    </div>
  );
}
