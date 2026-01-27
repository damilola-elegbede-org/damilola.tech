import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Map slug to file path
const DOC_FILES: Record<string, string> = {
  'readme': 'README.md',
  'claude-md': 'CLAUDE.md',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // Check authentication
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  if (!session?.value) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slug } = await params;
  const fileName = DOC_FILES[slug];

  if (!fileName) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    const filePath = join(process.cwd(), fileName);
    const content = await readFile(filePath, 'utf-8');

    return Response.json({
      slug,
      fileName,
      content,
    });
  } catch (error) {
    console.error(`Failed to read ${fileName}:`, error);
    return Response.json({ error: 'Failed to read document' }, { status: 500 });
  }
}
