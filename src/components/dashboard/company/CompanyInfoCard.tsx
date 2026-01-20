"use client";

/* eslint-disable @next/next/no-img-element */
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
  Store,
  Calendar,
  DollarSign,
  Languages,
  Pencil,
} from "lucide-react";
import { CompanySettingsForm } from "./CompanySettingsForm";

interface MerchantSummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  status: string;
}

interface CompanyData {
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

interface CompanyInfoCardProps {
  company: CompanyData;
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

export function CompanyInfoCard({ company }: CompanyInfoCardProps) {
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const activeStores = company.merchants.filter(
    (m) => m.status === "active"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Card - Basic Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              {company.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt={company.name}
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
                  {company.name}
                </h3>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[company.status]}`}
                >
                  {company.status.charAt(0).toUpperCase() +
                    company.status.slice(1)}
                </span>
              </div>

              {company.legalName && (
                <p className="mt-1 text-sm text-gray-500">
                  Legal Name: {company.legalName}
                </p>
              )}

              <p className="mt-1 text-sm text-gray-500">
                Slug: <code className="rounded bg-gray-100 px-1">{company.slug}</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              icon={Mail}
              label="Support Email"
              value={company.supportEmail}
            />
            <InfoRow
              icon={Phone}
              label="Support Phone"
              value={company.supportPhone}
            />
            <InfoRow
              icon={Globe}
              label="Website"
              value={company.websiteUrl}
              isLink
            />
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
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
          <CardContent className="space-y-4">
            <InfoRow
              icon={DollarSign}
              label="Currency"
              value={company.currency}
            />
            <InfoRow
              icon={Languages}
              label="Locale"
              value={company.locale}
            />
            <InfoRow
              icon={Store}
              label="Stores"
              value={`${activeStores} active / ${company.merchants.length} total`}
            />
            <InfoRow
              icon={Calendar}
              label="Created"
              value={formatDate(company.createdAt)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {company.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 whitespace-pre-wrap">
              {company.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stores List */}
      {company.merchants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stores ({company.merchants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100">
              {company.merchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
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
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[merchant.status] || statusColors.inactive}`}
                  >
                    {merchant.status.charAt(0).toUpperCase() +
                      merchant.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Edit Modal */}
      {isEditingSettings && (
        <CompanySettingsForm
          currency={company.currency}
          locale={company.locale}
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
