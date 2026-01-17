export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth pages (login, register, etc.) don't require authentication
  // This layout overrides the parent dashboard layout's auth check
  return <>{children}</>;
}
