import { Errors } from '@/lib/api-response';
import { checkGenericRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_MESSAGE_LENGTH = 10_000;

const CONTACT_RATE_LIMIT = {
  key: 'contact',
  limit: 5,
  windowSeconds: 300,
} as const;

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Rate limit applied before body parsing — every request (including 400s) counts.
  const rateLimit = await checkGenericRateLimit(CONTACT_RATE_LIMIT, ip);
  if (rateLimit.limited) {
    return Errors.rateLimited(rateLimit.retryAfter ?? 300);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Errors.validationError('Invalid JSON body.');
  }

  // Honeypot: a filled website field is a bot signal — reject as validation error.
  if (body.website) {
    return Errors.validationError('Invalid submission.');
  }

  const { name, email, message } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return Errors.validationError('Name is required.');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return Errors.validationError('Email is required.');
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return Errors.validationError('Message is required.');
  }

  const emailStr = email.trim();

  // Block CRLF injection (email header smuggling vector).
  if (/[\r\n]/.test(emailStr)) {
    return Errors.validationError('Invalid email format.');
  }

  // Require @ with a domain segment that contains a dot (TLD presence check).
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailStr)) {
    return Errors.validationError('Invalid email format.');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return Errors.validationError('Message is too long (max 10,000 characters).');
  }

  return Response.json(
    {
      success: true,
      data: {
        confirmation: 'Thank you for reaching out. I will get back to you shortly.',
      },
    },
    { status: 201 }
  );
}
