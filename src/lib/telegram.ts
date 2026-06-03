const TELEGRAM_API = "https://api.telegram.org";

export async function sendLeadNotification(data: {
  name: string;
  email: string;
  company?: string;
  message: string;
}): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
  if (!token || !chatId) return;

  const preview =
    data.message.length > 200 ? data.message.slice(0, 200) + "…" : data.message;

  const text = [
    "🔌 New consulting lead",
    "",
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Company: ${data.company ?? "—"}`,
    `Message: ${preview}`,
  ].join("\n");

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Telegram API error ${res.status}`);
  }
}
