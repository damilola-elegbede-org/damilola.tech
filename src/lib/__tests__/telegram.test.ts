import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendLeadNotification } from '../telegram';

const validData = {
  name: 'Alice Tester',
  email: 'alice@example.com',
  company: 'Acme Inc',
  message: 'Hello world',
};

describe('sendLeadNotification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_NOTIFY_CHAT_ID: '12345',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('calls the Telegram API and resolves when fetch succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendLeadNotification(validData)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/bot');
    expect(url).toContain('/sendMessage');
    expect(init.method).toBe('POST');
  });

  it('throws when the Telegram API returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(sendLeadNotification(validData)).rejects.toThrow('Telegram API error 400');
  });

  it('returns early without calling fetch when TELEGRAM_BOT_TOKEN is absent', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendLeadNotification(validData)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns early without calling fetch when TELEGRAM_NOTIFY_CHAT_ID is absent', async () => {
    delete process.env.TELEGRAM_NOTIFY_CHAT_ID;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendLeadNotification(validData)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
