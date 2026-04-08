import type { Metadata } from "next";
import { CustomerLossPage } from "./components/CustomerLossPage";

export const metadata: Metadata = {
  title: "Restaurant Customer Loss Calculator — How Many Regulars Are You Losing? | Plovr",
  description:
    "Most restaurants lose 20-30% of repeat customers monthly. Calculate your customer churn and revenue impact in seconds.",
  openGraph: {
    title: "Restaurant Customer Loss Calculator — How Many Regulars Are You Losing?",
    description:
      "Most restaurants lose 20-30% of repeat customers monthly. Calculate your customer churn and revenue impact in seconds.",
    type: "website",
  },
};

export default function CustomerLossRoute() {
  return <CustomerLossPage />;
}
