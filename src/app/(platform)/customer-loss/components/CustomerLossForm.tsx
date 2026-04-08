"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface CustomerLossFormValues {
  monthlyOrders: number;
  aov: number;
}

interface CustomerLossFormProps {
  onSubmit: (values: CustomerLossFormValues) => void;
}

export function CustomerLossForm({ onSubmit }: CustomerLossFormProps) {
  const t = useTranslations("customerLoss");
  const [orders, setOrders] = useState("");
  const [aov, setAov] = useState("25");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ordersNum = parseFloat(orders);
    const aovNum = parseFloat(aov);
    if (ordersNum > 0 && aovNum > 0) {
      onSubmit({ monthlyOrders: ordersNum, aov: aovNum });
    }
  };

  const isValid = parseFloat(orders) > 0 && parseFloat(aov) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md">
      <div>
        <label
          htmlFor="orders"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {t("ordersLabel")}
        </label>
        <input
          id="orders"
          type="number"
          min="1"
          step="1"
          value={orders}
          onChange={(e) => setOrders(e.target.value)}
          placeholder={t("ordersPlaceholder")}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
          required
        />
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
