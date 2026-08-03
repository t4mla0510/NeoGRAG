'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../AuthContext';
import './admin.css';

const NAV_ITEMS = [
  { href: '/admin', label: 'Tổng quan', icon: 'space_dashboard' },
  { href: '/admin/files', label: 'Nguồn dữ liệu', icon: 'folder_open' },
  { href: '/admin/collections', label: 'Bộ sưu tập', icon: 'database' },
  { href: '/admin/kg', label: 'Knowledge Graph', icon: 'account_tree' },
  { href: '/admin/search', label: 'Tìm kiếm', icon: 'manage_search' },
  { href: '/admin/settings', label: 'Cài đặt', icon: 'settings' },
];

export default function AdminLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout?.();
    router.replace('/auth');
  };

  const initials = (user?.username || user?.email || 'AD').slice(0, 2).toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/admin" className="admin-brand">
          <Image src="/assets/logo.png" alt="" width={40} height={40} />
          <span className="admin-brand-name">REBot</span>
          <span className="admin-brand-sub">Quản trị tri thức</span>
        </Link>

        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item ${active ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-chip">
            <span className="admin-user-avatar">{initials}</span>
            <div className="admin-user-meta">
              <strong>{user?.username || 'Admin'}</strong>
              <small>{user?.email || 'Quản trị viên'}</small>
            </div>
            <button
              type="button"
              className="admin-logout"
              onClick={handleLogout}
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
