"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Platform } from "../calculator.utils";
import { LeadCaptureForm } from "./LeadCaptureForm";

interface CalculatorResultProps {
  monthlyLoss: number;
  yearlyLoss: number;
  revenue: number;
  aov: number;
  platform: Platform;
}

function useCountUp(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    startTime.current = null;
    const animate = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const progress = Math.min((timestamp - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CalculatorResult({
  monthlyLoss,
  yearlyLoss,
  revenue,
  aov,
  platform,
}: CalculatorResultProps) {
  const t = useTranslations("calculator");
  const router = useRouter();
  const animatedMonthly = useCountUp(monthlyLoss);
  const animatedYearly = useCountUp(yearlyLoss);

  const barMaxWidth = 100;
  const platformBarWidth = barMaxWidth;
  const directBarWidth = 0;

  const handleLeadSubmit = async (email: string) => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        revenue,
        aov,
        platform,
        monthlyLoss,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error("Failed to submit");
    }

    router.push("/generator");
  };

  return (
    <div className="w-full max-w-lg space-y-8 animate-fade-in">
      <div className="text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-red-600">
          {t("resultHeadline", { amount: formatCurrency(animatedMonthly) })}
        </h2>
        <p className="mt-2 text-xl text-gray-600">
          {t("resultYearly", { amount: formatCurrency(animatedYearly) })}
        </p>
      </div>

      <div className="space-y-4 bg-gray-50 rounded-xl p-6">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">
              {t("chartPlatform")}
            </span>
            <span className="font-semibold text-red-600">
              {formatCurrency(animatedMonthly)}
            </span>
          </div>
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${platformBarWidth}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">
              {t("chartDirect")}
            </span>
            <span className="font-semibold text-green-600">
              {formatCurrency(0)}
            </span>
          </div>
          <div className="h-8 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${directBarWidth}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-green-500 text-lg">&#10003;</span>
          <span>{t("sellingPoint1")}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-700">
          <span className="text-green-500 text-lg">&#10003;</span>
          <span>{t("sellingPoint2")}</span>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-center text-gray-900">
          {t("ctaHeadline")}
        </h3>
        <LeadCaptureForm onSubmit={handleLeadSubmit} />
      </div>
    </div>
  );
}
