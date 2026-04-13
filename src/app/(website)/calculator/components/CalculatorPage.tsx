"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Platform } from "../calculator.utils";
import { calculateMonthlyLoss, calculateYearlyLoss } from "../calculator.utils";
import { CalculatorForm } from "./CalculatorForm";
import { CalculatorResult } from "./CalculatorResult";

interface FormValues {
  revenue: number;
  aov: number;
  platform: Platform;
}

interface ResultData extends FormValues {
  monthlyLoss: number;
  yearlyLoss: number;
}

export function CalculatorPage() {
  const t = useTranslations("calculator");
  const [result, setResult] = useState<ResultData | null>(null);

  const handleCalculate = (values: FormValues) => {
    const monthlyLoss = calculateMonthlyLoss(values.revenue, values.platform);
    const yearlyLoss = calculateYearlyLoss(monthlyLoss);
    setResult({ ...values, monthlyLoss, yearlyLoss });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-12">
      <div
        className={`transition-all duration-500 ease-in-out flex flex-col items-center ${
          result
            ? "opacity-0 translate-y-[-20px] h-0 overflow-hidden"
            : "opacity-100 translate-y-0"
        }`}
      >
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-2">
          {t("headline")}
        </h1>
        <p className="text-lg text-gray-600 text-center mb-8">
          {t("subheadline")}
        </p>
        <CalculatorForm onSubmit={handleCalculate} />
      </div>

      {result && (
        <CalculatorResult
          monthlyLoss={result.monthlyLoss}
          yearlyLoss={result.yearlyLoss}
          revenue={result.revenue}
          aov={result.aov}
          platform={result.platform}
        />
      )}
    </div>
  );
}
