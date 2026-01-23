import { AdminLayout } from '@/components/admin/AdminLayout';

export const metadata = {
  title: 'Admin Portal | damilola.tech',
  robots: 'noindex, nofollow',
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
