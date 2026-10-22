import PrivateRoute from '../upload/PrivateRouter';

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <PrivateRoute>{children}</PrivateRoute>;
}
