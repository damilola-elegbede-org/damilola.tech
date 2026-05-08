import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { listApplicationIds, getApplications } from '@/lib/applications-store';

export const runtime = 'nodejs';

export async function GET(_req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token || !(await verifyToken(token))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const allIds = await listApplicationIds();
    const applications = await getApplications(allIds);
    return Response.json({ success: true, data: { applications } });
  } catch (err) {
    console.error('[api/admin/applications] Failed to list applications:', err);
    return Response.json({ error: 'Failed to list applications' }, { status: 500 });
  }
}
