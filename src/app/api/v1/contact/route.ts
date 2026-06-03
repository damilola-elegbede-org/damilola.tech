import { Errors } from "@/lib/api-response";
import { checkGenericRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendLeadNotification } from "@/lib/telegram";

export const runtime = "nodejs";

const RATE_LIMIT_CONFIG = {
  key: "contact",
  limit: 5,
  windowSeconds: 300,
};

// Basic RFC-style email check: local@domain.tld
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateBody(body: unknown):
  | { valid: true; data: { name: string; email: string; company?: string; message: string } }
  | { valid: false; error: string }
{
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  // Honeypot: real users never fill this hidden field
  if (b.website) {
    return { valid: false, error: "Invalid request." };
  }

  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return { valid: false, error: "`name` is required." };
  }
  if (b.name.length > 100) {
    return { valid: false, error: "`name` must be 100 characters or fewer." };
  }

  if (typeof b.email !== "string" || !EMAIL_RE.test(b.email)) {
    return { valid: false, error: "`email` must be a valid email address." };
  }
  if (b.email.length > 200) {
    return { valid: false, error: "`email` must be 200 characters or fewer." };
  }

  if (b.company !== undefined && b.company !== null && b.company !== "") {
    if (typeof b.company !== "string") {
      return { valid: false, error: "`company` must be a string." };
    }
    if (b.company.length > 100) {
      return { valid: false, error: "`company` must be 100 characters or fewer." };
    }
  }

  if (typeof b.message !== "string" || b.message.trim().length === 0) {
    return { valid: false, error: "`message` is required." };
  }
  if (b.message.length > 10000) {
    return { valid: false, error: "`message` must be 10,000 characters or fewer." };
  }

  return {
    valid: true,
    data: {
      name: b.name.trim(),
      email: (b.email as string).trim(),
      company:
        typeof b.company === "string" && b.company.trim()
          ? b.company.trim()
          : undefined,
      message: b.message.trim(),
    },
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const rateResult = await checkGenericRateLimit(RATE_LIMIT_CONFIG, ip);
  if (rateResult.limited) {
    return Errors.rateLimited(rateResult.retryAfter ?? 300);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Invalid JSON body.");
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return Errors.validationError(validation.error);
  }

  console.log(JSON.stringify({
    event: "contact_submission",
    ts: new Date().toISOString(),
    name: validation.data.name,
    email: validation.data.email,
    company: validation.data.company ?? null,
    message: validation.data.message,
  }));

  void sendLeadNotification(validation.data).catch((err) => {
    console.error(JSON.stringify({ event: "contact_telegram_error", error: String(err) }));
  });

  return Response.json(
    {
      success: true,
      data: {
        confirmation: "Thank you for reaching out. I'll be in touch within 48 hours.",
      },
    },
    { status: 201 }
  );
}
