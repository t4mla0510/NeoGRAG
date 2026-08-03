export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  // ponytail: auth bypassed for local dev — re-enable by wrapping children in <PrivateRoute>
  return <>{children}</>;
}
