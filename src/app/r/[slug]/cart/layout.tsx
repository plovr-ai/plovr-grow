import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Review your order and checkout",
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
