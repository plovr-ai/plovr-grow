import { StytchProvider } from "@/components/providers/StytchProvider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <StytchProvider>{children}</StytchProvider>;
}
