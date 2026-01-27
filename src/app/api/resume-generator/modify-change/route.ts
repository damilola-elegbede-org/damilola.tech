import Anthropic from '@anthropic-ai/sdk';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import type { ModifyChangeRequest, ProposedChange } from '@/lib/types/resume-generation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: Request) {
  // Verify admin auth
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!adminToken || !(await verifyToken(adminToken))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { originalChange, modifyPrompt, jobDescription }: ModifyChangeRequest = await req.json();

    if (!originalChange || !modifyPrompt || !jobDescription) {
      return Response.json(
        { error: 'Missing required fields: originalChange, modifyPrompt, jobDescription' },
        { status: 400 }
      );
    }

    // Wrap user input in XML tags for prompt injection mitigation
    const prompt = `You are revising a single resume change for ATS optimization.

<original_change>
Section: ${originalChange.section}
Original text: ${originalChange.original}
Proposed modification: ${originalChange.modified}
Reason: ${originalChange.reason}
</original_change>

<modify_request>${modifyPrompt}</modify_request>

Job Description (for context, truncated to 4000 chars to fit context window):
<job_description>${jobDescription.slice(0, 4000)}</job_description>

Return ONLY a JSON object with the revised change (no markdown code blocks):
{
  "section": "${originalChange.section}",
  "original": "${originalChange.original}",
  "modified": "YOUR REVISED TEXT HERE",
  "reason": "Updated reason explaining the change",
  "keywordsAdded": ["keyword1", "keyword2"],
  "impactPoints": ${originalChange.impactPoints}
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json({ error: 'No text response from AI' }, { status: 500 });
    }

    let jsonText = textBlock.text.trim();

    // Clean markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const revisedChange: ProposedChange = JSON.parse(jsonText);

    // Validate the response has all required fields
    if (
      !revisedChange.section ||
      !revisedChange.original ||
      !revisedChange.modified ||
      !revisedChange.reason ||
      !Array.isArray(revisedChange.keywordsAdded) ||
      typeof revisedChange.impactPoints !== 'number'
    ) {
      return Response.json({ error: 'Invalid response structure from AI' }, { status: 500 });
    }

    return Response.json({ revisedChange });
  } catch (error) {
    console.error('[modify-change] Error:', error);
    if (error instanceof SyntaxError) {
      return Response.json({ error: 'Failed to parse AI response as JSON' }, { status: 500 });
    }
    return Response.json({ error: 'AI service error' }, { status: 503 });
  }
}
