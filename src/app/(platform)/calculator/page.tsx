import type { Metadata } from "next";
import { CalculatorPage } from "./components/CalculatorPage";

export const metadata: Metadata = {
  title: "How Much Are You Losing to Delivery Fees? | Plovr",
  description:
    "Calculate how much your restaurant loses to delivery platform fees every month.",
  openGraph: {
    title: "How Much Are You Losing to Delivery Fees?",
    description:
      "Calculate how much your restaurant loses to delivery platform fees every month.",
    type: "website",
  },
};

export default function CalculatorRoute() {
  return <CalculatorPage />;
}
