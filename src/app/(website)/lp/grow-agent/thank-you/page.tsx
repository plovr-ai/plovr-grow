import type { Metadata } from "next";
import { ThankYouCard } from "@/app/(website)/lp/voice-agent/components/ThankYouCard";

export const metadata: Metadata = {
  title: "Thank You | Localgrow",
  description: "Your demo request has been received.",
};

export default function GrowAgentThankYouPage() {
  return <ThankYouCard />;
}
