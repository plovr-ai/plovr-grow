"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Platform } from "../calculator.utils";

interface CalculatorFormValues {
  revenue: number;
  aov: number;
  platform: Platform;
}

interface CalculatorFormProps {
  onSubmit: (values: CalculatorFormValues) => void;
}

const PLATFORMS: { value: Platform; labelKey: string }[] = [
  { value: "doordash", labelKey: "platformDoordash" },
  { value: "ubereats", labelKey: "platformUbereats" },
  { value: "both", labelKey: "platformBoth" },
];

export function CalculatorForm({ onSubmit }: CalculatorFormProps) {
  const t = useTranslations("calculator");
  const [revenue, setRevenue] = useState("");
  const [aov, setAov] = useState("25");
  const [platform, setPlatform] = useState<Platform>("doordash");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const revenueNum = parseFloat(revenue);
    const aovNum = parseFloat(aov);
    if (revenueNum > 0 && aovNum > 0) {
      onSubmit({ revenue: revenueNum, aov: aovNum, platform });
    }
  };

  const isValid = parseFloat(revenue) > 0 && parseFloat(aov) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <label
          htmlFor="revenue"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("revenueLabel")}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            id="revenue"
            type="number"
            min="1"
            step="1"
            value={revenue}
            onChange={(e) => setRevenue(e.target.value)}
            placeholder={t("revenuePlaceholder")}
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            required
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="aov"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("aovLabel")}
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            $
          </span>
          <input
            id="aov"
            type="number"
            min="1"
            step="0.01"
            value={aov}
            onChange={(e) => setAov(e.target.value)}
            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("platformLabel")}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PLATFORMS.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPlatform(value)}
              className={`py-3 px-4 rounded-lg border text-sm font-medium transition-colors ${
                platform === value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-300"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!isValid}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
      >
        {t("calculateButton")}
      </button>

      <p className="text-center text-sm text-gray-500">{t("trustMessage")}</p>
    </form>
  );
}
