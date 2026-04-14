import type { Metadata } from "next";
import { ThankYouCard } from "../components/ThankYouCard";

export const metadata: Metadata = {
  title: "Thank You | Localgrow",
  description: "Your demo request has been received.",
};

export default function ThankYouPage() {
  return <ThankYouCard />;
}
