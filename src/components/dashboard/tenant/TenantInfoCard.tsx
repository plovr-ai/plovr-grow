"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  DollarSign,
  Languages,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TenantSettingsForm } from "./TenantSettingsForm";

interface MerchantSummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  status: string;
}

interface TenantData {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  currency: string;
  locale: string;
  status: string;
  createdAt: Date | string;
  merchants: MerchantSummary[];
}

interface TenantInfoCardProps {
  tenant: TenantData;
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  suspended: "bg-red-100 text-red-800",
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function TenantInfoCard({ tenant }: TenantInfoCardProps) {
  const router = useRouter();
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header Card - Basic Info */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-gray-100">
                  <Building2 className="h-10 w-10 text-gray-400" />
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-gray-900">
                  {tenant.name}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[tenant.status]}`}
                >
                  {tenant.status.charAt(0).toUpperCase() +
                    tenant.status.slice(1)}
                </span>
              </div>

              {tenant.legalName && (
                <p className="mt-1 text-sm text-gray-500">
                  Legal Name: {tenant.legalName}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-500">
                Slug: <code className="rounded bg-gray-100 px-1">{tenant.slug}</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <InfoRow
              icon={Mail}
              label="Support Email"
              value={tenant.supportEmail}
            />
            <InfoRow
              icon={Phone}
              label="Support Phone"
              value={tenant.supportPhone}
            />
            <InfoRow
              icon={Globe}
              label="Website"
              value={tenant.websiteUrl}
              isLink
            />
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card className="h-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Business Information</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingSettings(true)}
              className="h-8 px-2"
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <InfoRow
              icon={DollarSign}
              label="Currency"
              value={tenant.currency}
            />
            <InfoRow
              icon={Languages}
              label="Locale"
              value={tenant.locale}
            />
            <InfoRow
              icon={Calendar}
              label="Created"
              value={formatDate(tenant.createdAt)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {tenant.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 whitespace-pre-wrap">
              {tenant.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stores List */}
      {tenant.merchants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stores ({tenant.merchants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {tenant.merchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-gray-50 -mx-4 px-4 rounded-md transition-colors"
                  onClick={() => router.push(`/dashboard/locations/${merchant.id}`)}
                >
                  <div>
                    <p className="font-medium text-gray-900">{merchant.name}</p>
                    {(merchant.city || merchant.state) && (
                      <p className="text-sm text-gray-500">
                        {[merchant.city, merchant.state]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[merchant.status] || statusColors.inactive}`}
                    >
                      {merchant.status.charAt(0).toUpperCase() +
                        merchant.status.slice(1)}
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Edit Modal */}
      {isEditingSettings && (
        <TenantSettingsForm
          currency={tenant.currency}
          locale={tenant.locale}
          onClose={() => setIsEditingSettings(false)}
        />
      )}
    </div>
  );
}

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  isLink?: boolean;
}

function InfoRow({ icon: Icon, label, value, isLink }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        {value ? (
          isLink ? (
            <a
              href={value.startsWith("http") ? value : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:underline truncate block"
            >
              {value}
            </a>
          ) : (
            <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
          )
        ) : (
          <p className="text-sm text-gray-400 italic">Not set</p>
        )}
      </div>
    </div>
  );
}
