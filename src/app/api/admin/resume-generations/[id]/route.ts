import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/admin-auth';
import type { ResumeGenerationLog, ApplicationStatus } from '@/lib/types/resume-generation';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const decodedUrl = decodeURIComponent(id);

  console.log('[admin/resume-generations/[id]] GET request for:', decodedUrl);

  // Verify admin authentication
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin-token')?.value;
  if (!adminToken || !(await verifyToken(adminToken))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch the generation data from the blob URL
    const response = await fetch(decodedUrl);
    if (!response.ok) {
      return Response.json({ error: 'Generation not found' }, { status: 404 });
    }

    const data: ResumeGenerationLog = await response.json();

    return Response.json(data);
  } catch (error) {
    console.error('[admin/resume-generations/[id]] Error:', error);
    return Response.json(
      { error: 'Failed to fetch generation' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const decodedUrl = decodeURIComponent(id);

  console.log('[admin/resume-generations/[id]] PATCH request for:', decodedUrl);

  // Verify admin authentication
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('admin-token')?.value;
  if (!adminToken || !(await verifyToken(adminToken))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updates = await req.json();
    const { applicationStatus, appliedDate, notes } = updates;

    // Validate applicationStatus if provided
    const validStatuses: ApplicationStatus[] = ['draft', 'applied', 'interview', 'offer', 'rejected'];
    if (applicationStatus && !validStatuses.includes(applicationStatus)) {
      return Response.json({ error: 'Invalid application status' }, { status: 400 });
    }

    // Fetch current data
    const response = await fetch(decodedUrl);
    if (!response.ok) {
      return Response.json({ error: 'Generation not found' }, { status: 404 });
    }

    const data: ResumeGenerationLog = await response.json();

    // Apply updates
    if (applicationStatus !== undefined) {
      data.applicationStatus = applicationStatus;
    }
    if (appliedDate !== undefined) {
      data.appliedDate = appliedDate;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }

    // Extract blob path from URL to save back to same location
    // URL format: https://xxxxx.public.blob.vercel-storage.com/damilola.tech/resume-generations/...
    const urlObj = new URL(decodedUrl);
    const blobPath = urlObj.pathname.replace(/^\//, '');

    console.log('[admin/resume-generations/[id]] Saving updated data to:', blobPath);

    // Save updated data back to blob
    const blob = await put(blobPath, JSON.stringify(data, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });

    console.log('[admin/resume-generations/[id]] Updated successfully:', blob.url);

    return Response.json({
      success: true,
      url: blob.url,
      data,
    });
  } catch (error) {
    console.error('[admin/resume-generations/[id]] Error:', error);
    return Response.json(
      { error: 'Failed to update generation' },
      { status: 500 }
    );
  }
}
