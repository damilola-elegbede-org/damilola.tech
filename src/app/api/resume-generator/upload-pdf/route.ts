import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/admin-auth';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

function getEnvironment(): string {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

export async function POST(req: Request) {
  console.log('[resume-generator/upload-pdf] Request received');

  // Verify admin authentication
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin-token')?.value;
  if (!adminToken || !(await verifyToken(adminToken))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const companyName = formData.get('companyName') as string | null;
    const roleTitle = formData.get('roleTitle') as string | null;

    if (!file) {
      return Response.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (!companyName || !roleTitle) {
      return Response.json({ error: 'Company name and role title are required' }, { status: 400 });
    }

    // Sanitize filename components
    const sanitize = (str: string) =>
      str
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 30);

    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `${sanitize(companyName)}-${sanitize(roleTitle)}-${date}.pdf`;
    const environment = getEnvironment();

    // Store in resume/generated/ folder
    const blobPath = `damilola.tech/resume/generated/${environment}/${filename}`;

    console.log('[resume-generator/upload-pdf] Uploading to:', blobPath);

    // Read file as array buffer
    const buffer = await file.arrayBuffer();

    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    console.log('[resume-generator/upload-pdf] Upload successful:', blob.url);

    return Response.json({
      success: true,
      url: blob.url,
      filename,
    });
  } catch (error) {
    console.error('[resume-generator/upload-pdf] Error:', error);
    return Response.json(
      { error: 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
