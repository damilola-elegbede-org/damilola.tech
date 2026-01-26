import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

// Max PDF file size: 10MB
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

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
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
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

    // Validate file size
    if (file.size > MAX_PDF_SIZE_BYTES) {
      return Response.json(
        { error: `File too large. Maximum size is ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB` },
        { status: 413 }
      );
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
    const timestamp = Date.now(); // Add timestamp to prevent collisions
    const safeCompany = sanitize(companyName) || 'company';
    const safeRole = sanitize(roleTitle) || 'role';
    const filename = `${safeCompany}-${safeRole}-${date}-${timestamp}.pdf`;
    const environment = getEnvironment();

    // Store in resume/generated/ folder
    const blobPath = `damilola.tech/resume/generated/${environment}/${filename}`;

    console.log('[resume-generator/upload-pdf] Uploading to:', blobPath);

    // Read file as array buffer
    const buffer = await file.arrayBuffer();

    // Validate PDF magic bytes (PDF files start with %PDF)
    const uint8 = new Uint8Array(buffer);
    const pdfMagic = String.fromCharCode(...uint8.slice(0, 4));
    if (pdfMagic !== '%PDF') {
      return Response.json({ error: 'Invalid PDF file' }, { status: 400 });
    }

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
