'use client';

import { usePathname } from 'next/navigation';
import { AdminNav } from './AdminNav';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <AdminNav />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
