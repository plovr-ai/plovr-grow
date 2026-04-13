"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { calculateCustomerLoss } from "../customer-loss.utils";
import type { CustomerLossResult as CustomerLossResultType } from "../customer-loss.utils";
import { CustomerLossForm } from "./CustomerLossForm";
import { CustomerLossResult } from "./CustomerLossResult";

interface FormValues {
  monthlyOrders: number;
  aov: number;
}

interface ResultData extends CustomerLossResultType {
  monthlyOrders: number;
  aov: number;
}

export function CustomerLossPage() {
  const t = useTranslations("customerLoss");
  const [result, setResult] = useState<ResultData | null>(null);

  const handleCalculate = (values: FormValues) => {
    const lossResult = calculateCustomerLoss(values.monthlyOrders, values.aov);
    setResult({ ...lossResult, monthlyOrders: values.monthlyOrders, aov: values.aov });
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
        <CustomerLossForm onSubmit={handleCalculate} />
      </div>

      {result && (
        <CustomerLossResult
          estimatedCustomers={result.estimatedCustomers}
          lostCustomers={result.lostCustomers}
          monthlyRevenueLoss={result.monthlyRevenueLoss}
          yearlyRevenueLoss={result.yearlyRevenueLoss}
          monthlyOrders={result.monthlyOrders}
          aov={result.aov}
        />
      )}
    </div>
  );
}
